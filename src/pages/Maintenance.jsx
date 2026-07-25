import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wrench, RotateCcw } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { useMaintenance } from '../context/MaintenanceContext';
import { checkApiHealth } from '../services/api';
import Logo from '../components/Logo';

export default function Maintenance() {
  const { t } = useLang();
  const { setDown } = useMaintenance();
  const [checking, setChecking] = useState(false);

  const handleRetry = async () => {
    if (checking) return;
    setChecking(true);
    try {
      await checkApiHealth();
      setDown(false); // back online — fall through to the app
    } catch {
      // still down — keep showing this page
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full text-center"
      >
        <div className="mb-6 flex justify-center">
          <Logo size={56} variant="brand" />
        </div>

        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 bg-accent-green/10 rounded-2xl" />
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ rotate: [0, -12, 12, -12, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Wrench className="w-9 h-9 text-accent-green" />
          </motion.div>
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-3">{t('maintTitle')}</h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-8">
          {t('maintMessage')}
        </p>

        <button
          onClick={handleRetry}
          disabled={checking}
          className="inline-flex items-center gap-2 bg-accent-green text-dark-bg font-semibold px-6 py-2.5 rounded-lg text-sm hover:shadow-[0_0_20px_rgba(200,245,66,0.25)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RotateCcw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? t('maintChecking') : t('maintRetry')}
        </button>
      </motion.div>
    </div>
  );
}
