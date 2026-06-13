import React from 'react';
import { motion } from 'framer-motion';
import { FiSearch, FiBell, FiSettings, FiFilter, FiMaximize, FiMoreVertical, FiUploadCloud } from 'react-icons/fi';
import { MdOutlinePictureAsPdf, MdOutlineDescription, MdOutlineNotes, MdOutlineTableChart } from 'react-icons/md';

export default function SubjectOverview() {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-background text-on-background relative">
      {/* Top App Bar */}
      <header className="w-full sticky top-0 z-40 bg-surface-bright/90 backdrop-blur-md shadow-sm shadow-primary/5 flex flex-col md:flex-row justify-between items-center px-6 md:px-16 py-4">
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full md:w-auto mb-4 md:mb-0">
          <span className="font-display text-2xl font-bold text-primary tracking-tight">Lumina Scholar</span>
          <div className="relative flex items-center w-full md:w-auto">
            <FiSearch className="absolute left-3 text-on-surface-variant" />
            <input 
              type="text" 
              placeholder="Search literature..." 
              className="pl-10 pr-4 py-2 bg-surface-container rounded-full border-none focus:ring-2 focus:ring-primary/20 w-full md:w-64 text-sm font-body"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex gap-4">
            <button className="text-primary hover:bg-surface-container-high p-2 rounded-full transition-colors">
              <FiBell />
            </button>
            <button className="text-primary hover:bg-surface-container-high p-2 rounded-full transition-colors">
              <FiSettings />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-screen">
        {/* Hero Section */}
        <section className="px-6 md:px-16 pt-8 md:pt-12 pb-8">
          <div className="relative h-64 md:h-[320px] rounded-xl overflow-hidden bg-surface-container-highest organic-shadow group">
            <img 
              src="https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=2070&auto=format&fit=crop" 
              alt="Physics Background" 
              className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-transparent flex flex-col justify-center px-8 md:px-12 text-on-primary-container">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-xs font-bold tracking-wider">CORE SUBJECT</span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-2">Physics</h2>
              <p className="font-body text-base md:text-lg max-w-xl opacity-90">Exploring the fundamental laws governing the universe, from quantum fluctuations to celestial mechanics.</p>
            </div>
          </div>
        </section>

        {/* Stats & Active Module Bento Grid */}
        <section className="px-6 md:px-16 grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
          {/* Mastery Progress */}
          <div className="col-span-1 md:col-span-4 bg-surface-container-lowest p-8 rounded-xl organic-shadow flex flex-col justify-between border border-glass-border">
            <div>
              <h3 className="font-display text-2xl font-bold text-primary mb-1">Subject Mastery</h3>
              <p className="text-on-surface-variant text-sm">Based on current curriculum completion</p>
            </div>
            
            <div className="mt-8">
              <div className="flex justify-between items-end mb-2">
                <span className="font-display text-4xl md:text-5xl font-bold text-secondary">75%</span>
                <span className="text-on-surface-variant text-xs font-bold tracking-wider mb-2">ADVANCED LEVEL</span>
              </div>
              <div className="w-full bg-surface-container-high h-3 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '75%' }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="bg-primary h-full rounded-full shadow-[0_0_8px_rgba(0,105,82,0.4)]"
                />
              </div>
            </div>
            
            <div className="mt-6 flex gap-4">
              <div className="flex flex-col">
                <span className="font-bold text-primary text-xl">12</span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">Modules Done</span>
              </div>
              <div className="w-[1px] bg-outline-variant h-8 self-center opacity-30"></div>
              <div className="flex flex-col">
                <span className="font-bold text-primary text-xl">4</span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">To Review</span>
              </div>
            </div>
          </div>

          {/* Active Module */}
          <div className="col-span-1 md:col-span-8 bg-surface-container p-6 md:p-8 rounded-xl organic-shadow flex flex-col md:flex-row gap-8 items-center border border-outline-variant/20 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
            
            <div className="w-full md:w-1/3 h-48 md:h-full rounded-lg overflow-hidden shrink-0">
              <img 
                src="https://images.unsplash.com/photo-1507413245164-6160d8298b31?q=80&w=2070&auto=format&fit=crop" 
                alt="Electromagnetism" 
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex flex-col flex-grow z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-secondary text-xs font-bold uppercase tracking-widest">Currently Active</span>
              </div>
              <h3 className="font-display text-2xl md:text-3xl font-bold text-on-surface mb-2">Electromagnetism & Wave Theory</h3>
              <p className="text-on-surface-variant font-body text-sm md:text-base mb-6 line-clamp-2">Deep dive into Maxwell's equations, polarization of light, and the principles of electromagnetic induction in modern systems.</p>
              
              <div className="flex flex-wrap items-center gap-4">
                <button className="bg-primary text-on-primary px-6 md:px-8 py-3 rounded-full text-sm font-bold hover:scale-[1.02] transition-all">
                  Resume Learning
                </button>
                <button className="text-primary border border-primary px-6 py-3 rounded-full text-sm font-bold hover:bg-primary/5 transition-colors">
                  Module Outline
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Knowledge Graph & Documents */}
        <section className="px-6 md:px-16 grid grid-cols-1 md:grid-cols-12 gap-6 mb-16 md:h-[600px]">
          {/* Neural Knowledge Graph */}
          <div className="col-span-1 md:col-span-7 bg-surface-bright border border-glass-border rounded-xl organic-shadow relative overflow-hidden flex flex-col parchment-texture">
            <div className="p-4 md:p-6 border-b border-glass-border flex justify-between items-center bg-surface-bright/50 backdrop-blur-sm sticky top-0 z-20">
              <h3 className="font-display text-xl md:text-2xl font-bold text-primary">Neural Knowledge Graph</h3>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant"><FiFilter /></button>
                <button className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant"><FiMaximize /></button>
              </div>
            </div>
            
            {/* Visual Mockup of Graph */}
            <div className="flex-grow relative min-h-[300px] md:min-h-0 bg-surface/30">
              <svg className="w-full h-full opacity-40 absolute inset-0">
                <line x1="50%" y1="50%" x2="30%" y2="30%" stroke="var(--color-primary)" strokeWidth="1.5"></line>
                <line x1="50%" y1="50%" x2="70%" y2="40%" stroke="var(--color-primary)" strokeWidth="1.5"></line>
                <line x1="50%" y1="50%" x2="55%" y2="75%" stroke="var(--color-primary)" strokeWidth="1.5"></line>
                <line x1="30%" y1="30%" x2="20%" y2="45%" stroke="var(--color-secondary)" strokeWidth="1" strokeDasharray="4"></line>
                <line x1="70%" y1="40%" x2="85%" y2="25%" stroke="var(--color-primary)" strokeWidth="1.5"></line>
              </svg>
              
              {/* Nodes */}
              <motion.div whileHover={{ scale: 1.1 }} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 group z-10 cursor-pointer">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-on-primary organic-shadow knowledge-node transition-all">
                  <span className="font-bold text-xl">E</span>
                </div>
                <span className="absolute top-20 left-1/2 -translate-x-1/2 bg-surface px-3 py-1 rounded-full text-xs font-bold border border-glass-border whitespace-nowrap shadow-sm text-on-surface">Electromagnetism</span>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.1 }} className="absolute left-[30%] top-[30%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
                <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-on-secondary organic-shadow knowledge-node transition-all">
                  <span className="font-bold">O</span>
                </div>
                <span className="absolute top-14 left-1/2 -translate-x-1/2 bg-surface px-3 py-1 rounded-full text-xs border border-glass-border whitespace-nowrap shadow-sm text-on-surface">Optics</span>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.1 }} className="absolute left-[70%] top-[40%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
                <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container organic-shadow knowledge-node transition-all">
                  <span className="font-bold">T</span>
                </div>
                <span className="absolute top-12 left-1/2 -translate-x-1/2 bg-surface px-3 py-1 rounded-full text-xs border border-glass-border whitespace-nowrap shadow-sm text-on-surface">Thermodynamics</span>
              </motion.div>
              
              <div className="absolute bottom-4 right-4 text-text-muted flex items-center gap-2">
                <span className="text-xs">Scroll to zoom • Drag to explore</span>
              </div>
            </div>
          </div>

          {/* Recent Documents */}
          <div className="col-span-1 md:col-span-5 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h3 className="font-display text-2xl font-bold text-on-surface">Recent Documents</h3>
              <button className="text-primary text-sm font-bold hover:underline">View All</button>
            </div>
            
            <div className="flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar flex-grow">
              {/* Doc Item 1 */}
              <div className="bg-surface-container-low p-4 rounded-lg border border-glass-border hover:bg-surface-container-high transition-all flex items-center gap-4 group cursor-pointer">
                <div className="w-12 h-12 bg-error/10 text-error rounded flex items-center justify-center shrink-0">
                  <MdOutlinePictureAsPdf size={24} />
                </div>
                <div className="flex-grow">
                  <h4 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">Quantum Mechanics Lab Notes</h4>
                  <p className="text-text-muted text-xs mt-1">Last accessed 2 hours ago • 4.2 MB</p>
                </div>
                <FiMoreVertical className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Doc Item 2 */}
              <div className="bg-surface-container-low p-4 rounded-lg border border-glass-border hover:bg-surface-container-high transition-all flex items-center gap-4 group cursor-pointer">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded flex items-center justify-center shrink-0">
                  <MdOutlineDescription size={24} />
                </div>
                <div className="flex-grow">
                  <h4 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">Midterm Review: Relativity</h4>
                  <p className="text-text-muted text-xs mt-1">Last accessed Yesterday • 1.5 MB</p>
                </div>
                <FiMoreVertical className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Doc Item 3 */}
              <div className="bg-surface-container-low p-4 rounded-lg border border-glass-border hover:bg-surface-container-high transition-all flex items-center gap-4 group cursor-pointer">
                <div className="w-12 h-12 bg-secondary/10 text-secondary rounded flex items-center justify-center shrink-0">
                  <MdOutlineNotes size={24} />
                </div>
                <div className="flex-grow">
                  <h4 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">Meeting Audio Transcript</h4>
                  <p className="text-text-muted text-xs mt-1">Last accessed 3 days ago • 850 KB</p>
                </div>
                <FiMoreVertical className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Doc Item 4 */}
              <div className="bg-surface-container-low p-4 rounded-lg border border-glass-border hover:bg-surface-container-high transition-all flex items-center gap-4 group cursor-pointer">
                <div className="w-12 h-12 bg-tertiary/10 text-tertiary rounded flex items-center justify-center shrink-0">
                  <MdOutlineTableChart size={24} />
                </div>
                <div className="flex-grow">
                  <h4 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">Constants & Formulas Sheet</h4>
                  <p className="text-text-muted text-xs mt-1">Last accessed 5 days ago • 120 KB</p>
                </div>
                <FiMoreVertical className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            
            <div className="mt-auto bg-surface-container-highest p-6 rounded-xl border-2 border-dashed border-outline-variant/50 flex flex-col items-center justify-center text-text-muted hover:bg-surface-container-high transition-all group cursor-pointer">
              <FiUploadCloud size={32} className="mb-2 group-hover:scale-110 transition-transform group-hover:text-primary" />
              <p className="text-sm font-medium">Drop PDF or Images to analyze</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
