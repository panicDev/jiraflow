import React from 'react';

/**
 * Catch graph rendering errors and display CardView fallback information (MAE-266).
 *
 * - Catch exceptions that occur during render and record them as console.warn (dashboard logging channel)
 * - fallback UI: Information text + "Switch to card view" button
 * - If there is an onFallback prop, it is called when the button is clicked (viewMode='cards' returns from App)
 */
export default class GraphErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.warn('[GraphCanvas] render error', {
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack,
    });
  }

  handleFallback = () => {
    this.setState({ error: null });
    if (typeof this.props.onFallback === 'function') {
      this.props.onFallback();
    }
  };

  render() {
    if (this.state.error) {
      return (
        <main
          className="graph-canvas graph-canvas--error"
          data-testid="graph-error-fallback"
          role="alert"
          aria-live="assertive"
        >
          <div className="graph-canvas__error-box">
            <h2 className="graph-canvas__error-title">Cannot display graph</h2>
            <p className="graph-canvas__error-message">
              An error occurred during rendering. Please switch to card view.
            </p>
            <button
              type="button"
              className="graph-canvas__error-btn"
              onClick={this.handleFallback}
            >
              Switch to card view
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
