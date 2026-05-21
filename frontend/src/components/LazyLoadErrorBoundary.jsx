import { Component } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Catches errors during lazy loading of route components and provides a
 * recoverable page instead of leaving the app stuck behind a failed route.
 */
class LazyLoadErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lazy load error:', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{
            color: '#dc3545',
            fontSize: '1.25rem',
            fontWeight: 700,
            marginBottom: '1rem',
          }}>
            Warning
          </div>
          <h2 style={{
            color: '#dc3545',
            marginBottom: '1rem',
          }}>Failed to load page</h2>
          <p style={{
            color: '#6c757d',
            marginBottom: '1.5rem',
          }}>
            Please refresh the page or try again later.
          </p>
          {this.state.error?.message && (
            <pre style={{
              maxWidth: 'min(720px, calc(100vw - 48px))',
              margin: '0 0 1.5rem',
              padding: '0.75rem 1rem',
              overflow: 'auto',
              border: '1px solid #f1b6bd',
              borderRadius: 4,
              background: '#fff5f6',
              color: '#8a1f2d',
              fontSize: '0.8125rem',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1.5rem',
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const LazyLoadErrorBoundaryWithLocation = (props) => {
  const location = useLocation();
  return <LazyLoadErrorBoundary {...props} resetKey={location.pathname} />;
};

export default LazyLoadErrorBoundaryWithLocation;
