import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../common/Button';
import GlassCard from '../common/GlassCard';
import Input from '../common/Input';
import { FiMic, FiSend, FiMoreHorizontal } from 'react-icons/fi';
import { askQuestion } from '../../services/api';
import { useApp } from '../../context/AppContext';

const VoiceAssistant = () => {
  const { getAllNotesText } = useApp();
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hello! I'm Lumina. What would you like to study today?" }
  ]);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      return; 
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Voice Recognition. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true; 
      recognition.lang = 'en-US';

      const resetSilenceTimeout = () => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current) recognitionRef.current.stop();
        }, 3000); // 5 seconds of silence stops recognition
      };

      recognition.onstart = () => {
        setIsListening(true);
        setInterimText('');
        resetSilenceTimeout();
      };
      
      recognition.onresult = (event) => {
        resetSilenceTimeout();
        
        let finalTranscript = '';
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            currentInterim += transcript;
          }
        }

        if (finalTranscript) {
          setInputText(prev => (prev ? prev + ' ' : '') + finalTranscript.trim());
        }
        setInterimText(currentInterim);
      };

      recognition.onerror = (event) => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        console.error("Speech recognition error", event.error);
        if (event.error !== 'no-speech') {
          alert(`Microphone error: ${event.error}. Please ensure you have granted microphone permissions.`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        setIsListening(false);
        setInterimText('');
      };

      recognition.start();
      setIsListening(true); // set immediately so UI responds
    } catch (err) {
      console.error(err);
      alert("Failed to start the microphone. It might already be in use.");
      setIsListening(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isProcessing) return;

    const userMessage = inputText;
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsProcessing(true);

    try {
      const context = getAllNotesText();
      const answer = await askQuestion(userMessage, context);
      setMessages(prev => [...prev, { role: 'assistant', text: answer }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', text: "I'm sorry, I encountered an error connecting to my core logic. Please try again." }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 max-w-4xl mx-auto relative">
      
      {/* Chat Area */}
      <div className="w-full flex-1 overflow-y-auto mb-6 pr-2 custom-scrollbar flex flex-col justify-end min-h-[400px]">
        <div className="space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white rounded-br-sm' 
                      : 'bg-glass-fill border border-glass-border text-on-surface rounded-bl-sm backdrop-blur-md'
                  }`}
                >
                  {/* Using basic pre-wrap for markdown rendering simplicity for now */}
                  <div className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                </div>
              </motion.div>
            ))}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex justify-start"
              >
                <div className="max-w-[80%] md:max-w-[70%] p-4 rounded-2xl bg-glass-fill border border-glass-border text-on-surface rounded-bl-sm backdrop-blur-md flex items-center gap-2">
                  <FiMoreHorizontal className="animate-pulse text-tertiary text-xl" />
                  <span className="text-sm text-text-muted">Thinking...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <GlassCard className="w-full flex flex-col md:flex-row items-center p-4 gap-4 rounded-[2rem]">
        {/* Glow effect behind microphone */}
        <div className={`absolute top-1/2 left-4 md:left-8 -translate-y-1/2 w-16 h-16 rounded-full transition-all duration-700 pointer-events-none ${isProcessing || isListening ? 'bg-tertiary/30 blur-xl' : 'bg-transparent blur-none'}`} />
        
        <form onSubmit={handleSend} className="w-full flex items-center gap-4 z-10 relative">
          <Button 
            type="button"
            variant="secondary" 
            onClick={toggleListening}
            className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center p-0 transition-colors ${isListening ? 'text-emerald-500 border-emerald-500 bg-emerald-500/10' : 'hover:text-emerald-600 hover:border-emerald-600'}`}
            title="Use Voice"
            icon={<FiMic className="text-xl" />}
          />
          
          <input
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-on-surface placeholder:text-text-muted text-base px-2 py-3"
            placeholder="Ask Lumina anything about your study notes..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isProcessing}
          />

          <Button 
            type="submit"
            variant="primary"
            disabled={isProcessing}
            className={`w-12 h-12 rounded-full flex items-center justify-center p-0 flex-shrink-0 transition-opacity ${!inputText.trim() ? 'opacity-50' : 'opacity-100'}`}
            icon={<FiSend className="text-xl" />}
          />
        </form>
      </GlassCard>

      {/* Immersive ChatGPT-style Orb Overlay */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-3xl overflow-hidden rounded-3xl"
          >
            {/* The Glowing Orb */}
            <div className="relative w-64 h-64 flex items-center justify-center cursor-pointer" onClick={toggleListening}>
              {/* Outer massive soft glow */}
              <motion.div
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.2, 0.5, 0.2],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-emerald-500 blur-[100px] rounded-full"
              />
              
              {/* Core fluid body */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 0.95, 1.05, 1],
                  rotate: [0, 90, 180, 270, 360],
                  borderRadius: [
                    "50%", 
                    "40% 60% 70% 30% / 40% 50% 60% 50%", 
                    "60% 40% 30% 70% / 60% 30% 70% 40%",
                    "50% 50% 60% 40% / 40% 60% 50% 60%",
                    "50%"
                  ]
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                className="relative w-32 h-32 bg-gradient-to-tr from-emerald-400 via-teal-500 to-emerald-600 shadow-[0_0_60px_rgba(16,185,129,0.8)]"
              />
            </div>

            <div className="mt-12 h-20 px-8 flex flex-col items-center justify-center text-center max-w-lg">
              <AnimatePresence mode="wait">
                {interimText || inputText ? (
                  <motion.p
                    key="transcribed"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-lg md:text-2xl font-medium text-on-surface line-clamp-3 leading-relaxed"
                  >
                    {inputText && <span className="opacity-50">{inputText} </span>}
                    {interimText && <span className="opacity-100 text-emerald-600 dark:text-emerald-400">{interimText}</span>}
                  </motion.p>
                ) : (
                  <motion.p 
                    key="listening"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-on-surface font-medium tracking-[0.2em] uppercase text-sm opacity-70"
                  >
                    Listening...
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-4 text-text-muted text-sm"
            >
              Tap the orb to stop
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default VoiceAssistant;
