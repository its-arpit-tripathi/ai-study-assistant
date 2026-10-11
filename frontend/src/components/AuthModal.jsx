import React, { useState } from 'react';
import { api, setToken } from '../utils/api';

export function AuthModal({ onAuthenticated, showToast, theme, onToggleTheme }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRegister = mode === 'register';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }

    setLoading(true);
    try {
      const data = isRegister
        ? await api.register(email, password)
        : await api.login(email, password);

      setToken(data.token);
      showToast(isRegister ? 'Account created successfully!' : 'Signed in successfully!', 'success');
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-[#121316] dark:text-[#e3e2e6] font-sans antialiased selection:bg-blue-600/30 selection:text-white transition-colors duration-200 overflow-x-hidden flex flex-col justify-between">
      {/* Top Navigation Utility */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Brand Mark */}
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#1f222a] border border-slate-200 dark:border-[#2c2f38] flex items-center justify-center shadow-xs">
            <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M12 4.5v15m7.5-7.5h-15M4.5 9l15 6M4.5 15l15-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-semibold tracking-tight text-lg text-slate-900 dark:text-white">
            Notebook<span className="text-blue-500 dark:text-blue-400">LM</span>
          </span>
        </div>

        {/* Right Controls: Status & Theme Toggle */}
        <div className="flex items-center space-x-3.5">
          {/* Knowledge Engines Status Pill */}
          <div className="hidden sm:flex items-center space-x-2 text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1a1c22] border border-slate-200 dark:border-[#2c2f38] rounded-lg px-3 py-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Knowledge Engines Online</span>
          </div>

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme mode"
            className="inline-flex items-center justify-center p-2 rounded-lg bg-white dark:bg-[#1a1c22] hover:bg-slate-100 dark:hover:bg-[#232630] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2c2f38] transition-colors focus:outline-none focus:ring-1 focus:ring-slate-500 shadow-xs cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4 text-slate-300" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-600" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Section */}
      <main className="relative z-10 w-full flex-grow flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-[440px] -mt-10 sm:-mt-16 rounded-2xl bg-white dark:bg-[#1a1c22] border border-slate-200 dark:border-[#2c2f38] p-7 sm:p-8 shadow-2xl transition-all">
          {/* Emblem Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-[#232732] border border-blue-100 dark:border-[#2f3545] flex items-center justify-center mb-3.5 text-blue-600 dark:text-blue-400 shadow-xs">
              <svg className="w-6 h-6" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white mb-1.5">
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
              {isRegister
                ? 'Get started with AI document intelligence and grounded chats'
                : 'Sign in to access your notebooks and grounded document chats'}
            </p>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-300" htmlFor="auth-email">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <input
                  id="auth-email"
                  type="email"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#14151a] hover:bg-white dark:hover:bg-[#16181f] border border-slate-300 dark:border-[#2c2f36] focus:border-blue-500 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-300" htmlFor="auth-password">
                  Password
                </label>
                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => showToast('Enter your registered email and contact your workspace administrator to reset.', 'info')}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 hover:underline transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-[#14151a] hover:bg-white dark:hover:bg-[#16181f] border border-slate-300 dark:border-[#2c2f36] focus:border-blue-500 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="Minimum 12 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={12}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password view"
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.257-5.064 7-9.542 7-4.477 0-8.268-2.743-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center space-x-2.5 cursor-pointer text-xs sm:text-[13px] text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-100 dark:bg-[#14151a] border-slate-300 dark:border-[#2c2f36] text-blue-600 focus:ring-0 focus:outline-none transition cursor-pointer"
                />
                <span>Stay authenticated for 30 days</span>
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs sm:text-[13px] flex items-center gap-2" role="alert">
                <svg className="w-4 h-4 shrink-0" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path d="M12 8v4m0 4h.01" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Primary Sign In / Sign Up Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 sm:py-3 px-4 rounded-xl font-medium text-sm sm:text-base text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex items-center justify-center gap-2 shadow-md disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? 'Create account' : 'Sign in'}</span>
                  <svg className="w-4 h-4 shrink-0" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Card Footer Navigation */}
          <div className="mt-5 text-center text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 font-normal">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              onClick={() => {
                setMode(isRegister ? 'login' : 'register');
                setError('');
              }}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium hover:underline transition-colors ml-1.5 cursor-pointer"
            >
              {isRegister ? 'Sign in' : 'Create one now'}
            </button>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="relative z-10 w-full border-t border-slate-200 dark:border-[#1f222a] py-4 px-6 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
          <p>© 2026 NotebookLM • Grounded Document Intelligence</p>
        </div>
        <div className="flex items-center space-x-5 text-slate-600 dark:text-slate-400">
          <a className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#grounding">Grounding Specs</a>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <a className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#privacy">Privacy Policy</a>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <a className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#terms">Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}
