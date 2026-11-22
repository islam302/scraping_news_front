import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, User, Lock, Languages, Eye, EyeOff, Sun, Moon, Radar, Sparkles, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import Logo from '../components/Logo';
import { formatError, extractServerMessage } from '../utils/errors';

const FEATURES = {
  en: [
    { Icon: Radar, text: 'Monitor news agencies across member states in real time' },
    { Icon: Sparkles, text: 'AI filtering keeps only what matches your topic' },
    { Icon: FileSpreadsheet, text: 'Export clean, ready-to-share reports' },
  ],
  ar: [
    { Icon: Radar, text: 'رصد وكالات الأنباء في الدول الأعضاء لحظة بلحظة' },
    { Icon: Sparkles, text: 'فلترة بالذكاء الاصطناعي تُبقي ما يخص موضوعك فقط' },
    { Icon: FileSpreadsheet, text: 'تصدير تقارير جاهزة للمشاركة' },
  ],
};

export default function Login() {
  const { login } = useAuth();
  const { t, lang, setLang } = useLang();
  const { toggleTheme, isDark } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      const status = err?.response?.status;
      if (!status || status === 429 || status >= 500) {
        // Network / timeout / rate limit / server error: translated message,
        // never a raw English (or HTML) server body.
        setError(formatError(err, t, 'loginFailed'));
      } else {
        const msg = extractServerMessage(err);
        setError(msg || t('loginFailed'));
      }
      setLoading(false);
    }
  };

  const inputCls =
    'w-full bg-dark-input border border-dark-border rounded-xl py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-green/60 focus:shadow-[0_0_0_4px_rgb(var(--brand-rgb)/0.12)] transition-all';

  return (
    <div className="min-h-screen bg-dark-bg flex">
      {/* Brand panel */}
      <div className="hidden lg:flex relative w-[46%] una-strip text-white overflow-hidden flex-col justify-between p-12">
        {/* Giant faded mark */}
        <div className="absolute -bottom-24 -end-24 opacity-[0.12] pointer-events-none">
          <Logo size={520} animate={false} className="text-white" />
        </div>

        <div className="relative flex items-center gap-3">
          <span className="inline-flex p-2 rounded-2xl bg-white shadow-lg shadow-black/10">
            <Logo size={40} className="text-una" />
          </span>
          <div>
            <p className="text-xl font-extrabold tracking-tight">UNA Scraper</p>
            <p className="text-xs text-white/70">{t('appTagline')}</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <motion.h1
            className="text-4xl font-extrabold leading-tight mb-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {lang === 'ar' ? 'كل خبر يهمك، من كل وكالة، في مكان واحد.' : 'Every story that matters, from every agency, in one place.'}
          </motion.h1>
          <ul className="space-y-3">
            {FEATURES[lang === 'ar' ? 'ar' : 'en'].map(({ Icon, text }, i) => (
              <motion.li
                key={i}
                className="flex items-center gap-3 text-sm text-white/85"
                initial={{ opacity: 0, x: lang === 'ar' ? 12 : -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.1 }}
              >
                <span className="w-8 h-8 rounded-lg bg-white/12 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                {text}
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-white/55">
          Union of OIC News Agencies · اتحاد وكالات أنباء دول منظمة التعاون الإسلامي
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 relative una-backdrop">
        <div className="absolute top-4 end-4 flex items-center gap-2 z-20">
          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="h-9 px-3 flex items-center gap-1.5 rounded-xl bg-dark-card border border-dark-border text-xs font-semibold text-text-secondary hover:text-accent-green transition-colors"
            title={lang === 'en' ? 'العربية' : 'English'}
          >
            <Languages className="w-4 h-4" />
            {lang === 'en' ? 'ع' : 'EN'}
          </button>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-dark-card border border-dark-border text-text-secondary hover:text-accent-green transition-colors"
            title={isDark ? t('lightMode') : t('darkMode')}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Compact brand (mobile / no brand panel) */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-8">
            <Logo size={56} />
            <span className="text-2xl font-extrabold tracking-tight text-text-primary">
              UNA <span className="text-accent-green">Scraper</span>
            </span>
            <p className="text-xs text-text-muted">{t('appTagline')}</p>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-3xl p-7">
            <h2 className="text-xl font-bold text-text-primary mb-1">{t('welcomeBack')}</h2>
            <p className="text-sm text-text-secondary mb-6">{t('signInDesc')}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{t('username')}</label>
                <div className="relative">
                  <User className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('enterUsername')}
                    autoFocus
                    autoComplete="username"
                    className={`${inputCls} ps-10 pe-4`}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{t('password')}</label>
                <div className="relative">
                  <Lock className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('enterPassword')}
                    autoComplete="current-password"
                    className={`${inputCls} ps-10 pe-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-xl px-3 py-2"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              <motion.button
                type="submit"
                disabled={loading || !username.trim() || !password.trim()}
                className="w-full flex items-center justify-center gap-2 bg-accent-green text-on-accent font-semibold px-4 py-3 rounded-xl text-sm shadow-[0_8px_20px_-8px_rgb(var(--brand-rgb)/0.6)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                whileTap={{ scale: 0.98 }}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('signIn')}
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
