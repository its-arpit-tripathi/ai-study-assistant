import React, { useEffect } from 'react';

export function ToastContainer({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <aside
      aria-live="polite"
      className="fixed top-6 right-6 z-[100] flex flex-col gap-2.5 max-w-sm sm:max-w-md pointer-events-none"
      role="status"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </aside>
  );
}

function ToastItem({ toast, onRemove }) {
  const { id, message, type = 'info', duration = 4500 } = toast;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onRemove();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onRemove]);

  const typeConfig = {
    success: {
      border: 'border-emerald-500/30',
      badgeBg: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      border: 'border-rose-500/30',
      badgeBg: 'bg-rose-500/10 text-rose-500 border border-rose-500/20',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    warning: {
      border: 'border-amber-500/30',
      badgeBg: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    info: {
      border: 'border-blue-500/20',
      badgeBg: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const current = typeConfig[type] || typeConfig.info;

  return (
    <div className={`pointer-events-auto flex items-center space-x-3 bg-white dark:bg-[#1a1c22] text-slate-800 dark:text-slate-200 px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-[#2c2f38] shadow-lg transition-all transform animate-in fade-in slide-in-from-top-2`}>
      {/* Icon */}
      <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center ${current.badgeBg}`}>
        {current.icon}
      </div>

      {/* Message */}
      <span className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-snug">
        {message}
      </span>

      {/* Dismiss Button */}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Dismiss message"
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-100 dark:hover:bg-[#232732] transition-colors ml-2 cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
