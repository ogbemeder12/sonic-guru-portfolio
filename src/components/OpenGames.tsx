
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Search } from "lucide-react";
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
  const { toast } = useToast();
  const navigate = useNavigate();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

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

    // Subscribe to real-time updates
    const channel = supabase
      .channel('games_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          const updatedGame = payload.new as Game;
          
          // Show notification when a player joins your game
          const username = localStorage.getItem("username");
          if (payload.eventType === 'UPDATE' && 
              updatedGame.creator_id === username && 
              updatedGame.status === 'in-progress' &&
              updatedGame.player2_id) {
            
            // Play sound effect
            const audio = new Audio("/sounds/join-game.mp4");
            audio.play();
            
            toast({
              title: "Player Joined!",
              description: `${updatedGame.player2_id} has joined your game. Click to return to the game.`,
              action: <Button 
                variant="outline" 
                onClick={() => window.location.href = `/game?mode=multiplayer&gameId=${updatedGame.id}`}
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

      // Transfer SOL to escrow
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

      // Send and confirm transaction
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature);

      // Update game status
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
      // Calculate additional amount needed
      const additionalAmount = editingGame.amount - game.amount;
      
      if (additionalAmount <= 0) {
        toast({
          title: "Invalid Amount",
          description: "New bet amount must be higher than the current amount",
          variant: "destructive",
        });
        return;
      }

      // Convert to lamports
      const additionalLamports = additionalAmount * LAMPORTS_PER_SOL;

      // Create transaction to transfer additional funds
      const transaction = new Transaction();
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(game.escrow_pubkey),
          lamports: additionalLamports,
        })
      );

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature);

      // Update game in Supabase
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

  const filteredGames = games.filter(game => 
    game.creator_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="border-slate-800">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="font-game text-lg text-primary">Open Games</CardTitle>
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
      </CardHeader>
      <CardContent>
        {filteredGames.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {searchQuery ? "No games found for this creator" : "No open games available. Create one!"}
          </p>
        ) : (
          <div className="space-y-4">
            {filteredGames.map((game) => (
              <Card key={game.id} className="p-4 border-slate-700">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-game text-primary">{game.creator_id}'s Game</p>
                    <p className="text-sm text-muted-foreground">
                      {game.amount} SOL
                    </p>
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
                              <Button
                                className="w-full"
                                onClick={() => editingGame && handleEditGame(game)}
                              >
                                Save Changes
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDeleteGame(game.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button 
                      onClick={() => handleJoinGame(game)}
                      disabled={joiningGame === game.id}
                    >
                      {joiningGame === game.id ? 'Joining...' : game.creator_id === username ? 'View Game' : 'Join Game'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
