import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, Keypair, TransactionInstruction } from '@solana/web3.js';
import { PROGRAM_ID } from '../idl/rockPaperScissors'; // Adjust according to your program
import { useToast } from '@/components/ui/use-toast';

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
      const betId = Date.now();
      const programId = new PublicKey(PROGRAM_ID);

      // Generate a new public key for the escrow account
      const escrow = Keypair.generate();

      // Create a transaction to create the escrow account
      const transaction = new Transaction();

      // Add instruction to create the escrow account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: escrow.publicKey,  // Use the new generated escrow public key
          lamports: await connection.getMinimumBalanceForRentExemption(0), // Rent-exemption for the escrow account
          space: 100,  // Adjust based on the structure of your bet state (max players, bet amount, etc.)
          programId: programId,
        })
      );

      // Create the instruction to initialize the bet data in the escrow account
      const betData = Buffer.from(
        JSON.stringify({
          betAmount,
          maxPlayers,
          creator: publicKey.toString(),
          betId,
          state: 'WaitingForPlayer', // Initial state (waiting for a second player)
          players: [publicKey.toString()], // Add the creator as the first player
        })
      );

      // Create a TransactionInstruction for your custom program
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: escrow.publicKey, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
        ],
        programId,
        data: betData,
      });

      // Add the custom instruction to the transaction
      transaction.add(instruction);

      // Send the transaction
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature);

      toast({
        title: "Bet Created",
        description: "Your bet has been created successfully",
      });

      return betId;
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
  const joinBet = async (betId: string, choice: number, betAmount: number) => {
    if (!publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to join a bet",
        variant: "destructive",
      });
      return;
    }

    try {
      const programId = new PublicKey(PROGRAM_ID);

      // Fetch the escrow account public key from the bet data (assumed to be set earlier)
      const betAccountPublicKey = new PublicKey(betId);

      // Fetch the current bet state and players from the escrow account
      const betState = await connection.getAccountInfo(betAccountPublicKey);
      if (!betState) {
        toast({
          title: "Bet Not Found",
          description: "The bet you're trying to join does not exist.",
          variant: "destructive",
        });
        return;
      }

      const betData = JSON.parse(betState.data.toString());

      // Check if the game is waiting for a player
      if (betData.state === 'WaitingForPlayer' && betData.players.length >= 1) {
        // If the creator tries to join the game, we prevent it
        if (betData.players[0] === publicKey.toString()) {
          toast({
            title: "Creator Cannot Join",
            description: "You cannot join the game as a creator. Wait for the second player.",
            variant: "destructive",
          });
          return;
        }

        // Proceed with joining the game
        const transaction = new Transaction();
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: betAccountPublicKey, // The bet account, using the same wallet address
            lamports: betAmount, // Amount to join the bet
          })
        );

        // Update the state of the bet to 'GameStarted' and add the new player
        betData.players.push(publicKey.toString());
        betData.state = 'GameStarted';

        const updateInstruction = new TransactionInstruction({
          keys: [
            { pubkey: betAccountPublicKey, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
          ],
          programId,
          data: Buffer.from(JSON.stringify(betData)),
        });

        transaction.add(updateInstruction);

        // Send the transaction
        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature);

        toast({
          title: "Joined Bet",
          description: "You have successfully joined the bet",
        });
      } else {
        toast({
          title: "Bet Already Full",
          description: "The game has already started or the bet is not available.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error joining bet:', error);
      toast({
        title: "Error",
        description: "Failed to join bet",
        variant: "destructive",
      });
    }
  };

  // Function to resolve the bet and send funds to the winner
  const resolveBet = async (betId: string, winnerPublicKey: PublicKey) => {
    if (!publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to resolve the bet",
        variant: "destructive",
      });
      return;
    }

    try {
      const programId = new PublicKey(PROGRAM_ID);

      // Fetch the escrow account public key from the bet data (assumed to be set earlier)
      const escrowPublicKey = new PublicKey(betId); // Assuming betId stores the escrow key

      // Create a new transaction
      const transaction = new Transaction();

      // Add instruction to transfer funds to the winner
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: escrowPublicKey,
          toPubkey: winnerPublicKey, // The public key of the winner
          lamports: 1000, // Amount to send to the winner, adjust as needed
        })
      );

      // Instead of using closeAccount, let's handle fund transfers manually
      // Transfer the remaining balance to the bet creator or whoever should get the funds
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: escrowPublicKey,
          toPubkey: publicKey,  // The destination for remaining funds (creator's wallet)
          lamports: 0,  // Adjust the amount if needed
        })
      );

      // Send the transaction
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature);

      toast({
        title: "Bet Resolved",
        description: "The winner has been paid and escrow account closed",
      });
    } catch (error) {
      console.error('Error resolving bet:', error);
      toast({
        title: "Error",
        description: "Failed to resolve bet",
        variant: "destructive",
      });
    }
  };

  return {
    createBet,
    joinBet,
    resolveBet,
  };
};
