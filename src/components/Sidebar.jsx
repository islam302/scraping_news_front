import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ClipboardList,
  Globe,
  LogOut,
  Languages,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import Logo from './Logo';

const sidebarVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: {
    x: 0, opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut', staggerChildren: 0.07, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { x: -12, opacity: 0 },
  visible: { x: 0, opacity: 1 },
};

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLang();
  const { setTheme, isDark } = useTheme();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('dashboard') },
    { to: '/tasks', icon: ClipboardList, label: t('tasks') },
    { to: '/sites', icon: Globe, label: t('sites') },
  ];

  return (
    <motion.aside
      className="w-[256px] h-screen sticky top-0 bg-dark-sidebar border-e border-dark-border flex flex-col transition-colors duration-300"
      initial="hidden"
      animate="visible"
      variants={sidebarVariants}
    >
      {/* Brand */}
      <div className="relative px-5 pt-6 pb-5 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 una-strip" />
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div className="min-w-0">
            <span className="block text-[17px] font-extrabold tracking-tight text-text-primary leading-tight">
              UNA <span className="text-accent-green">Scraper</span>
            </span>
            <p className="text-[11px] text-text-muted leading-snug truncate">{t('appTagline')}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <motion.p
          className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-2"
          variants={itemVariants}
        >
          {t('mainMenu')}
        </motion.p>
        <ul className="space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <motion.li key={to} variants={itemVariants}>
              <NavLink
                to={to}
                end={to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-accent-green/10 text-accent-green font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-dark-card-hover'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-indicator"
                        className="absolute start-0 top-2 bottom-2 w-[3px] rounded-full bg-accent-green"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    <Icon className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110" />
                    {label}
                  </>
                )}
              </NavLink>
            </motion.li>
          ))}
        </ul>
      </nav>

      {/* Theme switch + language */}
      <motion.div className="px-3 pb-3 flex gap-2" variants={itemVariants}>
        <div className="flex-1 grid grid-cols-2 p-1 rounded-xl bg-dark-input border border-dark-border">
          {[
            { key: 'light', Icon: Sun, active: !isDark, label: t('lightMode') },
            { key: 'dark', Icon: Moon, active: isDark, label: t('darkMode') },
          ].map(({ key, Icon, active, label }) => (
            <button
              key={key}
              onClick={() => setTheme(key)}
              title={label}
              aria-pressed={active}
              className={`relative flex items-center justify-center py-1.5 rounded-lg transition-colors ${active ? 'text-accent-green' : 'text-text-muted hover:text-text-secondary'}`}
            >
              {active && (
                <motion.span
                  layoutId="theme-pill"
                  className="absolute inset-0 rounded-lg bg-dark-card shadow-sm ring-1 ring-dark-border"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="relative w-4 h-4" />
            </button>
          ))}
        </div>
        <motion.button
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          className="flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-semibold text-text-secondary hover:text-accent-green bg-dark-input border border-dark-border transition-colors"
          whileTap={{ scale: 0.96 }}
        >
          <Languages className="w-3.5 h-3.5" />
          {lang === 'en' ? 'ع' : 'EN'}
        </motion.button>
      </motion.div>

      {/* User + Logout */}
      <motion.div className="p-3 border-t border-dark-border" variants={itemVariants}>
        <div className="flex items-center gap-2.5 p-2 rounded-xl">
          {user && (
            <>
              <div className="w-9 h-9 rounded-full una-strip text-white flex items-center justify-center text-sm font-bold uppercase shadow-sm">
                {user.username?.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary truncate">{user.username}</p>
                <p className="text-[11px] text-text-muted truncate">{user.organization}</p>
              </div>
            </>
          )}
          <motion.button
            onClick={logout}
            title={t('signOut')}
            className={`${user ? '' : 'w-full justify-center gap-2 text-sm'} flex items-center p-2 rounded-lg text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors`}
            whileTap={{ scale: 0.94 }}
          >
            <LogOut className="w-[18px] h-[18px] rtl:-scale-x-100" />
            {!user && t('signOut')}
          </motion.button>
        </div>
      </motion.div>
    </motion.aside>
  );
}
