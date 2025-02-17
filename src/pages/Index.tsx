
import { CreateBet } from "@/components/CreateBet";
import { OpenGames } from "@/components/OpenGames";
import { UserRegistration } from "@/components/UserRegistration";
import { Layout } from "@/components/Layout";
import { useEffect, useState } from "react";

const Index = () => {
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    const username = localStorage.getItem("username");
    setIsRegistered(!!username);
  }, []);

  return (
    <Layout>
      <main className="container py-8">
        {!isRegistered ? (
          <UserRegistration />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <OpenGames />
            <CreateBet />
          </div>
        )}
      </main>
    </Layout>
  );
};

export default Index;
