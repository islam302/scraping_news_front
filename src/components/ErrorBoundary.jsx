import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { translations } from '../i18n/translations';

// The boundary sits OUTSIDE LangProvider (it must survive provider crashes),
// so it reads the persisted language directly.
const readLang = () => {
  try {
    return localStorage.getItem('lang') === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
};
const tr = (key) => {
  const lang = readLang();
  return translations[lang]?.[key] || translations.en[key] || key;
};

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  handleReset = () => {
    // A second crash right after a reset is deterministic (e.g. bad persisted
    // state): reload the page instead of looping back to this screen.
    if (this.resetAt && Date.now() - this.resetAt < 5000) {
      window.location.reload();
      return;
    }
    this.resetAt = Date.now();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4" dir={readLang() === 'ar' ? 'rtl' : 'ltr'}>
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 bg-accent-red/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8 text-accent-red" />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">{tr('errBoundaryTitle')}</h2>
            <p className="text-sm text-text-secondary mb-6">
              {tr('errBoundaryMsg')}
            </p>
            {this.state.error?.message && (
              <div className="bg-dark-card border border-dark-border rounded-lg p-3 mb-6 text-start">
                <p className="text-xs text-text-muted font-mono break-all">{this.state.error.message}</p>
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 bg-accent-green text-on-accent font-semibold px-6 py-2.5 rounded-lg text-sm hover:shadow-[0_0_20px_rgb(var(--brand-rgb)/0.25)] transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              {tr('errBoundaryRetry')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
