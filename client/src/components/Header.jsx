import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { FiLogOut, FiMoon, FiSun } from 'react-icons/fi';
import { motion } from 'framer-motion';

export default function Header() {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useApp();

  return (
    <header className="flex items-center justify-between pb-6 mb-2 border-b border-slate-200 dark:border-white/10 relative z-10 transition-colors">
      <div className="flex items-center gap-4">
        <motion.div 
          whileHover={{ rotate: -5, scale: 1.05 }}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-xl font-bold shadow-[0_0_15px_rgba(99,102,241,0.1)] dark:shadow-[0_0_15px_rgba(99,102,241,0.2)]"
        >
          L
        </motion.div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">Lumina Study</h1>
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Active Session</p>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleDarkMode}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors border border-transparent hover:border-indigo-200 dark:hover:border-indigo-500/20 bg-slate-100/50 dark:bg-white/5 backdrop-blur-sm"
          title="Toggle Theme"
        >
          {darkMode ? <FiSun /> : <FiMoon />}
        </motion.button>

        {user && (
          <div className="hidden sm:flex items-center gap-2 mr-2 bg-slate-100/50 dark:bg-white/5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {user.email.split('@')[0]}
            </span>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
          whileTap={{ scale: 0.95 }}
          onClick={logout}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20 bg-slate-100/50 dark:bg-white/5 backdrop-blur-sm"
          title="Disconnect"
        >
          <FiLogOut />
        </motion.button>
      </div>
    </header>
  );
}
