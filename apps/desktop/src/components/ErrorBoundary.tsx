import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '40px',
              gap: '12px',
            }}
          >
            <h2 style={{ color: '#b91c1c', margin: 0 }}>Something went wrong</h2>
            <p style={{ color: '#6b7280', margin: 0 }}>{this.state.error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              style={{
                padding: '8px 20px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        )
      )
    }

    return this.props.children
  }
}
