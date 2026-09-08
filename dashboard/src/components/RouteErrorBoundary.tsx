import { Component, type ReactNode, type ErrorInfo } from 'react';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { isChunkLoadError } from '../utils/dynamicImport';

export interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

export default class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isChunkError: false,
    };
  }

  static getDerivedStateFromError(error: unknown): RouteErrorBoundaryState {
    const normalizedError =
      error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : 'An unexpected error occurred');
    return {
      hasError: true,
      error: normalizedError,
      isChunkError: isChunkLoadError(error),
    };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[RouteErrorBoundary]', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
  };

  override render() {
    if (this.state.hasError) {
      const { isChunkError, error } = this.state;

      return (
        <div
          role="alert"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-base, #000000)',
            color: 'var(--text-secondary, #a1a1a1)',
            padding: '24px',
            textAlign: 'center',
            zIndex: 99999,
            gap: '16px',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isChunkError
                ? 'var(--warn-dim, rgba(251, 191, 36, 0.12))'
                : 'var(--error-dim, rgba(248, 113, 113, 0.12))',
              color: isChunkError ? 'var(--warn, #fbbf24)' : 'var(--error, #f87171)',
              border: `1px solid ${
                isChunkError ? 'rgba(251, 191, 36, 0.25)' : 'rgba(248, 113, 113, 0.25)'
              }`,
            }}
          >
            {isChunkError ? <WifiOff size={26} /> : <AlertTriangle size={26} />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '420px' }}>
            <h2
              style={{
                margin: 0,
                fontWeight: 600,
                color: 'var(--text-primary, #ededed)',
                fontSize: '16px',
                letterSpacing: '-0.01em',
              }}
            >
              {isChunkError
                ? 'Route Assets Could Not Be Loaded'
                : 'Application Encountered an Error'}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--text-muted, #737373)',
                lineHeight: 1.5,
              }}
            >
              {isChunkError
                ? 'A network interruption or a recent deployment update prevented this page from loading.'
                : (error?.message || 'An unexpected rendering error occurred while displaying this route.')}
            </p>
          </div>

          {error?.stack && !isChunkError && (
            <pre
              style={{
                margin: 0,
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle, #262626)',
                fontSize: '11px',
                fontFamily: 'var(--mono, monospace)',
                color: 'var(--text-muted, #737373)',
                maxWidth: '480px',
                maxHeight: '120px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                textAlign: 'left',
              }}
            >
              {error.stack.split('\n').slice(0, 4).join('\n')}
            </pre>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            {!isChunkError && (
              <button
                onClick={this.handleReset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: '1px solid var(--border-default, #333333)',
                  color: 'var(--text-primary, #ededed)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'var(--sans, sans-serif)',
                }}
              >
                Try Again
              </button>
            )}

            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '6px',
                background: 'var(--accent, #ffffff)',
                border: '1px solid var(--accent, #ffffff)',
                color: 'var(--text-on-accent, #000000)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'var(--sans, sans-serif)',
              }}
            >
              <RefreshCw size={13} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
