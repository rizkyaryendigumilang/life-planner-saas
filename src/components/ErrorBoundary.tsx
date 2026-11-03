import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button, Card } from "./ui";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = window.location.pathname;
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] w-full items-center justify-center p-6 animate-rise">
          <Card className="max-w-md w-full p-6 text-center space-y-5 border border-line/15 bg-surface shadow-soft">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-negative/10 text-negative">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                Terjadi Kendala pada Halaman
              </h2>
              <p className="text-sm text-ink-soft leading-relaxed">
                Aplikasi mengalami kesalahan tak terduga saat memproses tampilan ini. Data Anda tetap tersimpan dengan aman.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="rounded-lg bg-muted p-3 text-left">
                <p className="text-xs font-mono text-ink-faint break-all line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 text-sm"
                onClick={this.handleReset}
              >
                <Home size={15} />
                Kembali
              </Button>
              <Button
                className="flex-1 text-sm"
                onClick={this.handleReload}
              >
                <RefreshCw size={15} />
                Muat Ulang
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
