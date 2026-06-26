import { Component } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * ErrorBoundary
 * ─────────────
 * Catches unhandled render errors anywhere in the tree and shows a friendly
 * recovery UI instead of a blank white screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <MyComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production you'd forward this to Sentry / Datadog etc.
    console.error("[ErrorBoundary] Caught unhandled error:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            An unexpected error occurred. You can try refreshing the page or going back to the
            dashboard.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-4 max-w-lg overflow-auto rounded-lg border border-border bg-muted p-4 text-left text-xs text-muted-foreground">
              {this.state.error.toString()}
            </pre>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh page
          </Button>
          <Button onClick={() => { this.handleReset(); window.location.href = "/dashboard"; }}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }
}
