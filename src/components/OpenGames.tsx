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

interface Game {
  id: string;
  creator: string;
  amount: number;
  maxPlayers: number;
  currentPlayers: string[];
  status: 'open' | 'in-progress' | 'completed';
  escrowPubkey: string;
}

export const OpenGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  useEffect(() => {
    const loadGames = () => {
      const storedGames = JSON.parse(localStorage.getItem("games") || "[]");
      setGames(storedGames.filter((game: Game) => game.status === 'open'));
    };

    loadGames();
    const interval = setInterval(loadGames, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinGame = (game: Game) => {
    const username = localStorage.getItem("username");
    if (!username) {
      toast({
        title: "Registration required",
        description: "Please register before joining a game",
        variant: "destructive",
      });
      return;
    }

    // If the user is the creator of the game
    if (game.creator === username) {
      navigate(`/game?mode=multiplayer&gameId=${game.id}`);
      return;
    }

    if (!connected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet before joining a game",
        variant: "destructive",
      });
      return;
    }

    if (game.currentPlayers.includes(username)) {
      toast({
        title: "Already joined",
        description: "You are already in this game",
        variant: "destructive",
      });
      return;
    }

    const allGames = JSON.parse(localStorage.getItem("games") || "[]");
    const updatedGames = allGames.map((g: Game) => {
      if (g.id === game.id) {
        const updatedPlayers = [...g.currentPlayers, username];
        return {
          ...g,
          currentPlayers: updatedPlayers,
          status: updatedPlayers.length === g.maxPlayers ? 'in-progress' : 'open'
        };
      }
      return g;
    });

    localStorage.setItem("games", JSON.stringify(updatedGames));
    const audio = new Audio("/sounds/join-game.mp4");
    audio.play();

    toast({
      title: "Game Joined!",
      description: "You have successfully joined the game",
    });

    navigate(`/game?mode=multiplayer&gameId=${game.id}`);
  };

  const handleDeleteGame = (gameId: string) => {
    const allGames = JSON.parse(localStorage.getItem("games") || "[]");
    const updatedGames = allGames.filter((g: Game) => g.id !== gameId);
    localStorage.setItem("games", JSON.stringify(updatedGames));
    
    toast({
      title: "Game Deleted",
      description: "The game has been deleted successfully",
    });
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
          toPubkey: new PublicKey(game.escrowPubkey),
          lamports: additionalLamports,
        })
      );

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature);

      // Update game in localStorage
      const allGames = JSON.parse(localStorage.getItem("games") || "[]");
      const updatedGames = allGames.map((g: Game) => {
        if (g.id === game.id) {
          return {
            ...g,
            amount: editingGame.amount,
            maxPlayers: editingGame.maxPlayers || g.maxPlayers,
          };
        }
        return g;
      });

      localStorage.setItem("games", JSON.stringify(updatedGames));
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
    game.creator.toLowerCase().includes(searchQuery.toLowerCase())
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
                    <p className="font-game text-primary">{game.creator}'s Game</p>
                    <p className="text-sm text-muted-foreground">
                      {game.currentPlayers.length}/{game.maxPlayers} Players
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {game.amount} SOL
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {game.creator === username && (
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
                              <div className="space-y-2">
                                <Label>Max Players</Label>
                                <Input
                                  type="number"
                                  value="2"
                                  disabled
                                  className="bg-slate-800/50 opacity-50"
                                />
                              </div>
                              <Button
                                className="w-full"
                                onClick={() => editingGame && handleEditGame(editingGame)}
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
                      disabled={game.currentPlayers.length === game.maxPlayers}
                    >
                      {game.creator === username ? 'View Game' : 'Join Game'}
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
