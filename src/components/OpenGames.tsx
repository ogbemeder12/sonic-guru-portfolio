import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Search, Coins, Clock, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Game {
  id: string;
  creator_id: string;
  amount: number;
  status: 'open' | 'in-progress' | 'completed';
  escrow_pubkey: string;
  creator_wallet: string;
  player2_id?: string | null;
  player2_wallet?: string | null;
  creator_choice?: string | null;
  player2_choice?: string | null;
  winner?: string | null;
}

export const OpenGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [joiningGame, setJoiningGame] = useState<string | null>(null);
  const [audio] = useState(new Audio("/sounds/join-game.mp4"));
  const { toast } = useToast();
  const navigate = useNavigate();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [sortBy, setSortBy] = useState<'newest' | 'amount'>('newest');
  const [showMyGamesOnly, setShowMyGamesOnly] = useState(false);

  useEffect(() => {
    const fetchGames = async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'open')
        .eq('is_demo', false);

      if (error) {
        console.error('Error fetching games:', error);
        return;
      }

      setGames(data || []);
    };

    fetchGames();

    const channel = supabase
      .channel('games_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
        },
        async (payload) => {
          const updatedGame = payload.new as Game;
          
          const username = localStorage.getItem("username");
          if (payload.eventType === 'UPDATE' && 
              updatedGame.creator_id === username && 
              updatedGame.status === 'in-progress' &&
              updatedGame.player2_id) {
            
            await playSound();
            
            toast({
              title: "Player Joined!",
              description: `${updatedGame.player2_id} has joined your game. Click to return to the game.`,
              action: <Button 
                variant="outline" 
                onClick={() => {
                  playSound();
                  window.location.href = `/game?mode=multiplayer&gameId=${updatedGame.id}`;
                }}
              >
                Return to Game
              </Button>
            });
          }
          
          fetchGames();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const playSound = async () => {
    try {
      audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      console.log("Audio playback failed:", error);
    }
  };

  const handleCopyGameLink = (gameId: string) => {
    const gameUrl = `${window.location.origin}/game?mode=multiplayer&gameId=${gameId}`;
    navigator.clipboard.writeText(gameUrl);
    toast({
      title: "Link Copied!",
      description: "Share this link with your friends to invite them to play.",
    });
  };

  const handleJoinGame = async (game: Game) => {
    const username = localStorage.getItem("username");
    if (!username) {
      toast({
        title: "Registration required",
        description: "Please register before joining a game",
        variant: "destructive",
      });
      return;
    }

    if (game.creator_id === username) {
      navigate(`/game?mode=multiplayer&gameId=${game.id}`);
      return;
    }

    if (!connected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet before joining a game",
        variant: "destructive",
      });
      return;
    }

    try {
      setJoiningGame(game.id);

      const escrowPubkey = new PublicKey(game.escrow_pubkey);
      const lamports = game.amount * LAMPORTS_PER_SOL;

      const transaction = new Transaction();
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: escrowPubkey,
          lamports,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature);

      const { error: updateError } = await supabase
        .from('games')
        .update({
          status: 'in-progress',
          player2_id: username,
          player2_wallet: publicKey.toString(),
          player2_choice: null,
          creator_choice: null,
        })
        .eq('id', game.id);

      if (updateError) throw updateError;

      const audio = new Audio("/sounds/join-game.mp4");
      audio.play();

      toast({
        title: "Game Joined!",
        description: "You have successfully joined the game",
      });

      navigate(`/game?mode=multiplayer&gameId=${game.id}`);
    } catch (error) {
      console.error('Error joining game:', error);
      toast({
        title: "Error",
        description: "Failed to join game",
        variant: "destructive",
      });
    } finally {
      setJoiningGame(null);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);

      if (error) throw error;
      
      toast({
        title: "Game Deleted",
        description: "The game has been deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting game:', error);
      toast({
        title: "Error",
        description: "Failed to delete game",
        variant: "destructive",
      });
    }
  };

  const handleEditGame = async (game: Game) => {
    if (!editingGame || !publicKey) return;

    try {
      const additionalAmount = editingGame.amount - game.amount;
      
      if (additionalAmount <= 0) {
        toast({
          title: "Invalid Amount",
          description: "New bet amount must be higher than the current amount",
          variant: "destructive",
        });
        return;
      }

      const additionalLamports = additionalAmount * LAMPORTS_PER_SOL;

      const transaction = new Transaction();
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(game.escrow_pubkey),
          lamports: additionalLamports,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature);

      const { error } = await supabase
        .from('games')
        .update({
          amount: editingGame.amount
        })
        .eq('id', game.id);

      if (error) throw error;

      setEditingGame(null);
      
      toast({
        title: "Game Updated",
        description: `Successfully updated game and transferred ${additionalAmount} SOL to escrow`,
      });
    } catch (error) {
      console.error('Error updating game:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update game and transfer funds. Please try again.",
        variant: "destructive",
      });
    }
  };

  const username = localStorage.getItem("username");

  const filteredGames = games
    .filter(game => {
      if (showMyGamesOnly) {
        return game.creator_id === username;
      }
      return game.creator_id.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'amount') {
        return b.amount - a.amount;
      }
      return b.id.localeCompare(a.id);
    });

  return (
    <Card className="border-slate-800">
      <CardHeader>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <CardTitle className="font-game text-lg text-primary">
              Open Games
              <Badge variant="secondary" className="ml-2">
                {filteredGames.length}
              </Badge>
            </CardTitle>
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Search by creator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[200px]"
              />
              <Button variant="ghost" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                variant={sortBy === 'newest' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('newest')}
              >
                <Clock className="w-4 h-4 mr-1" />
                Newest
              </Button>
              <Button
                variant={sortBy === 'amount' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('amount')}
              >
                <Coins className="w-4 h-4 mr-1" />
                Highest Bet
              </Button>
            </div>
            <Button
              variant={showMyGamesOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowMyGamesOnly(!showMyGamesOnly)}
            >
              {showMyGamesOnly ? 'Show All Games' : 'My Games'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredGames.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">
              {showMyGamesOnly 
                ? "You haven't created any games yet." 
                : searchQuery 
                  ? "No games found for this creator" 
                  : "No open games available."}
            </p>
            {!showMyGamesOnly && (
              <Button
                onClick={() => {
                  const createBetElement = document.querySelector('.create-bet-section');
                  createBetElement?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Create New Game
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGames.map((game) => (
              <TooltipProvider key={game.id}>
                <Card className="p-4 border-slate-700 hover:border-primary/50 transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-game text-primary">{game.creator_id}'s Game</p>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="cursor-help">
                              <Coins className="w-3 h-3 mr-1" />
                              {game.amount} SOL
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Required bet amount to join</p>
                          </TooltipContent>
                        </Tooltip>
                        {game.creator_id === username && (
                          <Badge variant="secondary">Your Game</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {game.creator_id === username && (
                        <>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setEditingGame(game)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Game</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Bet Amount (SOL)</Label>
                                  <Input
                                    type="number"
                                    min={game.amount}
                                    step="0.1"
                                    value={editingGame?.amount}
                                    onChange={(e) =>
                                      setEditingGame(prev => prev ? {
                                        ...prev,
                                        amount: parseFloat(e.target.value)
                                      } : null)
                                    }
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    className="flex-1"
                                    onClick={() => {
                                      playSound();
                                      editingGame && handleEditGame(game);
                                    }}
                                  >
                                    Save Changes
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => handleCopyGameLink(game.id)}
                                  >
                                    Share Link
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Tooltip>
                            <TooltipTrigger>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => handleDeleteGame(game.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete game</p>
                            </TooltipContent>
                          </Tooltip>
                        </>
                      )}
                      <Button 
                        onClick={() => {
                          playSound();
                          handleJoinGame(game);
                        }}
                        disabled={joiningGame === game.id}
                        className="min-w-[100px]"
                      >
                        {joiningGame === game.id ? 'Joining...' : game.creator_id === username ? 'View Game' : 'Join Game'}
                      </Button>
                    </div>
                  </div>
                </Card>
              </TooltipProvider>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
