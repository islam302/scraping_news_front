import { Menu } from 'lucide-react';
import Logo from './Logo';

export default function MobileHeader({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-30 h-14 bg-dark-sidebar/90 backdrop-blur-md border-b border-dark-border flex items-center justify-between px-4">
      <div className="flex items-center gap-2.5">
        <Logo size={30} animate={false} />
        <span className="text-base font-extrabold tracking-tight text-text-primary">
          UNA <span className="text-accent-green">Scraper</span>
        </span>
      </div>
      <button
        onClick={onMenuClick}
        aria-label="Menu"
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-dark-card-hover transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>
    </header>
  );
}
