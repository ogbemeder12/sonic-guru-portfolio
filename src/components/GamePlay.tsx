import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleDot, Square, Scissors } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useSearchParams } from "react-router-dom";
import { useWallet } from '@solana/wallet-adapter-react';
import { useRockPaperScissors } from "@/hooks/useRockPaperScissors";
import { PublicKey } from '@solana/web3.js';
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Choice = 'rock' | 'paper' | 'scissors';

interface Game {
  id: string;
  creator: string;
  creatorWallet: string;
  currentPlayers: string[];
  status: 'open' | 'in-progress' | 'completed';
}

export const GamePlay = ({ isDemo = false }: { isDemo?: boolean }) => {
  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [computerChoice, setComputerChoice] = useState<Choice | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [showWaitDialog, setShowWaitDialog] = useState(false);
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get("gameId");
  const { toast } = useToast();
  const { publicKey } = useWallet();
  const { resolveBet } = useRockPaperScissors();

  useEffect(() => {
    if (gameId) {
      const username = localStorage.getItem("username");
      const games = JSON.parse(localStorage.getItem("games") || "[]");
      const currentGame = games.find((g: Game) => g.id === gameId);
      
      if (currentGame) {
        if (currentGame.creator === username && currentGame.status === 'open') {
          setShowWaitDialog(true);
        } else if (currentGame.status === 'in-progress') {
          setShowWaitDialog(false);
        }
      }
    }
  }, [gameId]);

  const getComputerChoice = (): Choice => {
    const choices: Choice[] = ['rock', 'paper', 'scissors'];
    return choices[Math.floor(Math.random() * choices.length)];
  };

  const determineWinner = (player: Choice, computer: Choice) => {
    if (player === computer) return "It's a tie!";
    if (
      (player === 'rock' && computer === 'scissors') ||
      (player === 'paper' && computer === 'rock') ||
      (player === 'scissors' && computer === 'paper')
    ) {
      return 'You win!';
    }
    return 'Computer wins!';
  };

  const updateLeaderboard = async (winner: string, amount: number, isWinner: boolean) => {
    const { data: existingUser, error: fetchError } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('username', winner)
      .eq('is_demo', isDemo)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user:', fetchError);
      return;
    }

    const points = isWinner ? amount * 2 : 0;
    const gamesWon = isWinner ? 1 : 0;

    if (existingUser) {
      const { error: updateError } = await supabase
        .from('leaderboard')
        .update({
          points: existingUser.points + points,
          games_won: existingUser.games_won + gamesWon,
        })
        .eq('id', existingUser.id);

      if (updateError) {
        console.error('Error updating leaderboard:', updateError);
      }
    } else {
      const { error: insertError } = await supabase
        .from('leaderboard')
        .insert([
          {
            username: winner,
            points: points,
            games_won: gamesWon,
            is_demo: isDemo,
            wallet_address: publicKey?.toString(),
          },
        ]);

      if (insertError) {
        console.error('Error inserting into leaderboard:', insertError);
      }
    }
  };

  const handleGameEnd = async (result: string) => {
    if (!isDemo && gameId) {
      const games = JSON.parse(localStorage.getItem("games") || "[]");
      const currentGame = games.find((g: Game) => g.id === gameId);
      
      if (currentGame) {
        // Update game status in Supabase
        const { error: gameUpdateError } = await supabase
          .from('games')
          .update({
            status: 'completed',
            winner: result === 'You win!' ? localStorage.getItem("username") : 'Computer',
          })
          .eq('id', gameId);

        if (gameUpdateError) {
          console.error('Error updating game status:', gameUpdateError);
        }

        // Update local storage
        currentGame.status = 'completed';
        localStorage.setItem("games", JSON.stringify(games));

        // Transfer funds to winner
        if (result === 'You win!' && publicKey) {
          try {
            await resolveBet(gameId, publicKey);
            await updateLeaderboard(localStorage.getItem("username") || '', currentGame.amount, true);
            toast({
              title: "Funds Transferred",
              description: "Your winnings have been sent to your wallet!",
            });
          } catch (error) {
            console.error('Error transferring funds:', error);
            toast({
              title: "Transfer Failed",
              description: "Failed to transfer winnings. Please contact support.",
              variant: "destructive",
            });
          }
        } else if (result === 'Computer wins!' && currentGame.creatorWallet) {
          try {
            await resolveBet(gameId, new PublicKey(currentGame.creatorWallet));
            await updateLeaderboard('Computer', currentGame.amount, true);
            toast({
              title: "Game Ended",
              description: "Funds have been transferred to the winner.",
            });
          } catch (error) {
            console.error('Error transferring funds:', error);
            toast({
              title: "Transfer Failed",
              description: "Failed to transfer funds. Please contact support.",
              variant: "destructive",
            });
          }
        }
      }
    } else if (isDemo) {
      // Handle demo game results
      const username = localStorage.getItem("username");
      if (username && result) {
        await updateLeaderboard(
          username,
          1, // Demo games always worth 1 point
          result === 'You win!'
        );
      }
    }
  };

  const handleChoice = (choice: Choice) => {
    const username = localStorage.getItem("username");
    const games = JSON.parse(localStorage.getItem("games") || "[]");
    const currentGame = games.find((g: Game) => g.id === gameId);

    // If it's the creator and game is still open, show toast
    if (currentGame && currentGame.creator === username && currentGame.status === 'open') {
      toast({
        title: "Game not ready",
        description: "Wait for the second player to join first.",
        variant: "destructive",
      });
      return;
    }

    // Only check wallet connection if it's not a demo and the user is not already in a game
    if (!isDemo && !gameId && !localStorage.getItem("walletConnected")) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to play",
        variant: "destructive",
      });
      return;
    }

    setPlayerChoice(choice);
    const compChoice = getComputerChoice();
    setComputerChoice(compChoice);
    const gameResult = determineWinner(choice, compChoice);
    setResult(gameResult);
    
    // Handle game end and fund transfer
    handleGameEnd(gameResult);
  };

  const playAgain = () => {
    setPlayerChoice(null);
    setComputerChoice(null);
    setResult(null);
  };

  return (
    <>
      <Card className="border-accent/20 bg-gradient-to-b from-slate-900 to-slate-800 shadow-2xl">
        <CardHeader className="border-b border-accent/10">
          <CardTitle className="font-game text-lg text-primary animate-glow text-center">
            {result ? "Game Result" : "Choose Your Weapon"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          {!result ? (
            <div className="grid grid-cols-3 gap-6">
              <Button
                variant="outline"
                className="flex flex-col items-center p-8 hover:bg-accent hover:text-accent-foreground transition-all transform hover:scale-105 bg-slate-800/50 border-accent/20"
                onClick={() => handleChoice('rock')}
              >
                <CircleDot className="w-12 h-12 mb-2 animate-glow" />
                <span className="font-game">Rock</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center p-8 hover:bg-accent hover:text-accent-foreground transition-all transform hover:scale-105 bg-slate-800/50 border-accent/20"
                onClick={() => handleChoice('paper')}
              >
                <Square className="w-12 h-12 mb-2 animate-glow" />
                <span className="font-game">Paper</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col items-center p-8 hover:bg-accent hover:text-accent-foreground transition-all transform hover:scale-105 bg-slate-800/50 border-accent/20"
                onClick={() => handleChoice('scissors')}
              >
                <Scissors className="w-12 h-12 mb-2 animate-glow" />
                <span className="font-game">Scissors</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-8 text-center">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4 p-6 bg-slate-800/30 rounded-lg border border-accent/10">
                  <p className="text-muted-foreground font-game">Your Choice</p>
                  <p className="text-2xl font-game text-primary animate-glow">{playerChoice}</p>
                </div>
                <div className="space-y-4 p-6 bg-slate-800/30 rounded-lg border border-accent/10">
                  <p className="text-muted-foreground font-game">Computer's Choice</p>
                  <p className="text-2xl font-game text-primary animate-glow">{computerChoice}</p>
                </div>
              </div>
              <div className="space-y-6">
                <p className="text-3xl font-game text-accent animate-glow">{result}</p>
                <Button 
                  onClick={playAgain} 
                  className="font-game bg-accent hover:bg-accent/80 text-accent-foreground"
                >
                  Play Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showWaitDialog} onOpenChange={setShowWaitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Waiting for Players</DialogTitle>
            <DialogDescription>
              Please wait for the second player to join the game before you can start playing.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};
