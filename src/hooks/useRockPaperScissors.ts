
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { PROGRAM_ID } from '../idl/rockPaperScissors';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

export const useRockPaperScissors = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { toast } = useToast();

  // Function to create a bet
  const createBet = async (betAmount: number, maxPlayers: number) => {
    if (!publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create a bet",
        variant: "destructive",
      });
      return;
    }

    try {
      const username = localStorage.getItem("username");
      if (!username) {
        toast({
          title: "Username required",
          description: "Please set a username before creating a bet",
          variant: "destructive",
        });
        return;
      }

      // Generate escrow account
      const escrow = Keypair.generate();
      
      // Calculate amount in lamports
      const lamports = betAmount * 1000000000; // Convert SOL to lamports

      // Create transaction to transfer funds to escrow
      const transaction = new Transaction();
      
      // Add instruction to create escrow account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: escrow.publicKey,
          lamports: lamports,
          space: 0,
          programId: SystemProgram.programId,
        })
      );

      // Send and confirm transaction
      const signature = await sendTransaction(transaction, connection, {
        signers: [escrow],
      });
      await connection.confirmTransaction(signature);

      // Create game record in database
      const { data: game, error } = await supabase
        .from('games')
        .insert([
          {
            creator_id: username,
            creator_wallet: publicKey.toString(),
            amount: betAmount,
            status: 'open',
            escrow_pubkey: escrow.publicKey.toString(),
            total_pot: betAmount,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Bet Created",
        description: `Successfully created bet with ${betAmount} SOL`,
      });

      return game.id;
    } catch (error) {
      console.error('Error creating bet:', error);
      toast({
        title: "Error",
        description: "Failed to create bet",
        variant: "destructive",
      });
    }
  };

  // Function to join a bet
  const joinBet = async (gameId: string, betAmount: number) => {
    if (!publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to join a bet",
        variant: "destructive",
      });
      return;
    }

    try {
      const username = localStorage.getItem("username");
      if (!username) {
        toast({
          title: "Username required",
          description: "Please set a username before joining a bet",
          variant: "destructive",
        });
        return;
      }

      // Fetch game details
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) throw gameError;

      if (game.status !== 'open') {
        toast({
          title: "Game unavailable",
          description: "This game is no longer available to join",
          variant: "destructive",
        });
        return;
      }

      // Verify bet amount matches creator's bet
      if (game.amount !== betAmount) {
        toast({
          title: "Invalid bet amount",
          description: "Your bet must match the creator's bet amount",
          variant: "destructive",
        });
        return;
      }

      // Transfer player's bet to escrow
      const escrowPubkey = new PublicKey(game.escrow_pubkey);
      const lamports = betAmount * 1000000000; // Convert SOL to lamports

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

      // Update game record
      const { error: updateError } = await supabase
        .from('games')
        .update({
          status: 'in-progress',
          player2_id: username,
          player2_wallet: publicKey.toString(),
          total_pot: game.total_pot + betAmount,
          player2_choice: null,
          creator_choice: null,
        })
        .eq('id', gameId);

      if (updateError) throw updateError;

      toast({
        title: "Bet Joined",
        description: `Successfully joined bet with ${betAmount} SOL`,
      });

      return true;
    } catch (error) {
      console.error('Error joining bet:', error);
      toast({
        title: "Error",
        description: "Failed to join bet",
        variant: "destructive",
      });
      return false;
    }
  };

  // Function to resolve the bet and send funds to the winner
  const resolveBet = async (gameId: string, winnerUsername: string) => {
    try {
      // Fetch game details
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) throw gameError;

      // Determine winner's wallet address
      const winnerWallet = winnerUsername === game.creator_id 
        ? game.creator_wallet 
        : game.player2_wallet;

      if (!winnerWallet) {
        throw new Error('Winner wallet address not found');
      }

      // Transfer total pot to winner
      const escrowPubkey = new PublicKey(game.escrow_pubkey);
      const winnerPubkey = new PublicKey(winnerWallet);
      const lamports = game.total_pot * 1000000000; // Convert SOL to lamports

      const transaction = new Transaction();
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: escrowPubkey,
          toPubkey: winnerPubkey,
          lamports,
        })
      );

      // This will be signed by the escrow account
      const escrowKeypair = Keypair.fromSecretKey(
        Buffer.from(game.escrow_secret ?? '', 'base64')
      );

      // Send and confirm transaction
      const signature = await connection.sendTransaction(transaction, [escrowKeypair]);
      await connection.confirmTransaction(signature);

      // Update game status
      const { error: updateError } = await supabase
        .from('games')
        .update({
          status: 'completed',
          winner: winnerUsername,
        })
        .eq('id', gameId);

      if (updateError) throw updateError;

      toast({
        title: "Game Completed",
        description: `${game.total_pot} SOL has been transferred to the winner!`,
      });

      return true;
    } catch (error) {
      console.error('Error resolving bet:', error);
      toast({
        title: "Error",
        description: "Failed to resolve bet and transfer funds",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    createBet,
    joinBet,
    resolveBet,
  };
};
