import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Home, ArrowLeft, Sparkles } from "lucide-react";

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-40 top-20 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[100px]" />
      <div className="absolute -right-40 bottom-20 h-[400px] w-[400px] rounded-full bg-accent/5 blur-[100px]" />
    </div>
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative z-10 space-y-6"
    >
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl gradient-primary shadow-elevated animate-float">
        <img src="/logo.svg" alt="GetHired" className="h-10 w-10" />
      </div>
      <div>
        <h1 className="text-8xl font-black text-gradient leading-none">404</h1>
        <p className="mt-3 text-xl font-semibold text-foreground">Page not found</p>
        <p className="mt-2 max-w-sm mx-auto text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/">
          <Button className="gap-2 gradient-primary text-white shadow-sm">
            <Home className="h-4 w-4" /> Go Home
          </Button>
        </Link>
        <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
      </div>
    </motion.div>
  </div>
);

export default NotFound;
