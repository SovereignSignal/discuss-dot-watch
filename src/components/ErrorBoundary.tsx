'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <AlertTriangle className="w-16 h-16 mb-4" style={{ color: 'var(--ds-warn)' }} />
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ds-fg)' }}>Something went wrong</h2>
          <p className="mb-6 max-w-md" style={{ color: 'var(--ds-fg-muted)' }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--ds-bg-elev)', color: 'var(--ds-fg)', border: '1px solid var(--ds-border)' }}
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre
              className="mt-6 p-4 rounded-lg text-left text-xs max-w-full overflow-auto"
              style={{ backgroundColor: 'var(--ds-bg-card)', color: 'var(--ds-error)', border: '1px solid var(--ds-border)' }}
            >
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
