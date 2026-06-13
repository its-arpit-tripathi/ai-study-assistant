import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { summarizeNotes } from '../services/api';
import ReactMarkdown from 'react-markdown';
import { FiUploadCloud, FiFileText, FiCheck, FiLoader, FiZap } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function UploadNotes() {
  const { subjects, addNote, activeSubject } = useApp();
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(activeSubject === 'All' ? 'General' : activeSubject);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setText(e.target.result);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleSummarize = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setSummary('');
    try {
      const result = await summarizeNotes(text);
      setSummary(result);
      addNote({
        text: text,
        summary: result,
        subject: selectedSubject,
        fileName: fileName || 'Manual Input',
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'API connection failed. Check access token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-4xl mx-auto relative z-10"
    >
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2 text-slate-900 dark:text-white tracking-tight">Data Ingestion</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Feed data into the neural engine for processing</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-300 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors">
          <span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
          Ready to process
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Subject selector */}
        <div className="md:col-span-1">
          <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Target Folder</label>
          <div className="relative">
            <select
              id="subject-selector"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="input-field appearance-none cursor-pointer pr-10"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400 text-sm">
              ▼
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Data Source</label>
          <div
            id="upload-zone"
            className={`upload-zone flex flex-col items-center justify-center h-[46px] ${dragging ? 'dragging' : ''} !p-0 border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-500/5`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.text"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <div className="flex items-center justify-center gap-3 w-full h-full">
              <FiUploadCloud className="text-xl text-emerald-500 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                {fileName ? (
                  <span className="flex items-center gap-2 text-slate-900 dark:text-white">
                    <FiFileText /> {fileName}
                  </span>
                ) : (
                  'Select or drop file'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Text Area */}
      <div className="mb-8">
        <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Raw Content</label>
        <div className="relative">
          <div className="absolute top-0 left-0 bottom-0 w-8 bg-slate-100 dark:bg-white/5 border-r border-slate-200 dark:border-white/10 rounded-l-md flex flex-col items-center py-3 backdrop-blur-md transition-colors">
            {[1,2,3,4,5,6].map(i => <div key={i} className="text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-relaxed">{i}</div>)}
          </div>
          <textarea
            id="notes-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your study material here..."
            rows={8}
            className="input-field resize-none pl-12 text-sm leading-relaxed"
          />
        </div>
      </div>

      {/* Summarize Button */}
      <div className="flex justify-end">
        <button
          id="summarize-btn"
          onClick={handleSummarize}
          disabled={loading || !text.trim()}
          className="btn-primary"
        >
          {loading ? (
            <><FiLoader className="animate-spin" /> Processing Data</>
          ) : (
            <><FiZap /> Generate Summary</>
          )}
        </button>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Result */}
      <AnimatePresence>
        {summary && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="dashboard-card mt-8 p-6 md:p-8"
          >
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-white/10 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(16,185,129,0.1)] dark:shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <FiCheck />
              </div>
              <div>
                <h3 className="font-bold text-xl text-slate-900 dark:text-white">
                  Processed Summary
                </h3>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">Ready to Review</p>
              </div>
            </div>
            <div className="markdown-content">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
