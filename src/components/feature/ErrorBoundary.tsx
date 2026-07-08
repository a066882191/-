import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
          <div className="max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-3xl text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-stone-800 mb-2">系統暫時發生錯誤</h2>
            <p className="text-sm text-stone-500 mb-6">
              抱歉，頁面載入時發生意外問題。請嘗試重新整理頁面。
            </p>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition-colors whitespace-nowrap"
              >
                <i className="ri-refresh-line mr-1" />
                重新整理頁面
              </button>
              <button
                onClick={this.handleReset}
                className="w-full bg-white border border-stone-200 hover:bg-stone-50 text-stone-600 font-medium py-2.5 rounded-xl transition-colors whitespace-nowrap text-sm"
              >
                返回首頁重試
              </button>
            </div>
            {this.state.error && (
              <p className="mt-4 text-[10px] text-stone-300 break-all font-mono bg-stone-100 rounded-lg px-3 py-2">
                {this.state.error.message}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}