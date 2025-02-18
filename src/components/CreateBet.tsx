
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
import { supabase } from "@/lib/supabase";

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
  const [showConnectWallet, setShowConnectWallet] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
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
      const lamports = parseFloat(amount) * LAMPORTS_PER_SOL;

      const balance = await connection.getBalance(publicKey);
      if (balance < lamports) {
        toast({
          title: "Insufficient balance",
          description: `Your wallet has ${balance/LAMPORTS_PER_SOL} SOL but needs ${lamports/LAMPORTS_PER_SOL} SOL`,
          variant: "destructive",
        });
        return;
      }

      const escrowKeypair = Keypair.generate();
      const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(0);
      
      const transaction = new Transaction();
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = publicKey;

      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: escrowKeypair.publicKey,
          lamports: rentExemptionAmount + lamports,
          space: 0,
          programId: SystemProgram.programId,
        })
      );

      try {
        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 5,
          signers: [escrowKeypair],
        });
        
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`);
        }

        // Create game in Supabase
        const { data: game, error: createError } = await supabase
          .from('games')
          .insert([
            {
              creator_id: username,
              creator_wallet: publicKey.toString(),
              amount: parseFloat(amount),
              status: 'open',
              is_demo: false,
              escrow_pubkey: escrowKeypair.publicKey.toString(),
            }
          ])
          .select()
          .single();

        if (createError) {
          throw new Error(`Failed to create game: ${createError.message}`);
        }

        const audio = new Audio("/sounds/create-game.mp3");
        audio.play();

        toast({
          title: "Game Created!",
          description: `Successfully created game and transferred ${amount} SOL`,
        });

        navigate(`/game?mode=multiplayer&gameId=${game.id}`);
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
      <Card className="border-slate-800 create-bet-section">
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
