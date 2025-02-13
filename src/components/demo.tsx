
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleDot, Square, Scissors, Star } from "lucide-react";
import { Layout } from "../components/Layout";
import { LeaderBoard } from "./LeaderBoard";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

type Choice = "rock" | "paper" | "scissors";

export const DemoGamePlay = () => {
    const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
    const [computerChoice, setComputerChoice] = useState<Choice | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [showStar, setShowStar] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const audio = new Audio("/sounds/join-game.mp4");
        audio.loop = true;
        audio.play().catch((error) => console.log("Autoplay prevented:", error));

        return () => {
            audio.pause();
            audio.currentTime = 0;
        };
    }, []);

    const updateLeaderboard = async (winner: string) => {
        const { data: existingUser, error: fetchError } = await supabase
            .from('leaderboard')
            .select('*')
            .eq('username', winner)
            .eq('is_demo', true)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching user:', fetchError);
            return;
        }

        const points = 10; // Fixed 10 points for demo wins
        const gamesWon = 1;

        if (existingUser) {
            const { error: updateError } = await supabase
                .from('leaderboard')
                .update({
                    points: existingUser.points + points,
                    games_won: existingUser.games_won + gamesWon,
                })
                .eq('id', existingUser.id);

            if (updateError) {
                console.error('Error updating leaderboard:', updateError);
            }
        } else {
            const { error: insertError } = await supabase
                .from('leaderboard')
                .insert([
                    {
                        username: winner,
                        points: points,
                        games_won: gamesWon,
                        is_demo: true,
                    },
                ]);

            if (insertError) {
                console.error('Error inserting into leaderboard:', insertError);
            }
        }
    };

    const getComputerChoice = (): Choice => {
        const choices: Choice[] = ["rock", "paper", "scissors"];
        return choices[Math.floor(Math.random() * choices.length)];
    };

    const determineWinner = (player: Choice, computer: Choice) => {
        if (player === computer) return "It's a tie!";
        if (
            (player === "rock" && computer === "scissors") ||
            (player === "paper" && computer === "rock") ||
            (player === "scissors" && computer === "paper")
        ) {
            return "You win!";
        }
        return "Computer wins!";
    };

    const handleChoice = async (choice: Choice) => {
        setPlayerChoice(choice);
        const compChoice = getComputerChoice();
        setComputerChoice(compChoice);
        const gameResult = determineWinner(choice, compChoice);
        setResult(gameResult);

        if (gameResult !== "It's a tie!") {
            setShowStar(true);
            const winner = gameResult === "You win!" ? 
                localStorage.getItem("username") || "Anonymous" : 
                "Computer";
            
            await updateLeaderboard(winner);
            
            toast({
                title: `${winner} wins!`,
                description: `${winner} earned 10 points! 🌟`,
            });

            // Reset star animation after 2 seconds
            setTimeout(() => {
                setShowStar(false);
            }, 2000);
        }
    };

    const playAgain = () => {
        setPlayerChoice(null);
        setComputerChoice(null);
        setResult(null);
        setShowStar(false);
    };

    return (
        <Layout>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <Card className="w-10/12 mt-[100px] m-auto border-accent/20 bg-gradient-to-b from-slate-900 to-slate-800 shadow-2xl">
                        <CardHeader className="border-b border-accent/10 mt-5">
                            <CardTitle className="font-game text-lg text-primary animate-glow text-center">
                                {result ? "Game Result" : "Choose Your Weapon"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            {!result ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                                    <Button
                                        variant="outline"
                                        className="flex flex-col items-center p-8 hover:bg-accent hover:text-accent-foreground transition-all transform hover:scale-105 bg-slate-800/50 border-accent/20"
                                        onClick={() => handleChoice("rock")}
                                    >
                                        <CircleDot className="w-12 h-12 mb-2 animate-glow" />
                                        <span className="font-game">Rock</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex flex-col items-center p-8 hover:bg-accent hover:text-accent-foreground transition-all transform hover:scale-105 bg-slate-800/50 border-accent/20"
                                        onClick={() => handleChoice("paper")}
                                    >
                                        <Square className="w-12 h-12 mb-2 animate-glow" />
                                        <span className="font-game">Paper</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex flex-col items-center p-8 hover:bg-accent hover:text-accent-foreground transition-all transform hover:scale-105 bg-slate-800/50 border-accent/20"
                                        onClick={() => handleChoice("scissors")}
                                    >
                                        <Scissors className="w-12 h-12 mb-2 animate-glow" />
                                        <span className="font-game">Scissors</span>
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-8 text-center relative">
                                    {showStar && (
                                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                            <Star 
                                                className="w-32 h-32 text-yellow-400 animate-[scale-in_0.5s_ease-out,fade-out_0.5s_ease-in_1.5s]" 
                                                fill="currentColor"
                                            />
                                        </div>
                                    )}
                                    <div className="flex flex-col md:flex-row justify-between gap-8">
                                        <div className={`space-y-4 p-6 bg-slate-800/30 rounded-lg border border-accent/10 transition-all duration-500 ${result === "You win!" ? "scale-110 border-yellow-400" : ""}`}>
                                            <p className="text-muted-foreground font-game">Your Choice</p>
                                            <p className="text-2xl font-game text-primary animate-glow">{playerChoice}</p>
                                        </div>
                                        <div className={`space-y-4 p-6 bg-slate-800/30 rounded-lg border border-accent/10 transition-all duration-500 ${result === "Computer wins!" ? "scale-110 border-yellow-400" : ""}`}>
                                            <p className="text-muted-foreground font-game">Computer's Choice</p>
                                            <p className="text-2xl font-game text-primary animate-glow">{computerChoice}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <p className={`text-3xl font-game animate-glow ${result === "You win!" ? "text-yellow-400" : result === "Computer wins!" ? "text-red-400" : "text-accent"}`}>
                                            {result}
                                        </p>
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
                </div>
                <div>
                    <LeaderBoard isDemo={true} />
                </div>
            </div>
        </Layout>
    );
};
