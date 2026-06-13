import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../common/GlassCard';
import SubjectTag from '../common/SubjectTag';
import { FiBook, FiClock, FiPlus, FiMoreVertical, FiSearch, FiX, FiUpload } from 'react-icons/fi';
import Input from '../common/Input';
import Button from '../common/Button';
import { useApp } from '../../context/AppContext';
import { summarizeNotes } from '../../services/api';

const LibraryDashboard = () => {
  const { notes, addNote, subjects } = useApp();
  const [activeSubject, setActiveSubject] = useState('All');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setInputText(prev => prev + (prev ? '\n\n' : '') + event.target.result);
    };
    reader.onerror = () => {
      setError("Failed to read file.");
    };
    reader.readAsText(file);
    e.target.value = null; // Reset input
  };

  // Use notes from AppContext, fallback to mock if empty for visual
  const recentFiles = notes.length > 0 ? notes : [
    { id: 1, title: 'Quantum Mechanics Overview', type: 'TXT', date: '2 hours ago', subject: 'Physics' },
    { id: 2, title: 'Calculus III - Chapter 4 Notes', type: 'TXT', date: '1 day ago', subject: 'Mathematics' },
  ];

  const handleSummarize = async () => {
    if (!inputText.trim()) return;
    setIsSummarizing(true);
    setError('');
    try {
      const summary = await summarizeNotes(inputText);
      addNote({
        title: inputText.substring(0, 30) + '...',
        text: inputText,
        summary: summary,
        subject: activeSubject !== 'All' ? activeSubject : 'General',
        type: 'TXT',
        date: 'Just now'
      });
      setInputText('');
      setShowUploadModal(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to summarize notes.');
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="w-full h-full p-4 md:p-8 overflow-y-auto">
      <div className="max-w-[1280px] mx-auto space-y-8">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-on-surface mb-2">My Library</h1>
            <p className="text-text-muted">Manage your study materials and generated quizzes.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-64 hidden md:block">
              <Input icon={<FiSearch />} placeholder="Search materials..." />
            </div>
            <Button icon={<FiPlus />} onClick={() => setShowUploadModal(true)}>Upload Notes</Button>
          </div>
        </div>

        {/* Subjects Tab/Filters */}
        <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
          {subjects.map(subject => (
            <SubjectTag 
              key={subject} 
              active={activeSubject === subject}
              onClick={() => setActiveSubject(subject)}
            >
              {subject}
            </SubjectTag>
          ))}
        </div>

        {/* Grid Layout for Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold text-on-surface">Recent Materials</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentFiles.map(file => (
                <GlassCard key={file.id} className="flex flex-col group cursor-pointer hover:border-primary/50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                      <FiBook className="text-xl" />
                    </div>
                    <button className="text-text-muted hover:text-on-surface p-1">
                      <FiMoreVertical />
                    </button>
                  </div>
                  <h3 className="font-semibold text-on-surface mb-1 line-clamp-2">{file.title}</h3>
                  <div className="flex items-center justify-between mt-auto pt-4 text-xs text-text-muted">
                    <span className="flex items-center gap-1"><FiClock /> {file.date}</span>
                    <span className="px-2 py-1 rounded bg-glass-fill border border-glass-border">{file.type}</span>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Right Sidebar Area (Stats / Quick Actions) */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-on-surface">Study Overview</h2>
            <GlassCard className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-muted">Weekly Goal</span>
                  <span className="text-primary font-medium">12 / 20 hrs</span>
                </div>
                <div className="h-2 w-full bg-glass-fill rounded-full overflow-hidden border border-glass-border">
                  <div className="h-full bg-secondary w-[60%] rounded-full shadow-[0_0_10px_theme(colors.secondary)]" />
                </div>
              </div>
              
              <div className="pt-4 border-t border-glass-border">
                <h3 className="text-sm font-semibold text-on-surface mb-3 uppercase tracking-wider">Suggested Actions</h3>
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-glass-fill transition-colors text-sm text-left">
                    <div className="text-tertiary bg-tertiary/10 p-2 rounded-md"><FiBook /></div>
                    <span className="font-medium">Review Quantum Mechanics</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-glass-fill transition-colors text-sm text-left">
                    <div className="text-secondary bg-secondary/10 p-2 rounded-md"><FiClock /></div>
                    <span className="font-medium">Take pending Quiz</span>
                  </button>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

      </div>

      {/* Upload/Paste Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-2xl"
            >
              <GlassCard className="flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-on-surface">Add Study Notes</h2>
                  <button onClick={() => setShowUploadModal(false)} className="text-text-muted hover:text-on-surface">
                    <FiX size={24} />
                  </button>
                </div>
                
                <textarea
                  className="w-full h-64 p-4 rounded-xl border border-glass-border bg-glass-fill text-on-surface resize-none focus:outline-none focus:border-primary transition-colors mb-4 custom-scrollbar"
                  placeholder="Paste your notes or text here to generate a summary..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />

                {error && <p className="text-error text-sm mb-4">{error}</p>}

                <div className="flex justify-between items-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".txt,.md,.csv"
                    className="hidden"
                  />
                  <Button 
                    variant="ghost" 
                    icon={<FiUpload />} 
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload File
                  </Button>
                  <div className="flex gap-4">
                    <Button variant="secondary" onClick={() => setShowUploadModal(false)}>Cancel</Button>
                    <Button onClick={handleSummarize} disabled={!inputText.trim() || isSummarizing}>
                      {isSummarizing ? 'Summarizing...' : 'Summarize Notes'}
                    </Button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LibraryDashboard;
