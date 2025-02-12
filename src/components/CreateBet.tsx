import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, SystemProgram, Transaction, PublicKey, Keypair } from '@solana/web3.js';
import { GameInstructions } from "./GameInstructions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface Game {
  id: string;
  creator: string;
  creatorWallet: string;
  amount: number;
  maxPlayers: number;
  currentPlayers: string[];
  status: 'open' | 'in-progress' | 'completed';
  escrowPubkey: string;
}

export const CreateBet = () => {
  const [amount, setAmount] = useState<string>('0.1');
  const [showWaitDialog, setShowWaitDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showConnectWallet, setShowConnectWallet] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Starting game creation process...");
    
    if (!connected || !publicKey) {
      console.log("Wallet not connected, showing connect wallet dialog");
      setShowConnectWallet(true);
      return;
    }

    const username = localStorage.getItem("username");
    if (!username) {
      console.log("Username check failed");
      toast({
        title: "Registration required",
        description: "Please register before creating a game",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      console.log("Converting amount to lamports...");
      const lamports = parseFloat(amount) * LAMPORTS_PER_SOL;

      console.log("Checking wallet balance...");
      const balance = await connection.getBalance(publicKey);
      console.log("Current balance:", balance/LAMPORTS_PER_SOL, "SOL");
      console.log("Required amount:", lamports/LAMPORTS_PER_SOL, "SOL");
      
      if (balance < lamports) {
        console.log("Insufficient balance");
        toast({
          title: "Insufficient balance",
          description: `Your wallet has ${balance/LAMPORTS_PER_SOL} SOL but needs ${lamports/LAMPORTS_PER_SOL} SOL`,
          variant: "destructive",
        });
        return;
      }

      console.log("Creating escrow account...");
      const escrowKeypair = Keypair.generate();
      const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(0);
      
      const transaction = new Transaction();
      
      // Add recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Create escrow account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: escrowKeypair.publicKey,
          lamports: rentExemptionAmount + lamports, // Rent exemption + game amount
          space: 0,
          programId: SystemProgram.programId,
        })
      );

      console.log("Sending transaction...");
      try {
        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 5,
          signers: [escrowKeypair], // Include the escrow keypair as a signer
        });
        console.log("Transaction signature:", signature);
        
        console.log("Confirming transaction...");
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`);
        }
        
        console.log("Transaction confirmed");
        console.log("Escrow public key:", escrowKeypair.publicKey.toString());

        const newGame: Game = {
          id: Date.now().toString(),
          creator: username,
          creatorWallet: publicKey.toString(),
          amount: parseFloat(amount),
          maxPlayers: 2,
          currentPlayers: [username],
          status: 'open',
          escrowPubkey: escrowKeypair.publicKey.toString(),
        };

        console.log("Saving game to localStorage:", newGame);
        const existingGames = JSON.parse(localStorage.getItem("games") || "[]");
        localStorage.setItem("games", JSON.stringify([...existingGames, newGame]));

        const audio = new Audio("/sounds/create-game.mp3");
        audio.play();

        toast({
          title: "Game Created!",
          description: `Successfully created game and transferred ${amount} SOL`,
        });

        navigate("/game?mode=multiplayer&gameId=" + newGame.id);
      } catch (txError) {
        console.error("Transaction error:", txError);
        throw new Error(`Transaction failed: ${txError.message}`);
      }
    } catch (error) {
      console.error('Detailed error creating game:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create game. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Card className="border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-game text-lg text-primary">Create Bet</CardTitle>
          <GameInstructions />
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="amount">Bet Amount (SOL)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.1"
                placeholder="0.1"
                className="bg-slate-900"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="players">Number of Players</Label>
              <Input
                id="players"
                type="number"
                value="2"
                disabled
                className="bg-slate-900 opacity-50"
              />
            </div>
            {!connected ? (
              <div className="flex justify-center">
                <WalletMultiButton />
              </div>
            ) : (
              <Button 
                className="w-full font-game" 
                type="submit"
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create Game"}
              </Button>
            )}
          </form>
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

      <Dialog open={showConnectWallet} onOpenChange={setShowConnectWallet}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Wallet</DialogTitle>
            <DialogDescription>
              Please connect your wallet to create a game.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-4">
            <WalletMultiButton />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
