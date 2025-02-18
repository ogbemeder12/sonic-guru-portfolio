import { GamePlay } from "@/components/GamePlay";
import { LeaderBoard } from "@/components/LeaderBoard";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Layout } from "@/components/Layout";
import { supabase } from "@/lib/supabase";

const Game = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isDemo = searchParams.get("mode") === "demo";
  const gameId = searchParams.get("gameId");

  useEffect(() => {
    if (!isDemo && !localStorage.getItem("username")) {
      toast({
        title: "Registration required",
        description: "Please register before playing",
        variant: "destructive",
      });
      navigate("/");
    }

    if (gameId) {
      const channel = supabase
        .channel('game_updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'games',
            filter: `id=eq.${gameId}`,
          },
          (payload) => {
            const game = payload.new as any;
            const username = localStorage.getItem("username");
            
            if (game.status === 'in-progress' && 
                ((game.creator_choice && game.creator_id !== username) || 
                 (game.player2_choice && game.player2_id !== username))) {
              toast({
                title: "Opponent Made Their Choice!",
                description: "Your opponent has made their choice. It's your turn!",
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isDemo, navigate, toast, gameId]);

  return (
    <Layout>
      <main className="container py-8 space-y-8">
        {isDemo && (
          <div className="mb-8 p-4 bg-accent/10 rounded-lg border border-accent/20">
            <p className="text-accent font-game text-sm text-center animate-glow">
              Demo Mode - Play without connecting wallet
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <GamePlay isDemo={isDemo} />
          </div>
          <div>
            <LeaderBoard />
          </div>
        </div>
      </main>
    </Layout>
  );
};

export default Game;
