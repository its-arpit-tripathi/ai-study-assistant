import React from 'react';
import { motion } from 'framer-motion';

const Button = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  isPulsing = false,
  icon,
  ...props 
}) => {
  const baseClasses = "inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded text-sm font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-[0_4px_14px_rgba(5,150,105,0.3)] hover:shadow-[0_6px_20px_rgba(5,150,105,0.5)] hover:-translate-y-0.5",
    secondary: "bg-glass-fill border border-glass-border text-on-surface hover:bg-emerald-600/10 hover:border-emerald-600",
    ghost: "text-text-muted hover:text-emerald-600 hover:bg-emerald-600/5",
    icon: "p-2 rounded-full bg-glass-fill border border-glass-border text-on-surface hover:bg-emerald-600/10 hover:border-emerald-600",
  };

  const buttonClasses = `${baseClasses} ${variants[variant]} ${className}`;

  if (isPulsing) {
    return (
      <div className="relative inline-flex">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary"
          animate={{
            scale: [1, 1.5],
            opacity: [1, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
        <button className={`${buttonClasses} relative z-10`} {...props}>
          {icon && <span className="text-lg">{icon}</span>}
          {children}
        </button>
      </div>
    );
  }

  return (
    <button className={buttonClasses} {...props}>
      {icon && <span className="text-lg">{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
