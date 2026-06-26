import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },

  worker: { format: "es" },

  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Function form — compatible with manualChunks
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@clerk"))           return "vendor-clerk";
            if (id.includes("@supabase"))        return "vendor-supabase";
            if (id.includes("pdfjs-dist"))       return "vendor-pdfjs";
            if (id.includes("@monaco-editor") || id.includes("monaco-editor")) return "vendor-monaco";
            if (id.includes("recharts") || id.includes("d3-") || id.includes("victory")) return "vendor-charts";
            if (id.includes("framer-motion"))    return "vendor-motion";
            if (id.includes("react-dom") || id.includes("react-router")) return "vendor-react";
            if (id.includes("lucide-react"))     return "vendor-icons";
            return "vendor";
          }
        },
      },
    },
  },

  envPrefix: "VITE_",
});
