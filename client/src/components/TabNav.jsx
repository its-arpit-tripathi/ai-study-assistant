import { useApp } from '../context/AppContext';
import { FiUpload, FiCpu, FiMic } from 'react-icons/fi';
import { motion } from 'framer-motion';

const tabs = [
  { id: 'upload', label: 'Data Ingestion', icon: <FiUpload /> },
  { id: 'quiz', label: 'Evaluation', icon: <FiCpu /> },
  { id: 'voice', label: 'Voice Query', icon: <FiMic /> },
];

export default function TabNav() {
  const { activeTab, setActiveTab } = useApp();

  return (
    <nav className="mb-8 relative z-10 flex justify-center md:justify-start">
      <div className="inline-flex items-center p-1 bg-slate-200/50 dark:bg-white/[0.03] backdrop-blur-md rounded-full border border-slate-300 dark:border-white/10 shadow-inner transition-colors">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-5 py-2 text-sm font-semibold tracking-wide transition-colors rounded-full flex items-center gap-2 ${
                isActive 
                  ? 'text-indigo-600 dark:text-indigo-300' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-tab-pill"
                  className="absolute inset-0 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/20 shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.05)] rounded-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {tab.icon}
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
