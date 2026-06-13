import React from 'react';

const SubjectTag = ({ active, children, onClick, icon, className = '' }) => {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-sans text-sm font-medium transition-all duration-300 border
        ${active 
          ? 'bg-primary/15 text-primary border-primary shadow-[0_0_12px_rgba(99,102,241,0.2)]' 
          : 'bg-glass-fill text-text-muted border-glass-border hover:bg-primary/5 hover:text-on-surface'
        } ${className}`}
    >
      {icon && <span className="text-base">{icon}</span>}
      {children}
    </button>
  );
};

export default SubjectTag;
