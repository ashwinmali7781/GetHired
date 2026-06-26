import { Outlet } from "react-router-dom";
import { AppNavbar } from "@/components/AppNavbar";
import { useSyncProfile } from "@/hooks/use-sync-profile";
import { motion } from "framer-motion";

export const AppLayout = () => {
  useSyncProfile();
  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <motion.main
        className="container py-6 sm:py-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <Outlet />
      </motion.main>
    </div>
  );
};
