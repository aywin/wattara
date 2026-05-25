"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
            <p className="font-semibold">Une erreur inattendue s&apos;est produite.</p>
            {this.state.message && <p className="mt-1 text-sm">{this.state.message}</p>}
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: "" })}
              className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium hover:bg-red-200"
            >
              Réessayer
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
