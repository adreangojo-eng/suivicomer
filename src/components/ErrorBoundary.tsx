import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erreur interceptée par ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        caches.keys().then((keys) => {
          Promise.all(keys.map((k) => caches.delete(k))).finally(() => {
            window.location.href = window.location.origin;
          });
        });
        return;
      }
    } catch {
      // Ignorer
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--slate-100)',
            padding: '1.5rem',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              background: 'white',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto',
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              Mise à jour en cours
            </h2>

            <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Une nouvelle version de <strong>SUIVICOMER</strong> a été déployée. Cliquez ci-dessous pour actualiser et charger les dernières données sans interruption.
            </p>

            <button
              onClick={this.handleReload}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: '#0d9488',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '0.75rem 1.25rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={18} />
              <span>Actualiser l'application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
