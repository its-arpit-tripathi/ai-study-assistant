import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { generateQuiz } from '../services/api';
import { FiCpu, FiLoader, FiCheckCircle, FiXCircle, FiRefreshCw, FiZap, FiLayers } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function QuizGenerator() {
  const { getFilteredNotes, activeSubject, getAllNotesText } = useApp();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [questionCount, setQuestionCount] = useState(5);

  const handleGenerate = async () => {
    const notesText = getAllNotesText();
    if (!notesText.trim()) {
      setError('No data found. Ingest some data first to run evaluation.');
      return;
    }

    setLoading(true);
    setError('');
    setQuiz(null);
    setCurrentQ(0);
    setSelectedAnswers({});
    setShowResults(false);

    try {
      const result = await generateQuiz(notesText, activeSubject === 'All' ? '' : activeSubject, questionCount);
      setQuiz(result);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not generate evaluation.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = (qIndex, optionIndex) => {
    if (showResults) return;
    setSelectedAnswers({ ...selectedAnswers, [qIndex]: optionIndex });
  };

  const handleSubmitQuiz = () => {
    setShowResults(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getScore = () => {
    if (!quiz) return 0;
    let correct = 0;
    quiz.forEach((q, i) => {
      if (selectedAnswers[i] === q.correct) correct++;
    });
    return correct;
  };

  const getOptionClass = (qIndex, optIndex) => {
    if (!showResults) {
      return selectedAnswers[qIndex] === optIndex ? 'selected' : '';
    }
    const q = quiz[qIndex];
    if (optIndex === q.correct) return 'correct';
    if (selectedAnswers[qIndex] === optIndex && optIndex !== q.correct) return 'wrong';
    return 'opacity-50';
  };

  const notes = getFilteredNotes();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-4xl mx-auto relative z-10"
    >
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold mb-2 text-slate-900 dark:text-white tracking-tight">Knowledge Evaluation</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Assess your understanding with AI-generated questions
          </p>
        </div>
        {activeSubject !== 'All' && (
          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-3 py-1.5 rounded-full inline-flex self-start md:self-auto items-center gap-2 backdrop-blur-sm transition-colors">
            <span className="text-indigo-500 dark:text-indigo-400">Filter:</span> {activeSubject}
          </div>
        )}
      </div>

      {notes.length === 0 ? (
        <motion.div 
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="dashboard-card p-12 text-center border-dashed border-slate-300 dark:border-white/10"
        >
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-5xl mb-6 flex justify-center text-slate-400 dark:text-slate-600">
            <FiLayers />
          </motion.div>
          <p className="text-lg font-bold mb-2 text-slate-900 dark:text-white">Awaiting Data Ingestion</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">Provide input data before running the evaluation sequence.</p>
        </motion.div>
      ) : !quiz ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ scale: 1, opacity: 1 }}
          className="dashboard-card p-8 md:p-12 text-center max-w-lg mx-auto"
        >
          <div className="mb-8">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-widest block mb-4">Evaluation Parameters</label>
            <div className="relative w-full sm:w-2/3 mx-auto">
              <select
                id="question-count"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="input-field text-center appearance-none pr-8 font-semibold text-sm"
              >
                {[3, 5, 8, 10, 15].map(n => (
                  <option key={n} value={n}>{n} Questions</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500 dark:text-indigo-400 text-xs">
                ▼
              </div>
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-8 bg-slate-100 dark:bg-white/5 py-2 px-4 rounded-full border border-slate-200 dark:border-white/10 inline-block transition-colors">
            Target Data: {notes.length} document{notes.length > 1 ? 's' : ''}
          </p>
          <button
            id="generate-quiz-btn"
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary w-full py-4 text-base"
          >
            {loading ? (
              <><FiLoader className="animate-spin text-lg" /> Compiling...</>
            ) : (
              <><FiCpu className="text-lg" /> Generate Evaluation</>
            )}
          </button>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Progress */}
          {!showResults && (
            <div className="flex items-center gap-4 mb-8 p-4 dashboard-card text-sm font-semibold text-slate-500 dark:text-slate-400">
              <div className="flex-1 h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(Object.keys(selectedAnswers).length / quiz.length) * 100}%` }}
                  className="h-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                />
              </div>
              <span>
                <span className="text-emerald-600 dark:text-emerald-400">{Object.keys(selectedAnswers).length}</span> / {quiz.length}
              </span>
            </div>
          )}

          {/* Score Card */}
          <AnimatePresence>
            {showResults && (
              <motion.div 
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="dashboard-card mb-8 p-8 text-center bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)] transition-colors"
              >
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">Evaluation Complete</p>
                <motion.p 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="text-7xl font-extrabold mb-4 tracking-tighter text-slate-900 dark:text-white"
                >
                  {getScore()}<span className="text-4xl opacity-50 text-slate-500">/{quiz.length}</span>
                </motion.p>
                <p className="text-xs font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 inline-block px-4 py-2 rounded-full mb-8 text-slate-600 dark:text-slate-300 uppercase tracking-widest shadow-sm">
                  {getScore() === quiz.length ? 'Status: Optimal Performance' :
                   getScore() >= quiz.length * 0.7 ? 'Status: Acceptable Variance' :
                   getScore() >= quiz.length * 0.5 ? 'Status: Suboptimal' :
                   'Status: Review Recommended'}
                </p>
                <div>
                  <button
                    id="retake-quiz-btn"
                    onClick={handleGenerate}
                    className="btn-primary !bg-white !text-slate-900 hover:!bg-slate-200"
                  >
                    <FiRefreshCw /> Retake Evaluation
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Questions */}
          <div className="space-y-6">
            {quiz.map((q, qIndex) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qIndex * 0.05 }}
                key={qIndex} 
                className="dashboard-card p-6 md:p-8"
              >
                <p className="font-bold text-xl mb-6 text-slate-900 dark:text-white flex items-start gap-4">
                  <span className="inline-flex w-10 h-10 rounded-xl items-center justify-center text-sm font-bold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-300 flex-shrink-0 shadow-inner">
                    {qIndex + 1}
                  </span>
                  <span className="leading-relaxed mt-1">{q.question}</span>
                </p>
                <div className="flex flex-col gap-3">
                  {q.options.map((option, optIndex) => (
                    <button
                      key={optIndex}
                      onClick={() => handleSelectAnswer(qIndex, optIndex)}
                      disabled={showResults}
                      className={`text-left flex items-center gap-4 quiz-option ${getOptionClass(qIndex, optIndex)}`}
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors border ${selectedAnswers[qIndex] === optIndex || (showResults && optIndex === q.correct) ? 'border-transparent text-white' : 'border-slate-300 dark:border-white/20 text-slate-500 dark:text-slate-400 bg-white dark:bg-white/5'}`}>
                        {showResults && optIndex === q.correct ? <FiCheckCircle className="text-emerald-500 dark:text-emerald-400 text-xl" /> :
                         showResults && selectedAnswers[qIndex] === optIndex && optIndex !== q.correct ? <FiXCircle className="text-red-500 dark:text-red-400 text-xl" /> :
                         String.fromCharCode(65 + optIndex)}
                      </span>
                      <span>{option}</span>
                    </button>
                  ))}
                </div>
                
                <AnimatePresence>
                  {showResults && q.explanation && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                      className="p-5 rounded-xl text-sm bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20 text-slate-700 dark:text-slate-300 flex gap-4 items-start shadow-inner transition-colors"
                    >
                      <span className="text-indigo-500 dark:text-indigo-400 mt-1"><FiZap className="text-lg" /></span>
                      <p className="leading-relaxed"><strong className="text-indigo-600 dark:text-indigo-300 uppercase tracking-widest block mb-1 text-[10px]">Explanation</strong> {q.explanation}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          {/* Submit Button */}
          {!showResults && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 flex justify-end"
            >
              <button
                id="submit-quiz-btn"
                onClick={handleSubmitQuiz}
                disabled={Object.keys(selectedAnswers).length < quiz.length}
                className="btn-primary !px-8 py-3.5 text-base"
              >
                <FiCheckCircle className="text-xl" /> Finalize Evaluation
              </button>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
