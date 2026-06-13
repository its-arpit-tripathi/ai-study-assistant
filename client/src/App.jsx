import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import AuthScreens from './components/screens/AuthScreens';
import Sidebar from './components/Sidebar';
import LibraryDashboard from './components/screens/LibraryDashboard';
import QuizLab from './components/screens/QuizLab';
import VoiceAssistant from './components/screens/VoiceAssistant';
import SubjectOverview from './components/screens/SubjectOverview';

function AppContent() {
  const { activeTab } = useApp();
  const { user, loading } = useAuth();
  const [showLanding, setShowLanding] = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"
        />
      </div>
    );
  }

  if (!user) {
    return <AuthScreens />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-on-surface font-sans transition-colors duration-300">
      {/* Sidebar - Pinned left on Desktop */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 h-screen relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full h-full"
          >
            {activeTab === 'library' && <LibraryDashboard />}
            {activeTab === 'upload' && <LibraryDashboard />} {/* Fallback if context has 'upload' */}
            {activeTab === 'quiz' && <QuizLab />}
            {activeTab === 'voice' && <VoiceAssistant />}
            {activeTab === 'subjects' && <SubjectOverview />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
