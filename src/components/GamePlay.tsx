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
      const fetchGameStatus = async () => {
        const { data: game } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();
        
        if (game) {
          if (game.creator_id === username && game.status === 'open') {
            setShowWaitDialog(true);
          } else if (game.status === 'in-progress') {
            setShowWaitDialog(false);
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
          (payload) => {
            if (payload.new.status === 'in-progress') {
              setShowWaitDialog(false);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
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

  const handleChoice = async (choice: Choice) => {
    if (!isDemo && gameId) {
      const username = localStorage.getItem("username");
      const { data: game } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (game) {
        // If it's the creator and game is still open, show toast
        if (game.creator_id === username && game.status === 'open') {
          toast({
            title: "Game not ready",
            description: "Wait for the second player to join first.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    setPlayerChoice(choice);
    const compChoice = getComputerChoice();
    setComputerChoice(compChoice);
    const gameResult = determineWinner(choice, compChoice);
    setResult(gameResult);

    // Handle game end and fund transfer
    if (!isDemo && gameId && gameResult && gameResult !== "It's a tie!") {
      const winner = gameResult === 'You win!' ? localStorage.getItem("username") : 'Computer';
      if (winner) {
        await resolveBet(gameId, winner);
      }
    }
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
