import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const UserRegistration = () => {
  const [username, setUsername] = useState("");
  const { toast } = useToast();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) {
      toast({
        title: "Invalid username",
        description: "Username must be at least 3 characters long",
        variant: "destructive",
      });
      return;
    }
    // Store username in localStorage for demo purposes
    localStorage.setItem("username", username);
    window.location.reload(); // Refresh to update header
    toast({
      title: "Registration successful",
      description: "Welcome " + username + "!",
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle className="text-center font-game text-primary">Register to Play</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-slate-900"
            />
          </div>
          <Button type="submit" className="w-full font-game">
            Register
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};