import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LayoutDashboard, Code, User, LogOut, Menu, X,
  Trophy, Sun, Moon, Mic, ScanText, Flame, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";

function calcStreak(history) {
  if (!history.length) return 0;
  const days = [...new Set(history.map((h) => new Date(h.created_at).toDateString()))];
  days.sort((a, b) => new Date(b) - new Date(a));
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const day of days) {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((cursor - d) / 86400000);
    if (diff <= 1) { streak++; cursor = d; }
    else break;
  }
  return streak;
}

const LINKS = [
  { to: "/dashboard",       label: "Dashboard",   icon: LayoutDashboard },
  { to: "/practice",        label: "Practice",    icon: Code },
  { to: "/resume-analyzer", label: "Resume",      icon: ScanText },
  { to: "/voice-interview", label: "Voice AI",    icon: Mic },
  { to: "/contest",         label: "Contest",      icon: Trophy },
  { to: "/leaderboard",     label: "Leaderboard", icon: Trophy },
  { to: "/profile",         label: "Profile",     icon: User },
];

export const AppNavbar = () => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const supabase = useSupabase();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    supabase.from("practice_history").select("created_at").eq("user_id", user.id)
      .then(({ data }) => setStreak(calcStreak(data || [])));
  }, [user, supabase]);

  // Close mobile menu on route change
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const isActive = (p) => location.pathname === p;
  const initials = user?.displayName?.slice(0, 2).toUpperCase() || "GH";

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled ? "glass shadow-sm" : "bg-background/80 backdrop-blur-sm border-b border-border/50"
    }`}>
      <div className="container flex h-14 items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary shadow-sm group-hover:shadow-elevated transition-shadow">
            <img src="/logo.svg" alt="GetHired" className="h-5 w-5" />
          </div>
          <span className="text-[15px] font-bold tracking-tight">
            Get<span className="text-gradient">Hired</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-0.5 md:flex">
          {LINKS.map((link) => {
            const active = isActive(link.to);
            return (
              <Link key={link.to} to={link.to}>
                <div className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-150 ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent/5 hover:text-foreground"
                }`}>
                  <link.icon className="h-3.5 w-3.5" />
                  {link.label}
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-lg bg-primary/10 -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="hidden items-center gap-2 md:flex">
          {streak > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-orange-500">
              <Flame className="h-3.5 w-3.5" /> {streak}d
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
            {theme === "dark"
              ? <Sun className="h-4 w-4" />
              : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}
            className="gap-1.5 text-[13px] text-muted-foreground hover:text-foreground rounded-lg h-8">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
          <Link to="/profile">
            <Avatar className="h-7 w-7 cursor-pointer ring-2 ring-transparent hover:ring-primary/30 transition-all">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="text-[10px] font-bold gradient-primary text-white">{initials}</AvatarFallback>
            </Avatar>
          </Link>
        </div>

        {/* Mobile right */}
        <div className="flex items-center gap-1.5 md:hidden">
          {streak > 0 && (
            <div className="flex items-center gap-1 rounded-full border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 text-xs font-semibold text-orange-500">
              <Flame className="h-3 w-3" /> {streak}
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => setMobileOpen((v) => !v)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-t border-border bg-card md:hidden"
          >
            <div className="flex flex-col gap-1 p-3">
              {LINKS.map((link) => (
                <Link key={link.to} to={link.to}>
                  <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive(link.to)
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}>
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </div>
                </Link>
              ))}
              <div className="mt-2 border-t border-border pt-2">
                <button onClick={signOut}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
