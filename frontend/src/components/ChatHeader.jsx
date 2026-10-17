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
  onClearChat,
  hasMessages,
}) {
  const isHealthy = health?.status === 'ok' && (health?.qdrant?.ok !== false);
  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <header className="h-16 border-b border-slate-200 dark:border-[#242730] bg-white dark:bg-[#16181d] px-3 sm:px-4 lg:px-5 flex items-center justify-between z-30 shrink-0 w-full min-w-0 transition-colors duration-150">
      {/* Left: Mobile Toggle, Brand Identity & Active Document Badge */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1 mr-2 overflow-hidden">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 dark:text-[#9ba1b0] hover:bg-slate-100 dark:hover:bg-[#22252e] transition-colors shrink-0"
        >
          <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Brand Identity */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 shadow-xs shrink-0">
            <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="font-semibold text-base tracking-tight text-slate-900 dark:text-white shrink-0">
            NotebookLM
          </span>
        </div>

        {/* Active Notebook Badge - Strict Truncation to prevent overflow */}
        {activeDocument ? (
          <div className="hidden sm:flex items-center pl-2.5 border-l border-slate-200 dark:border-[#242730] min-w-0">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1c1e26] border border-slate-200 dark:border-[#282b35] text-xs text-slate-700 dark:text-[#b0b5c3] font-medium shadow-xs min-w-0 max-w-[130px] md:max-w-[190px] lg:max-w-[240px]">
              <span className="w-2.5 h-3 bg-rose-500/80 rounded-[2px] inline-block shrink-0" />
              <span className="truncate font-mono text-xs text-slate-900 dark:text-slate-100 font-semibold" title={activeDocument.name}>
                {activeDocument.name}
              </span>
              <span className="text-[11px] bg-slate-200 dark:bg-[#262934] text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-medium shrink-0 hidden md:inline-block">
                {activeDocument.status === 'processing'
                  ? 'Processing'
                  : activeDocument.status === 'queued'
                  ? 'Queued'
                  : activeDocument.status === 'failed'
                  ? 'Failed'
                  : `${activeDocument.chunkCount ?? activeDocument.chunk_count ?? activeDocument.chunks ?? 0} chunks`}
              </span>
              {onClearChat && hasMessages && (
                <button
                  type="button"
                  onClick={onClearChat}
                  className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors ml-0.5 p-0.5 shrink-0 cursor-pointer"
                  title="Clear persistent chat history for this document"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={onResetActiveDocument}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors ml-0.5 p-0.5 shrink-0 cursor-pointer"
                title="Remove active document context"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex items-center pl-2.5 border-l border-slate-200 dark:border-[#242730] text-xs text-slate-400 dark:text-slate-500 truncate">
            <span>Select or upload a source to begin</span>
          </div>
        )}
      </div>

      {/* Right Controls: Guaranteed Shrink-0 pinned to the right edge */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto">
        {/* Engine Status - Hidden on smaller screens to prioritize buttons */}
        <div
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1a1c22] border border-slate-200 dark:border-[#282b35] text-slate-700 dark:text-[#9ba1b0] text-xs shrink-0"
          title={isHealthy ? 'RAG Engine Online (Qdrant + Groq/LLM)' : 'Database or LLM is degraded'}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="font-medium">{isHealthy ? 'RAG Online' : 'Degraded'}</span>
        </div>

        {/* Theme Switcher Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label="Toggle Dark/Light Mode"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1c1e25] dark:hover:bg-[#252834] text-slate-700 dark:text-amber-400 border border-slate-200 dark:border-[#2a2d36] shadow-2xs transition-all focus:outline-none cursor-pointer shrink-0"
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {theme === 'dark' ? (
            <svg className="w-4 h-4 text-amber-400" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-indigo-600" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* User Account Avatar / Pill */}
        {user?.email && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1c1e25] border border-slate-200 dark:border-[#282b35] text-xs shrink-0"
            title={`Signed in as ${user.email}`}
          >
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-2xs">
              {userInitial}
            </div>
            <span className="hidden 2xl:inline font-mono text-xs text-slate-800 dark:text-[#b0b5c3] max-w-[130px] truncate">
              {user.email}
            </span>
          </div>
        )}

        {/* Sign Out CTA - Pinned and completely visible */}
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/60 shadow-2xs transition-colors cursor-pointer shrink-0"
          title="Sign out of your account"
        >
          <svg className="w-4 h-4 shrink-0" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="inline font-medium">Sign out</span>
        </button>
      </div>
    </header>
  );
}
