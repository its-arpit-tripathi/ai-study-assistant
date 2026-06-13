import React from 'react';

const GlassCard = ({ children, className = '', floating = false, ...props }) => {
  const baseClass = floating ? 'glass-floating' : 'glass-panel';
  
  return (
    <div 
      className={`${baseClass} p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassCard;
