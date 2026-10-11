import React, { useRef, useEffect } from 'react';

export function ChatInput({
  input,
  setInput,
  onSend,
  onStop,
  isProcessing,
  activeDocument,
  health,
  onAttachFile,
}) {
  const textareaRef = useRef(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 160);
      textareaRef.current.style.height = `${Math.max(newHeight, 44)}px`;
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isProcessing && input.trim() && activeDocument) {
        onSend();
      }
    }
  };

  const isDisabled = !activeDocument || isProcessing;
  const placeholderText = activeDocument
    ? `Ask a question about "${activeDocument.name}"...`
    : 'Select or upload a document to start asking questions...';

  const modelName = health?.llm?.model || 'Gemini 1.5 Pro';

  return (
    <div className="w-full max-w-4xl xl:max-w-5xl pb-5 px-3 sm:px-6 mx-auto z-20 shrink-0">
      {/* Clean, Standard Input Box */}
      <div
        className={`bg-white dark:bg-[#1a1c23] rounded-xl border transition-all p-2 sm:p-2.5 flex flex-col gap-2 shadow-sm ${
          !activeDocument
            ? 'opacity-85 border-slate-200 dark:border-[#282b35]'
            : 'border-slate-300 dark:border-[#2d313c] focus-within:border-blue-500 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-2.5 px-1.5">
          {/* Context attach button */}
          <button
            type="button"
            onClick={onAttachFile}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222530] transition-colors cursor-pointer"
            title="Attach or upload document"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Textarea Input */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!activeDocument}
            placeholder={placeholderText}
            className="w-full bg-transparent border-none text-[15px] sm:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-0 py-1.5 px-1 resize-none leading-relaxed"
          />

          {/* Model Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#222530] border border-slate-200 dark:border-[#2a2d38] text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="truncate max-w-[140px] font-mono">{modelName}</span>
          </div>

          {/* Mic Button */}
          <button
            type="button"
            onClick={() => {
              if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                const recognition = new SpeechRecognition();
                recognition.onresult = (e) => {
                  setInput((prev) => (prev ? prev + ' ' : '') + e.results[0][0].transcript);
                };
                recognition.start();
              } else {
                alert('Speech recognition is not supported in this browser.');
              }
            }}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222530] transition-colors cursor-pointer"
            title="Voice input"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 02-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          {/* Primary CTA Send / Stop Button */}
          {isProcessing ? (
            <button
              type="button"
              onClick={onStop}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center transition-all shrink-0 shadow-sm cursor-pointer"
              title="Stop generating"
            >
              <div className="w-3.5 h-3.5 bg-current rounded-xs" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={isDisabled || !input.trim()}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white flex items-center justify-center transition-all shrink-0 shadow-sm cursor-pointer disabled:cursor-not-allowed"
              title="Send query"
            >
              <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Footer Grounding Assurance Tag */}
      <div className="flex items-center justify-center gap-1.5 mt-2.5 text-xs text-slate-500 dark:text-slate-400">
        <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
        <span>Grounded responses generated strictly from retrieved document chunks</span>
      </div>
    </div>
  );
}
