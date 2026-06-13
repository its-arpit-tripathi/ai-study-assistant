import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiArrowLeft } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }
};

export default function AuthScreen({ onBack }) {
  const { login, signup } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const action = isLogin ? login : signup;
    const result = await action(email, password);

    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-transparent transition-colors duration-300 relative overflow-hidden font-sans">

      {/* Decorative Glows */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-violet-500/10 blur-[120px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/3" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        {onBack && (
          <button 
            onClick={onBack}
            className="mb-8 flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <FiArrowLeft /> Return to Home
          </button>
        )}

        <div className="glass-floating p-8 md:p-10">
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <motion.div variants={itemVariants} className="mb-10 text-center">
              <div className="flex justify-center mb-6">
                <motion.div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-2xl font-bold shadow-[0_0_20px_rgba(99,102,241,0.1)] dark:shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                >
                  L
                </motion.div>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                {isLogin ? 'Welcome back' : 'Create an account'}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {isLogin ? 'Enter your details to access your workspace.' : 'Sign up to start organizing your knowledge.'}
              </p>
            </motion.div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="p-3 rounded-md bg-red-500/10 text-red-400 text-sm font-medium border border-red-500/20 text-center"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div variants={itemVariants}>
                <label className="block text-xs font-semibold mb-2 text-slate-600 dark:text-slate-300 uppercase tracking-widest">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-400">
                    <FiMail />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-10"
                    placeholder="name@example.com"
                  />
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="block text-xs font-semibold mb-2 text-slate-600 dark:text-slate-300 uppercase tracking-widest">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-400">
                    <FiLock />
                  </div>
                  <input
                    type="password"
                    required
                    minLength="6"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-10"
                    placeholder="••••••••"
                  />
                </div>
              </motion.div>

              <motion.button
                variants={itemVariants}
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-8 py-3.5 text-base shadow-[0_0_20px_rgba(99,102,241,0.3)]"
              >
                {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
              </motion.button>
            </form>

            <motion.div variants={itemVariants} className="mt-8 text-center text-sm pt-6 border-t border-slate-200 dark:border-white/10">
              <span className="text-slate-500 dark:text-slate-400">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
              </span>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors ml-1"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
