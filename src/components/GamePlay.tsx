import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleDot, Square, Scissors, Timer } from "lucide-react";
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
  DialogFooter,
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

const CHOICE_TIMER = 60; // 1 minute to make a choice

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
  const { resolveBet, joinBet, createBet } = useRockPaperScissors();
  const currentUsername = localStorage.getItem("username");
  const [showResultModal, setShowResultModal] = useState(false);
  const [isWinner, setIsWinner] = useState(false);
  const [timeLeft, setTimeLeft] = useState(CHOICE_TIMER);
  const [timerActive, setTimerActive] = useState(false);
  const [waitingForOpponentChoice, setWaitingForOpponentChoice] = useState(false);
  const [showChoiceReminder, setShowChoiceReminder] = useState(false);

  useEffect(() => {
    if (gameId && currentUsername) {
      const checkExistingChoice = async () => {
        const { data: gameData } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (gameData) {
          if (currentUsername === gameData.creator_id && gameData.creator_choice) {
            setPlayerChoice(gameData.creator_choice);
            setWaitingForOpponentChoice(true);
          } else if (currentUsername === gameData.player2_id && gameData.player2_choice) {
            setPlayerChoice(gameData.player2_choice);
            setWaitingForOpponentChoice(true);
          }

          if (gameData.status === 'in-progress') {
            setTimeLeft(CHOICE_TIMER);
            setTimerActive(true);
          }
        }
      };

      checkExistingChoice();
    }
  }, [gameId, currentUsername]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (timerActive && timeLeft > 0) {
      timer = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && game?.status === 'in-progress') {
      handleTimeUp();
    }

    if (timeLeft === CHOICE_TIMER - 10 && !playerChoice) {
      setShowChoiceReminder(true);
    }

    return () => clearTimeout(timer);
  }, [timeLeft, timerActive]);

  const handleTimeUp = async () => {
    if (!game || !gameId) return;

    const creatorHasChoice = Boolean(game.creator_choice);
    const player2HasChoice = Boolean(game.player2_choice);

    if (!creatorHasChoice && !player2HasChoice) {
      await supabase
        .from('games')
        .update({
          creator_choice: null,
          player2_choice: null,
          status: 'in-progress'
        })
        .eq('id', gameId);

      toast({
        title: "Game Restarted",
        description: "Neither player made a choice. The game has been restarted.",
        variant: "default",
      });

      setPlayerChoice(null);
      setOpponentChoice(null);
      setResult(null);
      setTimeLeft(CHOICE_TIMER);
      setTimerActive(true);
    } else if (creatorHasChoice !== player2HasChoice) {
      const winner = creatorHasChoice ? game.creator_id : game.player2_id;
      if (winner) {
        await resolveBet(gameId, winner);
        setIsWinner(winner === currentUsername);
        setShowResultModal(true);

        await supabase
          .from('games')
          .update({
            status: 'completed',
            winner: winner
          })
          .eq('id', gameId);

        toast({
          title: "Game Ended",
          description: winner === currentUsername 
            ? "You win! Your opponent didn't make a choice in time." 
            : "You lost! You didn't make a choice in time.",
          variant: "destructive",
        });
      }
    }
    
    setTimerActive(false);
  };

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
          if (gameData.status === 'in-progress' || gameData.status === 'open') {
            setTimeLeft(CHOICE_TIMER);
            setTimerActive(true);
          }
        }
      };

      fetchGameStatus();

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
            
            if (!playerChoice && (updatedGame.status === 'in-progress' || updatedGame.status === 'open')) {
              toast({
                title: "Make Your Choice!",
                description: "Please select rock, paper, or scissors to play.",
                variant: "default",
              });
            }

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
                  setIsWinner(winner === currentUsername);
                  setShowResultModal(true);
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
      const hasExistingChoice = currentUsername === game.creator_id 
        ? game.creator_choice 
        : game.player2_choice;

      if (hasExistingChoice) {
        toast({
          title: "Choice already made",
          description: "You cannot change your choice once it's made.",
          variant: "destructive",
        });
        return;
      }

      if (game.status !== 'in-progress' && game.status !== 'open') {
        toast({
          title: "Game not active",
          description: "This game has ended.",
          variant: "destructive",
        });
        return;
      }

      const updateData = {
        ...(currentUsername === game.creator_id 
          ? { creator_choice: choice }
          : { player2_choice: choice }),
        status: 'in-progress'
      };

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

      setTimerActive(true);
      setShowChoiceReminder(false);
      setWaitingForOpponentChoice(true);
      setPlayerChoice(choice);
      
      toast({
        title: "Choice Made!",
        description: "Waiting for your opponent to make their choice.",
        variant: "default",
      });
    } else {
      setPlayerChoice(choice);
      const compChoice = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)] as Choice;
      setOpponentChoice(compChoice);
      setResult(determineWinner(choice, compChoice));
    }
  };

  const handleRematch = async () => {
    if (!game || !currentUsername || !publicKey) return;

    try {
      const newGameId = await createBet(game.amount, 2);
      if (newGameId) {
        setShowResultModal(false);
        window.location.href = `/game?mode=multiplayer&gameId=${newGameId}`;
      }
    } catch (error) {
      console.error('Error creating rematch:', error);
      toast({
        title: "Error",
        description: "Failed to create rematch game",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (game?.status === 'in-progress' && !playerChoice) {
      setTimeLeft(CHOICE_TIMER);
      setTimerActive(true);
    }
  }, [game?.status]);

  const playAgain = () => {
    setPlayerChoice(null);
    setOpponentChoice(null);
    setResult(null);
    setWaitingForOpponent(false);
    if (game) {
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
            {timerActive && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <Timer className="w-4 h-4 animate-pulse" />
                <span className="text-sm font-bold text-yellow-500">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          {!result && (
            <div className="grid grid-cols-3 gap-6">
              <Button
                variant="outline"
                className={`flex flex-col items-center p-8 hover:bg-accent hover:text-accent-foreground transition-all transform hover:scale-105 bg-slate-800/50 border-accent/20 ${playerChoice === 'rock' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => handleChoice('rock')}
                disabled={!!playerChoice}
              >
                <CircleDot className="w-12 h-12 mb-2 animate-glow" />
                <span className="font-game">Rock</span>
              </Button>
              <Button
                variant="outline"
                className={`flex flex-col items-center p-8 hover:bg-accent hover:text-accent-foreground transition-all transform hover:scale-105 bg-slate-800/50 border-accent/20 ${playerChoice === 'paper' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => handleChoice('paper')}
                disabled={!!playerChoice}
              >
                <Square className="w-12 h-12 mb-2 animate-glow" />
                <span className="font-game">Paper</span>
              </Button>
              <Button
                variant="outline"
                className={`flex flex-col items-center p-8 hover:bg-accent hover:text-accent-foreground transition-all transform hover:scale-105 bg-slate-800/50 border-accent/20 ${playerChoice === 'scissors' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => handleChoice('scissors')}
                disabled={!!playerChoice}
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

      <Dialog open={showChoiceReminder} onOpenChange={setShowChoiceReminder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make Your Choice!</DialogTitle>
            <DialogDescription>
              Please select rock, paper, or scissors. You have {timeLeft} seconds remaining to make your choice.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

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

      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isWinner ? "Congratulations!" : "Game Over"}</DialogTitle>
            <DialogDescription>
              {isWinner 
                ? "Congratulations! You win!!! The betting SOL has been transferred to your wallet address." 
                : "Sorry, you lost."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-center gap-4 mt-6">
            <Button onClick={handleRematch} className="w-full">
              Rematch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
