
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface PlayerScore {
  username: string;
  points: number;
  games_won: number;
  wallet_address?: string;
}

export const LeaderBoard = ({ isDemo = false }: { isDemo?: boolean }) => {
  const [leaders, setLeaders] = useState<PlayerScore[]>([]);

  useEffect(() => {
    const fetchLeaders = async () => {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('username, points, games_won, wallet_address')
        .eq('is_demo', isDemo)
        .order('points', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching leaderboard:', error);
        return;
      }

      setLeaders(data || []);
    };

    fetchLeaders();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('leaderboard_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leaderboard',
          filter: `is_demo=eq.${isDemo}`,
        },
        () => {
          fetchLeaders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isDemo]);

  return (
    <Card className="border-slate-800 bg-black/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="font-game text-lg text-primary animate-glow">
          {isDemo ? "Demo Leaderboard" : "Top Players"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-game text-primary">Rank</TableHead>
              <TableHead className="font-game text-primary">Player</TableHead>
              <TableHead className="font-game text-primary text-right">
                Points
              </TableHead>
              <TableHead className="font-game text-primary text-right">
                Wins
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaders.map((player, index) => (
              <TableRow
                key={player.username}
                className="hover:bg-accent/10 transition-colors"
              >
                <TableCell className="font-game">#{index + 1}</TableCell>
                <TableCell>{player.username}</TableCell>
                <TableCell className="text-right">{player.points} SOL</TableCell>
                <TableCell className="text-right">{player.games_won}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
