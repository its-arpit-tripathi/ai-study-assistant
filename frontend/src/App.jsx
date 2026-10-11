import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, getToken, clearToken } from './utils/api';
import { AuthModal } from './components/AuthModal';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { WelcomeView } from './components/WelcomeView';
import { ChatMessage, TypingIndicator } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { PdfViewerModal } from './components/PdfViewerModal';
import { ToastContainer } from './components/Toast';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [activeDocument, setActiveDocument] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [health, setHealth] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Theme State: 'dark' | 'light'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  // PDF Viewer Modal State
  const [pdfModal, setPdfModal] = useState({
    isOpen: false,
    documentId: '',
    documentName: '',
    page: 1,
  });

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Apply theme to documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Toast helper
  const showToast = (message, type = 'info', duration = 4500) => {
    const id = Date.now() + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // High-performance autoscroll: instant direct scroll during streaming to prevent layout thrashing, smooth scroll on message completion
  useEffect(() => {
    if (isProcessing) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isProcessing]);

  const loadInitialData = async () => {
    try {
      const [docs, healthData] = await Promise.allSettled([
        api.getDocuments(),
        api.getHealth(),
      ]);

      if (docs.status === 'fulfilled' && Array.isArray(docs.value)) {
        setDocuments(docs.value);
        if (docs.value.length > 0) {
          api.warmDocument(docs.value[0].id);
        }
      }

      if (healthData.status === 'fulfilled') {
        setHealth(healthData.value);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  // Check auth session on startup
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const data = await api.getMe();
        setUser(data.user);
        await loadInitialData();
      } catch {
        clearToken();
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();
  }, []);

  // Handle successful login or registration
  const handleAuthenticated = async (authenticatedUser) => {
    setUser(authenticatedUser);
    await loadInitialData();
  };

  const handleSignOut = () => {
    clearToken();
    setUser(null);
    setDocuments([]);
    setActiveDocument(null);
    setMessages([]);
    showToast('Signed out successfully.', 'info');
  };

  // Select document
  const handleSelectDocument = (doc) => {
    setActiveDocument(doc);
    setMessages([]);
    setSidebarOpen(false);
    api.warmDocument(doc.id);
  };

  // Delete document
  const handleDeleteDocument = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"? This removes all indexed embeddings.`)) {
      return;
    }

    try {
      await api.deleteDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      if (activeDocument?.id === doc.id) {
        setActiveDocument(null);
        setMessages([]);
      }
      showToast(`"${doc.name}" deleted.`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete document.', 'error');
    }
  };

  // Document uploaded successfully
  const handleUploadSuccess = (newDoc) => {
    setDocuments((prev) => [newDoc, ...prev]);
    setActiveDocument(newDoc);
    setMessages([]);
    setSidebarOpen(false);
    api.warmDocument(newDoc.id);
  };

  // Stop / Cancel Generation Handler
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    showToast('Generation cancelled.', 'info', 2000);
  };

  // Send Chat Query (full verified response comes all at once)
  const handleSendMessage = async (queryToSend = null) => {
    const text = (queryToSend !== null ? queryToSend : input).trim();
    if (!text || !activeDocument || isProcessing) return;

    // Append user message
    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const assistantMsgId = `a-${Date.now()}`;
    const assistantPlaceholder = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      sources: [],
      verification: null,
      model: null,
      isStreaming: true,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setInput('');
    setIsProcessing(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let streamedText = '';
    let rafId = null;

    const flushStreamedText = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, content: streamedText } : msg
        )
      );
    };

    const scheduleTokenFlush = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          flushStreamedText();
        });
      }
    };

    try {
      await api.sendChatStream(text, activeDocument.collectionName, {
        signal: controller.signal,
        onSources: (sources, model) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, sources, model } : msg
            )
          );
        },
        onToken: (token) => {
          streamedText += token;
          scheduleTokenFlush();
        },
        onDraft: (draft) => {
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          if (draft?.answer) {
            streamedText = draft.answer;
          }
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: streamedText, isStreaming: false, isVerifying: true }
                : msg
            )
          );
        },
        onVerification: (verification) => {
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, verification, isStreaming: false, isVerifying: false }
                : msg
            )
          );
        },
        onDone: (doneData) => {
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: doneData?.answer || msg.content || streamedText,
                    sources: doneData?.sources || msg.sources,
                    verification: doneData?.verification || msg.verification,
                    model: doneData?.model || msg.model,
                    isStreaming: false,
                    isVerifying: false,
                  }
                : msg
            )
          );
        },
      });
    } catch (err) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (err.name === 'AbortError' || controller.signal.aborted) {
        return;
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: streamedText
                  ? `${streamedText}\n\n⚠️ *[Disconnected: ${err.message}]*`
                  : `⚠️ **Error generating response:** ${err.message || 'An unexpected error occurred. Please try again.'}`,
                isError: !streamedText,
                isStreaming: false,
                isVerifying: false,
              }
            : msg
        )
      );
      showToast(err.message || 'Failed to generate answer from server.', 'error');
    } finally {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  // Open PDF Modal handler
  const handleOpenPdf = useCallback((documentId, page) => {
    setPdfModal((prev) => {
      const docName = documents.find((d) => d.id === documentId)?.name || activeDocument?.name || 'Evidence Document';
      return {
        isOpen: true,
        documentId,
        documentName: docName,
        page: Number(page) || 1,
      };
    });
  }, [documents, activeDocument]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-50 dark:bg-[#121316] text-slate-600 dark:text-slate-300 gap-3.5 transition-colors">
        <div className="w-10 h-10 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-sm font-medium tracking-tight">Loading NotebookLM Intelligence...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthModal
          onAuthenticated={handleAuthenticated}
          showToast={showToast}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900 dark:bg-[#121316] dark:text-[#e6e8ec] transition-colors duration-150">
      {/* Left Sidebar */}
      <Sidebar
        documents={documents}
        activeDocument={activeDocument}
        onSelectDocument={handleSelectDocument}
        onDeleteDocument={handleDeleteDocument}
        onUploadSuccess={handleUploadSuccess}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        showToast={showToast}
        onOpenPdf={handleOpenPdf}
      />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navigation Bar */}
        <ChatHeader
          activeDocument={activeDocument}
          health={health}
          user={user}
          onSignOut={handleSignOut}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onResetActiveDocument={() => setActiveDocument(null)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Main Workspace Stage */}
        <main className="flex-1 flex flex-col justify-between items-center relative overflow-hidden bg-slate-50 dark:bg-[#121316] transition-colors duration-150">
          <div ref={scrollContainerRef} className="w-full flex-1 flex flex-col items-center overflow-y-auto px-4 sm:px-6 py-4 md:py-6">
            {messages.length === 0 ? (
              <WelcomeView
                activeDocument={activeDocument}
                onSelectPrompt={(prompt) => {
                  setInput(prompt);
                  handleSendMessage(prompt);
                }}
              />
            ) : (
              <div className="w-full max-w-4xl xl:max-w-5xl flex-1 flex flex-col py-2 px-1 sm:px-2">
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    activeDocument={activeDocument}
                    onOpenPdf={handleOpenPdf}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Bottom Chat Input with Stop Generating Support */}
          <ChatInput
            input={input}
            setInput={setInput}
            onSend={() => handleSendMessage()}
            onStop={handleStopGenerating}
            isProcessing={isProcessing}
            activeDocument={activeDocument}
            health={health}
            onAttachFile={() => setSidebarOpen(true)}
          />
        </main>
      </div>

      {/* PDF Evidence Modal */}
      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => setPdfModal((prev) => ({ ...prev, isOpen: false }))}
        documentId={pdfModal.documentId}
        documentName={pdfModal.documentName}
        page={pdfModal.page}
        showToast={showToast}
      />

      {/* Notification Toasts */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
