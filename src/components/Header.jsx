import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useLang } from '../context/LangContext';

export default function Header({ breadcrumbs = [] }) {
  const { isRTL } = useLang();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  return (
    <header className="h-16 border-b border-dark-border flex items-center px-6 transition-colors duration-300">
      <div className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <Chevron className="w-4 h-4 text-text-muted" />}
            <span
              className={
                i === breadcrumbs.length - 1
                  ? 'text-text-primary font-medium'
                  : 'text-text-secondary'
              }
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>
    </header>
  );
}
