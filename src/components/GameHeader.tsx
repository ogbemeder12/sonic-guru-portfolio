
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Wallet, ArrowLeft, ArrowRight, Gamepad2, LogOut } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { supabase } from "@/lib/supabase";

export const GameHeader = () => {
  const [username, setUsername] = useState<string | null>(null);
  const { connected } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    setUsername(storedUsername);
  }, []);

  useEffect(() => {
    setCanGoBack(location.key !== "default");
    setCanGoForward(window.history.state && window.history.state.idx < window.history.length - 1);
  }, [location]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("username");
      setUsername(null);
      toast({
        title: "Logged out successfully",
        description: "Come back soon!",
      });
      navigate("/");
    } catch (error) {
      console.error('Error logging out:', error);
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="border-b mb-8 pb-3 border-accent/20 pt-5 bg-gradient-to-r from-slate-900 to-slate-800">
      <div className="flex flex-col md:flex-row sm:flex-col lg:flex-row xl:flex-row justify-between items-center gap-6 container">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (canGoBack) {
                  navigate(-1);
                }
              }}
              disabled={!canGoBack}
              className="hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-5 h-5 text-accent" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (canGoForward) {
                  navigate(1);
                }
              }}
              disabled={!canGoForward}
              className="hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowRight className="w-5 h-5 text-accent" />
            </Button>
          </div>
          <h1 className="text-xl font-game text-primary animate-glow">
            SolThrow
          </h1>
          {username && (
            <p className="text-sm text-muted-foreground">
              Playing as <span className="text-primary font-game">{username}</span>
            </p>
          )}
        </div>

        {/* Right Section */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <Link to="/demo">
            <Button variant="outline" className="font-game gap-2 bg-accent/10 border-accent hover:bg-accent/20">
              <Gamepad2 className="w-4 h-4" />
              Play Demo
            </Button>
          </Link>
          <WalletMultiButton />
          {username && (
            <Button 
              variant="ghost" 
              className="font-game gap-2 hover:bg-red-500/10 hover:text-red-500"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
