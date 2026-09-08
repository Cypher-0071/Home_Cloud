import { Component, type ReactNode, type ErrorInfo } from 'react';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { isChunkLoadError } from '../utils/dynamicImport';

export interface WindowErrorBoundaryProps {
  children: ReactNode;
  label?: string;
  onRetry?: () => void;
}

interface WindowErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

export default class WindowErrorBoundary extends Component<
  WindowErrorBoundaryProps,
  WindowErrorBoundaryState
> {
  constructor(props: WindowErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isChunkError: false,
    };
  }

  static getDerivedStateFromError(error: unknown): WindowErrorBoundaryState {
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
    console.error(`[WindowErrorBoundary:${this.props.label ?? 'Window'}]`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
    this.props.onRetry?.();
  };

  override render() {
    if (this.state.hasError) {
      const { label } = this.props;
      const { isChunkError, error } = this.state;

      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            gap: '14px',
            color: 'var(--text-secondary)',
            padding: '28px',
            textAlign: 'center',
            boxSizing: 'border-box',
            background: 'var(--bg-card, #0a0a0a)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
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
            {isChunkError ? <WifiOff size={22} /> : <AlertTriangle size={22} />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '360px' }}>
            <h3
              style={{
                margin: 0,
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontSize: '14px',
                letterSpacing: '-0.01em',
              }}
            >
              {isChunkError
                ? `Failed to load ${label ?? 'application module'}`
                : `${label ?? 'Application'} crashed`}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '12px',
                color: 'var(--text-muted)',
                lineHeight: 1.45,
              }}
            >
              {isChunkError
                ? 'Network connection issue or a new deployment update prevented this application module from loading.'
                : (error?.message || 'An unexpected runtime error occurred inside this window.')}
            </p>
          </div>

          {error?.stack && !isChunkError && (
            <pre
              style={{
                margin: 0,
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11px',
                fontFamily: 'var(--mono)',
                color: 'var(--text-muted)',
                maxWidth: '90%',
                maxHeight: '90px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {error.stack.split('\n').slice(0, 3).join('\n')}
            </pre>
          )}

          <button
            onClick={this.handleRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '6px',
              padding: '7px 16px',
              borderRadius: '6px',
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent-border)',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              fontFamily: 'var(--sans)',
              transition: 'background var(--duration-fast), border-color var(--duration-fast)',
            }}
          >
            <RefreshCw size={13} />
            {isChunkError ? 'Retry Download' : 'Retry'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
