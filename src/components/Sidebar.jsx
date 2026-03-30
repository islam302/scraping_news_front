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
  const { toggleTheme, isDark } = useTheme();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('dashboard') },
    { to: '/tasks', icon: ClipboardList, label: t('tasks') },
    { to: '/sites', icon: Globe, label: t('sites') },
  ];

  // In light mode, sidebar is UNA green — all text must be white
  const sidebarText = isDark ? 'text-text-primary' : 'text-white';
  const sidebarTextSec = isDark ? 'text-text-secondary' : 'text-white/70';
  const sidebarTextMuted = isDark ? 'text-text-muted' : 'text-white/50';
  const sidebarBorder = isDark ? 'border-dark-border' : 'border-white/15';
  const sidebarHoverBg = isDark ? 'hover:bg-dark-card' : 'hover:bg-white/10';
  const activeStyle = isDark
    ? 'bg-accent-green/10 text-accent-green shadow-[inset_0_0_0_1px_rgba(200,245,66,0.15)]'
    : 'bg-white/20 text-white font-semibold';
  const inactiveStyle = `${sidebarTextSec} ${sidebarHoverBg} hover:text-white`;
  const btnBorder = isDark ? 'border-dark-border' : 'border-white/20';
  const avatarBg = isDark ? 'bg-accent-green/15 text-accent-green' : 'bg-white/20 text-white';

  return (
    <motion.aside
      className={`w-[240px] min-h-screen bg-dark-sidebar border-e ${sidebarBorder} flex flex-col transition-colors duration-300`}
      initial="hidden"
      animate="visible"
      variants={sidebarVariants}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-6 py-5 border-b ${sidebarBorder}`}>
        <Logo size={34} />
        <div>
          <span className={`text-lg font-bold ${sidebarText}`}>{t('appName')}</span>
          <p className={`text-[10px] ${sidebarTextMuted} tracking-wide -mt-0.5`}>{t('appTagline')}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <motion.p
          className={`text-[11px] font-semibold ${sidebarTextMuted} uppercase tracking-wider px-3 mb-3`}
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
                  `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive ? activeStyle : inactiveStyle
                  }`
                }
              >
                <Icon className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110" />
                {label}
              </NavLink>
            </motion.li>
          ))}
        </ul>
      </nav>

      {/* Theme & Language toggles */}
      <motion.div className="px-3 py-2 flex gap-2" variants={itemVariants}>
        <motion.button
          onClick={toggleTheme}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${sidebarTextSec} hover:text-white ${sidebarHoverBg} transition-all duration-200 border ${btnBorder}`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          {isDark ? t('lightMode') : t('darkMode')}
        </motion.button>
        <motion.button
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${sidebarTextSec} hover:text-white ${sidebarHoverBg} transition-all duration-200 border ${btnBorder}`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <Languages className="w-3.5 h-3.5" />
          {lang === 'en' ? 'AR' : 'EN'}
        </motion.button>
      </motion.div>

      {/* User + Logout */}
      <motion.div className={`px-3 py-4 border-t ${sidebarBorder}`} variants={itemVariants}>
        {user && (
          <div className="px-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center text-xs font-bold uppercase`}>
                {user.username?.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${sidebarText} truncate`}>{user.username}</p>
                <p className={`text-[11px] ${sidebarTextMuted} truncate`}>{user.organization}</p>
              </div>
            </div>
          </div>
        )}
        <motion.button
          onClick={logout}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${sidebarTextSec} hover:text-red-300 hover:bg-red-500/15 transition-all duration-200 w-full`}
          whileHover={{ x: lang === 'ar' ? -2 : 2 }}
          whileTap={{ scale: 0.97 }}
        >
          <LogOut className="w-[18px] h-[18px]" />
          {t('signOut')}
        </motion.button>
      </motion.div>
    </motion.aside>
  );
}
