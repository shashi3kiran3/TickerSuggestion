import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-200">
          <div className="font-semibold">Something went wrong</div>
          <div className="mt-1 text-sm opacity-80">{this.state.error?.message}</div>
        </div>
      )
    }
    return this.props.children
  }
}


