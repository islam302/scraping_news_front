import { Menu } from 'lucide-react';
import { useLang } from '../context/LangContext';
import Logo from './Logo';

export default function MobileHeader({ onMenuClick }) {
  const { t } = useLang();

  return (
    <header className="h-14 bg-dark-sidebar border-b border-dark-border flex items-center justify-between px-4">
      <div className="flex items-center gap-2.5">
        <Logo size={28} />
        <span className="text-base font-bold text-text-primary">{t('appName')}</span>
      </div>
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-dark-card transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>
    </header>
  );
}
