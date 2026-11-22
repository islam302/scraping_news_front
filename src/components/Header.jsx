import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useLang } from '../context/LangContext';

export default function Header({ breadcrumbs = [] }) {
  const { isRTL, lang } = useLang();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const today = new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const title = breadcrumbs[breadcrumbs.length - 1];

  return (
    <header className="h-16 border-b border-dark-border bg-dark-bg/80 backdrop-blur-md flex items-center justify-between gap-4 px-6 transition-colors duration-300">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          {breadcrumbs.slice(0, -1).map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <Chevron className="w-3 h-3" />}
              {crumb}
            </span>
          ))}
        </div>
        <h1 className="text-base font-bold text-text-primary truncate leading-tight">{title}</h1>
      </div>
      <div className="hidden md:flex items-center gap-2 text-xs text-text-secondary bg-dark-card border border-dark-border rounded-full px-3 py-1.5">
        <span className="relative flex w-2 h-2">
          <span className="absolute inline-flex w-full h-full rounded-full bg-accent-green opacity-60 animate-ping" />
          <span className="relative inline-flex w-2 h-2 rounded-full bg-accent-green" />
        </span>
        {today}
      </div>
    </header>
  );
}
