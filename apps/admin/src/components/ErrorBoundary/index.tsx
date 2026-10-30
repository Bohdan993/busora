import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

interface ErrorBoundaryProps {
  children: ReactNode;
}

type ErrorBoundaryType = null | '404' | '500';

interface ErrorBoundaryState {
  hasError: boolean;
  type: ErrorBoundaryType;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      type: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return {
      hasError: true,
      type: error.message as ErrorBoundaryType
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.log('componentDidCatch ERROR: ', error);
    console.log('componentDidCatch ERROR INFO: ', errorInfo);
    // You can also log the error to an error reporting service
    // logErrorToMyService(error, errorInfo);
    // Set error state to false here
    this.setState({ hasError: false, type: null });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      switch (this.state.type) {
        case '404': {
          return <Navigate to="/status/404" />;
        }

        case '500': {
          return <Navigate to="/status/500" />;
        }

        default: {
          return <Navigate to="/status/500" />;
        }
      }
    }

    return this.props.children;
  }
}
