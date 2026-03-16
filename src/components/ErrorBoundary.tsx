import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen sb-page flex items-center justify-center p-4">
          <div className="max-w-md w-full sb-card rounded-2xl p-8 text-center">
            <AlertTriangle className="w-14 h-14 mx-auto mb-4 text-amber-400" />
            <h1 className="text-xl font-bold mb-2">
              Something went wrong / 出错了
            </h1>
            <p className="sb-muted mb-6 text-sm">
              An unexpected error occurred. This may be a temporary issue.
              <br />
              应用程序遇到了一个意外错误。这可能是临时性问题。
            </p>

            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-sm sb-muted cursor-pointer hover:text-[var(--text-primary)]">
                  View details / 查看错误详情
                </summary>
                <pre className="mt-2 p-3 sb-surface rounded-lg text-xs text-red-500 overflow-auto max-h-32">
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-3 sb-button font-medium transition-colors"
              >
                Retry / 重试
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-3 sb-button-primary font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reload / 刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 简化版 Error Boundary for 小组件
export function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary?: () => void;
}) {
  return (
    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
      <div className="flex items-center gap-2 text-red-500 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="font-medium">Loading failed / 加载失败</span>
      </div>
      <p className="text-sm sb-muted mb-3">{error.message}</p>
      {resetErrorBoundary && (
        <button
          onClick={resetErrorBoundary}
          className="text-sm text-violet-500 hover:text-violet-400"
        >
          Click to retry / 点击重试
        </button>
      )}
    </div>
  );
}
