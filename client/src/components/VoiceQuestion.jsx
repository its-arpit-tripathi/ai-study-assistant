import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { askQuestion } from '../services/api';
import ReactMarkdown from 'react-markdown';
import { FiMic, FiMicOff, FiSend, FiLoader, FiVolume2, FiZap, FiMessageSquare } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function VoiceQuestion() {
  const { getAllNotesText } = useApp();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [history, setHistory] = useState([]);
  const recognitionRef = useRef(null);

  // Check for speech recognition support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasSpeechSupport = !!SpeechRecognition;

  const startRecording = () => {
    if (!hasSpeechSupport) {
      setError('Speech recognition unsupported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript('');
      setError('');
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interimTranscript += t;
        }
      }
      setTranscript(finalTranscript || interimTranscript);
      if (finalTranscript) {
        setQuestion(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      setIsRecording(false);
      if (event.error !== 'aborted') {
        setError(`Error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleAsk = async () => {
    const q = question.trim();
    if (!q) return;

    setLoading(true);
    setError('');
    setAnswer('');

    try {
      const context = getAllNotesText();
      const result = await askQuestion(q, context);
      setAnswer(result);
      setHistory(prev => [{ question: q, answer: result, time: new Date().toLocaleTimeString() }, ...prev]);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not retrieve answer. Check connection.');
    } finally {
      setLoading(false);
    }
  };

  const speakAnswer = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      // Strip markdown formatting for speech
      const plainText = text.replace(/[#*`_\[\]()]/g, '').replace(/\n+/g, '. ');
      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-4xl mx-auto relative z-10"
    >
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold mb-2 text-slate-900 dark:text-white tracking-tight">Voice Query</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ask questions naturally using your voice</p>
        </div>
      </div>

      {/* Main Input Area */}
      <div className="dashboard-card p-6 md:p-8 mb-8 bg-white/50 dark:bg-white/[0.02]">
        <div className="flex flex-col md:flex-row gap-6 items-center">
          {/* Voice Input */}
          <div className="flex flex-col items-center relative flex-shrink-0">
            {isRecording && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.3, 1.8], opacity: [0.3, 0.1, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                className="absolute top-0 w-24 h-24 bg-rose-500 rounded-full pointer-events-none"
              />
            )}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              id="mic-btn"
              onClick={isRecording ? stopRecording : startRecording}
              className={`mic-btn relative z-10 w-24 h-24 rounded-full flex items-center justify-center text-3xl shadow-[0_4px_30px_rgba(0,0,0,0.1)] backdrop-blur-md transition-all duration-300 border ${
                isRecording 
                  ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_20px_rgba(244,63,94,0.5)]' 
                  : 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20 text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 hover:border-violet-300 dark:hover:border-violet-500/40 hover:bg-violet-100 dark:hover:bg-violet-500/20'
              }`}
              title={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
              {isRecording ? <FiMicOff /> : <FiMic />}
            </motion.button>
            <div className="mt-4 text-center h-8 font-semibold tracking-widest text-[10px] uppercase">
              <AnimatePresence mode="wait">
                {isRecording ? (
                  <motion.div 
                    key="recording"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="flex items-center gap-2 text-rose-400">
                      <span className="w-2 h-2 bg-rose-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                      Listening...
                    </span>
                  </motion.div>
                ) : (
                  <motion.p 
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-slate-500"
                  >
                    {hasSpeechSupport ? 'Standby' : 'Disabled'}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Text Input */}
          <div className="flex-1 w-full flex flex-col gap-3">
            <div className="relative">
              <input
                id="question-input"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your question or use the mic..."
                className="input-field py-4 text-base px-5 shadow-inner"
              />
            </div>
            {transcript && (
              <p className="text-sm italic text-violet-500 dark:text-violet-300 pl-4 border-l-2 border-violet-200 dark:border-violet-500/30">
                "{transcript}"
              </p>
            )}
            <div className="flex justify-end mt-2">
              <button
                id="ask-btn"
                onClick={handleAsk}
                disabled={loading || !question.trim()}
                className="btn-primary flex items-center justify-center gap-2 w-full md:w-auto text-base !px-8 py-3.5"
              >
                {loading ? (
                  <><FiLoader className="animate-spin" /> Querying...</>
                ) : (
                  <><FiSend /> Ask Question</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Answer */}
      <AnimatePresence>
        {answer && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="dashboard-card p-6 md:p-8 mb-8 border border-violet-200 dark:border-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.05)] transition-colors"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-white/10 transition-colors">
              <h3 className="font-bold flex items-center gap-4 text-xl text-slate-900 dark:text-white">
                <span className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xl shadow-inner border border-violet-200 dark:border-violet-500/20">
                  <FiZap />
                </span>
                AI Response
              </h3>
              <button
                id="speak-answer-btn"
                onClick={() => speakAnswer(answer)}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest py-2 px-4 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-white/5 hover:text-violet-600 dark:hover:text-violet-300 hover:border-violet-300 dark:hover:border-violet-500/30 transition-colors shadow-sm backdrop-blur-sm"
                title="Read aloud"
              >
                <FiVolume2 className="text-base" /> Audio
              </button>
            </div>
            <div className="markdown-content">
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      {history.length > 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12">
          <div className="flex items-center gap-4 mb-6">
            <h3 className="font-semibold text-xs uppercase tracking-widest text-slate-500 dark:text-slate-500">Query History</h3>
            <div className="h-[1px] flex-1 bg-slate-200 dark:bg-white/10" />
          </div>
          <div className="space-y-4">
            {history.slice(1).map((item, i) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={i} 
                className="dashboard-card p-6 bg-white/50 dark:bg-white/[0.01]"
              >
                <p className="text-sm font-semibold mb-4 text-slate-800 dark:text-slate-200 flex items-start gap-3">
                  <span className="text-violet-500 dark:text-violet-400 mt-1"><FiMessageSquare /></span> {item.question}
                </p>
                <div className="markdown-content text-sm text-slate-600 dark:text-slate-400 pl-4 border-l-2 border-slate-200 dark:border-white/10">
                  <ReactMarkdown>{item.answer.length > 200 ? item.answer.slice(0, 200) + '...' : item.answer}</ReactMarkdown>
                </div>
                <p className="font-semibold text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-600 mt-4 pl-4">{item.time}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
