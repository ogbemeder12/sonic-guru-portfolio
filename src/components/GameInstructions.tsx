import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { HelpCircle } from "lucide-react";

export const GameInstructions = () => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="font-game text-primary">How to Play</SheetTitle>
          <SheetDescription>
            <div className="space-y-4 mt-4 text-left">
              <div>
                <h3 className="font-bold mb-2">Creating a Game</h3>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Connect your wallet using the button in the header</li>
                  <li>Enter the amount of SOL you want to bet</li>
                  <li>Click "Create Game" to start a new game</li>
                  <li>Wait for another player to join your game</li>
                </ol>
              </div>
              
              <div>
                <h3 className="font-bold mb-2">Joining a Game</h3>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Browse the list of open games</li>
                  <li>Make sure you have enough SOL in your wallet</li>
                  <li>Click "Join Game" on any available game</li>
                  <li>The game will start automatically when you join</li>
                </ol>
              </div>

              <div>
                <h3 className="font-bold mb-2">Game Rules</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Each game requires exactly 2 players</li>
                  <li>Both players must bet the same amount of SOL</li>
                  <li>The winner takes the entire pot (minus fees)</li>
                  <li>If you create a game, you must wait for another player to join</li>
                </ul>
              </div>
            </div>
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
};