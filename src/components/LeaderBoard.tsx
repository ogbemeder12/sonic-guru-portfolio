import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useState } from "react";

interface PlayerScore {
  username: string;
  points: number;
  gamesWon: number;
}

export const LeaderBoard = () => {
  const [leaders, setLeaders] = useState<PlayerScore[]>([]);

  useEffect(() => {
    // Get scores from localStorage
    const games = JSON.parse(localStorage.getItem("games") || "[]");
    const players = new Map<string, PlayerScore>();

    games.forEach((game: any) => {
      if (game.winner) {
        const player = players.get(game.winner) || {
          username: game.winner,
          points: 0,
          gamesWon: 0,
        };
        player.points += game.amount * 2; // Winner gets double the bet amount
        player.gamesWon += 1;
        players.set(game.winner, player);
      }
    });

    // Convert to array and sort by points
    const leaderArray = Array.from(players.values()).sort(
      (a, b) => b.points - a.points
    );
    setLeaders(leaderArray);
  }, []);

  return (
    <Card className="border-slate-800 bg-black/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="font-game text-lg text-primary animate-glow">
          Top Players
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
                <TableCell className="text-right">{player.gamesWon}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};