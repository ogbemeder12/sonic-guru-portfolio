
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleDot, Square, Scissors } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useSearchParams } from "react-router-dom";
import { useWallet } from '@solana/wallet-adapter-react';
import { useRockPaperScissors } from "@/hooks/useRockPaperScissors";
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
  creator_id: string;
  creator_wallet: string;
  player2_wallet: string | null;
  status: 'open' | 'in-progress' | 'completed';
  winner: string | null;
  creator_choice?: Choice;
  player2_choice?: Choice;
  player2_id?: string;
  amount: number;
}

export const GamePlay = ({ isDemo = false }: { isDemo?: boolean }) => {
  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [opponentChoice, setOpponentChoice] = useState<Choice | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [showWaitDialog, setShowWaitDialog] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get("gameId");
  const { toast } = useToast();
  const { publicKey } = useWallet();
  const { resolveBet, joinBet } = useRockPaperScissors();
  const currentUsername = localStorage.getItem("username");

  useEffect(() => {
    if (gameId) {
      const fetchGameStatus = async () => {
        const { data: gameData } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();
        
        if (gameData) {
          setGame(gameData);
          if (gameData.creator_id === currentUsername && gameData.status === 'open') {
            setShowWaitDialog(true);
          } else if (gameData.status === 'in-progress') {
            setShowWaitDialog(false);
            
            // Check if we need to wait for opponent's choice
            if (gameData.creator_id === currentUsername && !gameData.player2_choice) {
              setWaitingForOpponent(true);
            } else if (gameData.player2_id === currentUsername && !gameData.creator_choice) {
              setWaitingForOpponent(true);
            }
          }
        }
      };

      fetchGameStatus();

      // Subscribe to game status changes
      const channel = supabase
        .channel('game_status')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'games',
            filter: `id=eq.${gameId}`,
          },
          async (payload) => {
            const updatedGame = payload.new as Game;
            setGame(updatedGame);
            
            if (updatedGame.status === 'in-progress') {
              setShowWaitDialog(false);
            }

            // Check if both players have made their choices
            if (updatedGame.creator_choice && updatedGame.player2_choice) {
              setWaitingForOpponent(false);
              const result = determineWinner(
                currentUsername === updatedGame.creator_id 
                  ? updatedGame.creator_choice 
                  : updatedGame.player2_choice,
                currentUsername === updatedGame.creator_id 
                  ? updatedGame.player2_choice 
                  : updatedGame.creator_choice
              );
              setResult(result);
              setPlayerChoice(currentUsername === updatedGame.creator_id 
                ? updatedGame.creator_choice 
                : updatedGame.player2_choice);
              setOpponentChoice(currentUsername === updatedGame.creator_id 
                ? updatedGame.player2_choice 
                : updatedGame.creator_choice);

              if (result !== "It's a tie!") {
                const winner = result === 'You win!' ? currentUsername : 
                  (currentUsername === updatedGame.creator_id ? updatedGame.player2_id : updatedGame.creator_id);
                if (winner) {
                  await resolveBet(gameId, winner);
                }
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [gameId, currentUsername, resolveBet]);

  const determineWinner = (playerChoice: Choice, opponentChoice: Choice) => {
    if (playerChoice === opponentChoice) return "It's a tie!";
    if (
      (playerChoice === 'rock' && opponentChoice === 'scissors') ||
      (playerChoice === 'paper' && opponentChoice === 'rock') ||
      (playerChoice === 'scissors' && opponentChoice === 'paper')
    ) {
      return 'You win!';
    }
    return 'Opponent wins!';
  };

  const handleChoice = async (choice: Choice) => {
    if (!isDemo && gameId && game) {
      // Verify it's player's turn and game is in progress
      if (game.status !== 'in-progress') {
        toast({
          title: "Game not ready",
          description: "Wait for the second player to join first.",
          variant: "destructive",
        });
        return;
      }

      // Update the game with player's choice
      const updateData = currentUsername === game.creator_id
        ? { creator_choice: choice }
        : { player2_choice: choice };

      const { error: updateError } = await supabase
        .from('games')
        .update(updateData)
        .eq('id', gameId);

      if (updateError) {
        toast({
          title: "Error",
          description: "Failed to submit your choice",
          variant: "destructive",
        });
        return;
      }

      setWaitingForOpponent(true);
      setPlayerChoice(choice);
    } else {
      // Demo mode - play against computer
      setPlayerChoice(choice);
      const compChoice = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)] as Choice;
      setOpponentChoice(compChoice);
      setResult(determineWinner(choice, compChoice));
    }
  };

  const playAgain = () => {
    setPlayerChoice(null);
    setOpponentChoice(null);
    setResult(null);
    setWaitingForOpponent(false);
    if (game) {
      // Reset game choices
      supabase
        .from('games')
        .update({
          creator_choice: null,
          player2_choice: null,
        })
        .eq('id', game.id);
    }
  };

  return (
    <>
      <Card className="border-accent/20 bg-gradient-to-b from-slate-900 to-slate-800 shadow-2xl">
        <CardHeader className="border-b border-accent/10">
          <CardTitle className="font-game text-lg text-primary animate-glow text-center">
            {result ? "Game Result" : waitingForOpponent ? "Waiting for Opponent..." : "Choose Your Weapon"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          {!result && !waitingForOpponent && (
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
          )}
          {waitingForOpponent && !result && (
            <div className="text-center py-8">
              <p className="text-xl font-game text-primary animate-pulse">
                Waiting for opponent to make their choice...
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Your choice: {playerChoice}
              </p>
            </div>
          )}
          {result && (
            <div className="space-y-8 text-center">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4 p-6 bg-slate-800/30 rounded-lg border border-accent/10">
                  <p className="text-muted-foreground font-game">Your Choice</p>
                  <p className="text-2xl font-game text-primary animate-glow">{playerChoice}</p>
                </div>
                <div className="space-y-4 p-6 bg-slate-800/30 rounded-lg border border-accent/10">
                  <p className="text-muted-foreground font-game">
                    {isDemo ? "Computer's" : "Opponent's"} Choice
                  </p>
                  <p className="text-2xl font-game text-primary animate-glow">{opponentChoice}</p>
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
