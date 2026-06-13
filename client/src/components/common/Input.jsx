import React from 'react';

const Input = React.forwardRef(({ className = '', error, icon, ...props }, ref) => {
  return (
    <div className="w-full relative">
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
          {icon}
        </div>
      )}
      <input
        ref={ref}
        className={`w-full px-4 py-3.5 rounded-md border bg-glass-fill text-on-surface text-sm transition-all duration-300 outline-none placeholder:text-text-muted
          ${error ? 'border-error focus:border-error focus:shadow-[0_0_0_1px_theme(colors.error),inset_0_0_8px_rgba(255,180,171,0.1)]' : 'border-glass-border focus:border-primary focus:shadow-[0_0_0_1px_theme(colors.primary),inset_0_0_8px_rgba(99,102,241,0.1)]'}
          ${icon ? 'pl-11' : ''}
          focus:bg-background
          ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs text-error font-medium">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
