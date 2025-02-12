import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <Layout>
      <main className="container py-32 text-center">
        <h1 className="text-4xl font-game text-primary mb-8 animate-glow">404 - Page Not Found</h1>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist.
        </p>
        <Link to="/">
          <Button className="font-game">Return Home</Button>
        </Link>
      </main>
    </Layout>
  );
};

export default NotFound;