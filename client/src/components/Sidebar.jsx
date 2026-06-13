import React from 'react';
import { useApp } from '../context/AppContext';
import { FiBookOpen, FiFeather, FiMic, FiSettings, FiLogOut, FiSun, FiMoon, FiGrid } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { activeTab, setActiveTab, darkMode, toggleDarkMode } = useApp();
  const { logout, user } = useAuth();

  const navItems = [
    { id: 'library', label: 'Library', icon: <FiBookOpen /> },
    { id: 'quiz', label: 'Quiz Lab', icon: <FiFeather /> },
    { id: 'voice', label: 'Voice Assistant', icon: <FiMic /> },
    { id: 'subjects', label: 'Subjects', icon: <FiGrid /> }, 
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r border-glass-border bg-surface/50 backdrop-blur-xl hidden md:flex flex-col h-screen overflow-y-auto">
      {/* Logo Area */}
      <div className="p-6 pb-2">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(99,102,241,0.4)]">
            L.
          </div>
          <span className="text-xl font-bold tracking-tight text-on-surface">Lumina</span>
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Menu</p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium ${
              activeTab === item.id 
                ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(99,102,241,0.05)]' 
                : 'text-text-muted hover:bg-glass-fill hover:text-on-surface border border-transparent'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* User Area / Footer */}
      <div className="p-4 mt-auto">
        <div className="p-4 rounded-xl bg-glass-fill border border-glass-border">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-glass-border">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-on-surface truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-text-muted truncate">Pro Plan</p>
            </div>
          </div>
          
          <div className="space-y-1">
            <button 
              onClick={toggleDarkMode}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-muted hover:text-on-surface transition-colors rounded-lg hover:bg-glass-border"
            >
              {darkMode ? <FiSun /> : <FiMoon />} {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-muted hover:text-on-surface transition-colors rounded-lg hover:bg-glass-border">
              <FiSettings /> Settings
            </button>
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors rounded-lg"
            >
              <FiLogOut /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
