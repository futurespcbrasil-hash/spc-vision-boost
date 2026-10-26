import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Keep technical details in developer diagnostics; never render them to end users.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-lg w-full bg-card border border-destructive/40 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-destructive">Ocorreu um erro inesperado</h2>
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar esta tela. Tente novamente ou volte ao início.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
              >
                Voltar ao início
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition"
              >
                Recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
