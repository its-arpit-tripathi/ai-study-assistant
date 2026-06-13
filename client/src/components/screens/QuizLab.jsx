import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../common/GlassCard';
import Button from '../common/Button';
import { FiCheck, FiX, FiArrowRight, FiBookOpen } from 'react-icons/fi';
import { generateQuiz } from '../../services/api';

const QuizLab = () => {
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [quizQuestions, setQuizQuestions] = useState([]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    setIsGenerating(true);
    setError('');
    try {
      const data = await generateQuiz(inputText, 'General', 5);
      if (data && data.length > 0) {
        setQuizQuestions(data);
        setCurrentIndex(0);
        setSelectedOption(null);
        setIsAnswered(false);
        setScore(0);
      } else {
        setError('No questions generated. Please try again with different notes.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate quiz. Ensure notes are sufficiently detailed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const currentQuestion = quizQuestions[currentIndex];

  const handleSelect = (idx) => {
    if (isAnswered) return;
    setSelectedOption(idx);
  };

  const handleSubmit = () => {
    if (selectedOption === null) return;
    setIsAnswered(true);
    if (selectedOption === currentQuestion.correct) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < quizQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      // Finished
      setCurrentIndex(currentIndex + 1);
    }
  };

  if (quizQuestions.length === 0) {
    return (
      <div className="w-full h-full p-4 md:p-8 flex items-center justify-center overflow-y-auto">
        <GlassCard className="w-full max-w-2xl flex flex-col p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
              <FiBookOpen size={32} />
            </div>
            <h1 className="text-2xl font-bold text-on-surface mb-2">Quiz Generator</h1>
            <p className="text-text-muted">Paste your study notes below and Lumina will generate a personalized quiz.</p>
          </div>

          <textarea
            className="w-full h-64 p-4 rounded-xl border border-glass-border bg-glass-fill text-on-surface resize-none focus:outline-none focus:border-primary transition-colors mb-4 custom-scrollbar"
            placeholder="Paste your notes or text here..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />

          {error && <p className="text-error text-sm text-center mb-4">{error}</p>}

          <Button 
            onClick={handleGenerate} 
            disabled={!inputText.trim() || isGenerating}
            className="w-full py-3"
          >
            {isGenerating ? 'Analyzing Notes & Generating Quiz...' : 'Generate 5 Questions'}
          </Button>
        </GlassCard>
      </div>
    );
  }

  // Quiz Finished State
  if (currentIndex >= quizQuestions.length) {
    return (
      <div className="w-full h-full p-4 md:p-8 flex items-center justify-center overflow-y-auto">
        <GlassCard className="w-full max-w-xl text-center p-8">
          <h2 className="text-3xl font-bold text-on-surface mb-4">Quiz Complete!</h2>
          <p className="text-text-muted text-lg mb-8">
            You scored <span className="text-primary font-bold">{score}</span> out of {quizQuestions.length}.
          </p>
          <div className="h-4 w-full bg-glass-fill rounded-full overflow-hidden border border-glass-border mb-8">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(score / quizQuestions.length) * 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-full ${score / quizQuestions.length >= 0.7 ? 'bg-secondary' : 'bg-primary'}`}
            />
          </div>
          <Button onClick={() => setQuizQuestions([])} className="w-full py-3">
            Generate Another Quiz
          </Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4 md:p-8 flex items-center justify-center overflow-y-auto">
      <div className="w-full max-w-3xl">
        
        {/* Header / Progress */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Quiz Lab</h1>
            <p className="text-text-muted text-sm">Question {currentIndex + 1} of {quizQuestions.length}</p>
          </div>
          
          <div className="relative w-12 h-12 flex items-center justify-center rounded-full border-2 border-glass-border">
            <span className="text-xs font-bold text-primary">{currentIndex + 1}/{quizQuestions.length}</span>
          </div>
        </div>

        {/* Flashcard / Question Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard className="mb-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-tertiary" />
              
              <h2 className="text-xl md:text-2xl font-semibold leading-relaxed mb-8 mt-2">
                {currentQuestion.question}
              </h2>

              <div className="space-y-3">
                {currentQuestion.options.map((optText, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = isAnswered && idx === currentQuestion.correct;
                  const isWrong = isAnswered && isSelected && idx !== currentQuestion.correct;
                  
                  let stateClasses = "hover:border-primary/30 hover:bg-primary/5";
                  if (isSelected && !isAnswered) {
                    stateClasses = "border-primary bg-primary/10 shadow-[0_0_15px_rgba(99,102,241,0.1)]";
                  } else if (isCorrect) {
                    stateClasses = "border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]";
                  } else if (isWrong) {
                    stateClasses = "border-error bg-error/10";
                  } else if (isAnswered) {
                    stateClasses = "opacity-50 cursor-default";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelect(idx)}
                      disabled={isAnswered}
                      className={`w-full text-left p-4 rounded-xl border border-glass-border bg-glass-fill backdrop-blur-md transition-all duration-300 flex items-center justify-between group ${stateClasses}`}
                    >
                      <span className="font-medium text-[15px]">{optText}</span>
                      
                      {isAnswered && (isCorrect || isWrong) && (
                        <motion.div 
                          initial={{ scale: 0 }} 
                          animate={{ scale: 1 }}
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-error text-white'}`}
                        >
                          {isCorrect ? <FiCheck /> : <FiX />}
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>

              {isAnswered && currentQuestion.explanation && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-6 p-4 rounded-lg bg-glass-fill border border-glass-border text-sm text-on-surface"
                >
                  <span className="font-bold text-primary mb-1 block">Explanation</span>
                  {currentQuestion.explanation}
                </motion.div>
              )}
            </GlassCard>
          </motion.div>
        </AnimatePresence>

        {/* Action Bar */}
        <div className="flex justify-end">
          {!isAnswered ? (
            <Button 
              onClick={handleSubmit} 
              disabled={selectedOption === null}
              className="w-full md:w-auto"
            >
              Submit Answer
            </Button>
          ) : (
            <Button 
              onClick={handleNext}
              className="w-full md:w-auto"
              icon={<FiArrowRight />}
            >
              {currentIndex < quizQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'}
            </Button>
          )}
        </div>

      </div>
    </div>
  );
};

export default QuizLab;
