import React from 'react';

export function ChatHeader({
  activeDocument,
  health,
  user,
  onSignOut,
  onToggleSidebar,
  onResetActiveDocument,
  theme,
  onToggleTheme,
}) {
  const isHealthy = health?.status === 'ok' && (health?.qdrant?.ok !== false);
  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <header className="h-16 border-b border-slate-200 dark:border-[#242730] bg-white dark:bg-[#16181d] px-4 lg:px-7 flex items-center justify-between z-30 shrink-0 transition-colors duration-150">
      {/* Left: Brand Identity & Active Document Badge */}
      <div className="flex items-center space-x-4">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="lg:hidden p-2 rounded-lg text-slate-500 dark:text-[#9ba1b0] hover:bg-slate-100 dark:hover:bg-[#22252e] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Brand Identity & Version Tag */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 shadow-xs">
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base tracking-tight text-slate-900 dark:text-white">
              NotebookLM
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-[#20222a] dark:text-[#9ba1b0] border border-slate-200 dark:border-[#2a2d37]">
              v2.4
            </span>
          </div>
        </div>

        {/* Active Notebook Badge */}
        {activeDocument ? (
          <div className="hidden md:flex items-center pl-4 border-l border-slate-200 dark:border-[#242730]">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1c1e26] border border-slate-200 dark:border-[#282b35] text-xs sm:text-[13px] text-slate-700 dark:text-[#b0b5c3] font-medium shadow-xs">
              <span className="w-2.5 h-3 bg-rose-500/80 rounded-[2px] inline-block shrink-0" />
              <span className="truncate max-w-[200px] lg:max-w-xs font-mono text-xs sm:text-[12.5px] text-slate-900 dark:text-slate-100 font-semibold" title={activeDocument.name}>
                {activeDocument.name}
              </span>
              <span className="text-[11px] bg-slate-200 dark:bg-[#262934] text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-medium">
                {activeDocument.chunkCount} chunks
              </span>
              <button
                type="button"
                onClick={onResetActiveDocument}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors ml-1 p-0.5"
                title="Remove active document context"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex items-center pl-4 border-l border-slate-200 dark:border-[#242730] text-xs sm:text-sm text-slate-400 dark:text-slate-500">
            <span>Select or upload a source to begin</span>
          </div>
        )}
      </div>

      {/* Right Controls: Status, Theme Toggle, User Chip & Sign Out */}
      <div className="flex items-center gap-3">
        {/* Engine Status */}
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1a1c22] border border-slate-200 dark:border-[#282b35] text-slate-700 dark:text-[#9ba1b0] text-xs sm:text-[13px]"
          title={isHealthy ? 'RAG Engine Online (Qdrant + Groq/LLM)' : 'Database or LLM is degraded'}
        >
          <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="font-medium">{isHealthy ? 'RAG Online' : 'Degraded'}</span>
        </div>

        {/* Theme Switcher Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label="Toggle Dark/Light Mode"
          className="p-2 rounded-lg text-slate-500 dark:text-[#9ba1b0] hover:bg-slate-100 dark:hover:bg-[#22252e] border border-transparent hover:border-slate-200 dark:hover:border-[#282b35] transition-colors cursor-pointer"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <svg className="w-4.5 h-4.5 text-slate-300 hover:text-white" fill="currentColor" viewBox="0 0 20 20">
              <path clipRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fillRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4.5 h-4.5 text-slate-600 hover:text-slate-900" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>

        {/* User Account Chip */}
        {user?.email && (
          <div className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1c1e25] border border-slate-200 dark:border-[#282b35] text-xs sm:text-[13px]">
            <div className="w-5.5 h-5.5 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-xs shadow-xs">
              {userInitial}
            </div>
            <span className="hidden sm:inline font-mono text-xs sm:text-[12.5px] text-slate-800 dark:text-[#b0b5c3] max-w-[160px] truncate" title={user.email}>
              {user.email}
            </span>
          </div>
        )}

        {/* Sign Out CTA */}
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-[13px] font-medium text-slate-600 dark:text-[#9ba1b0] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#20232c] transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
