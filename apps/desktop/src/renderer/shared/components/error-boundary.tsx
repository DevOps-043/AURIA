import React from 'react';

interface State {
  error: Error | null;
}

/**
 * Catches React render errors and displays them instead of a blank screen.
 * Essential for Electron apps where DevTools may not be open.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0F14',
          color: '#F5F7FB',
          padding: 32,
          fontFamily: 'monospace',
        }}>
          <h1 style={{ color: '#EF4444', fontSize: 14, marginBottom: 16, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Error de ejecucion
          </h1>
          <pre style={{
            background: '#171C23',
            border: '1px solid #263042',
            borderRadius: 12,
            padding: 24,
            maxWidth: 600,
            overflow: 'auto',
            fontSize: 11,
            lineHeight: 1.6,
            color: '#F59E0B',
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 24,
              padding: '8px 24px',
              background: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
