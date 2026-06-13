import { motion } from 'framer-motion';
import { FiArrowRight, FiCpu, FiDatabase, FiLayers, FiMic } from 'react-icons/fi';

export default function LandingPage({ onGetStarted }) {
  const features = [
    {
      icon: <FiCpu className="text-2xl" />,
      title: 'AI-Powered Processing',
      description: 'Upload your notes and let our neural engine synthesize and extract the core concepts in seconds.'
    },
    {
      icon: <FiDatabase className="text-2xl" />,
      title: 'Vector Knowledge Base',
      description: 'Your notes are stored in a high-dimensional vector database for instant, context-aware retrieval.'
    },
    {
      icon: <FiLayers className="text-2xl" />,
      title: 'Automated Assessments',
      description: 'Generate rigorous, multi-format quizzes to test your knowledge against your own data.'
    },
    {
      icon: <FiMic className="text-2xl" />,
      title: 'Voice-Activated Querying',
      description: 'Interact with your study material hands-free using advanced speech-to-text models.'
    }
  ];

  return (
    <div className="min-h-screen w-full bg-transparent overflow-hidden font-sans transition-colors duration-300">
      
      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xl backdrop-blur-md shadow-sm dark:shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            L
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">Lumina Study</span>
        </div>
        <div className="flex gap-4">
          <button onClick={onGetStarted} className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-white transition-colors px-4 py-2">
            Login
          </button>
          <button onClick={onGetStarted} className="btn-primary">
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 mb-8 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 uppercase tracking-widest">v2.0 Beta Live</span>
            </div>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.15] text-slate-900 dark:text-white"
          >
            Master your material <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400">at machine speed.</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-2xl leading-relaxed"
          >
            The premium platform for processing, querying, and testing your knowledge base using advanced AI models in a focused, glassmorphic environment.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <button onClick={onGetStarted} className="btn-primary px-8 py-4 text-lg">
              Start Free Trial <FiArrowRight className="text-xl ml-1" />
            </button>
            <button onClick={onGetStarted} className="btn-secondary px-8 py-4 text-lg">
              View Documentation
            </button>
          </motion.div>
        </div>

        {/* Feature Bento Box */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-32 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((feature, idx) => (
            <div key={idx} className="dashboard-card p-8 group">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-6 group-hover:scale-110 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-all shadow-[0_0_15px_rgba(99,102,241,0)] group-hover:shadow-[0_0_20px_rgba(99,102,241,0.1)] dark:group-hover:shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                {feature.icon}
              </div>
              <h3 className="font-bold text-lg mb-3 text-slate-900 dark:text-white">{feature.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </motion.div>
      </main>

    </div>
  );
}
