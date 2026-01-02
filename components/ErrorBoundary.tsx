'use client'

import React from 'react'

type FallbackRender = (args: { error: Error; reset: () => void }) => React.ReactNode

type Props = {
  children: React.ReactNode
  fallback: React.ReactNode | FallbackRender
  resetKeys?: Array<unknown>
}

type State = { error: Error | null; resetKeySig: string }

function sig(keys: Array<unknown> | undefined) {
  try {
    return JSON.stringify(keys ?? [])
  } catch {
    return String(Date.now())
  }
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, resetKeySig: sig(this.props.resetKeys) }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(nextProps: Props, prevState: State): Partial<State> | null {
    const nextSig = sig(nextProps.resetKeys)
    if (nextSig !== prevState.resetKeySig) {
      return { error: null, resetKeySig: nextSig }
    }
    return null
  }

  componentDidCatch(_error: Error) {
    // Intentionally no console spam; callers can log via route-level error or observability tooling.
  }

  private reset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (error) {
      const fb = this.props.fallback
      return typeof fb === 'function' ? (fb as FallbackRender)({ error, reset: this.reset }) : fb
    }
    return this.props.children
  }
}


