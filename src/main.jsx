import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.jsx";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./index.css";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing VITE_CLERK_PUBLISHABLE_KEY.\n" +
    "Copy .env.example to .env and fill in your Clerk publishable key.\n" +
    "Get one free at https://dashboard.clerk.com"
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        afterSignOutUrl="/"
        appearance={{
          variables: {
            colorPrimary: "hsl(262 83% 58%)",
            borderRadius: "0.75rem",
            fontFamily: "inherit",
          },
        }}
      >
        <App />
      </ClerkProvider>
    </ErrorBoundary>
  </StrictMode>
);
