import React from 'react';
import { Markdown } from '../utils/markdown';
import { ClaimVerification } from './ClaimVerification';

export const ChatMessage = React.memo(function ChatMessage({ message, activeDocument, onOpenPdf }) {
  const { role, content, sources = [], verification, model, isError, isStreaming, isVerifying } = message;
  const isUser = role === 'user';

  const safeSources = Array.isArray(sources) ? sources : [];

  return (
    <div className={`flex w-full gap-3.5 sm:gap-4 my-5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Assistant Avatar */}
      {!isUser && (
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600/10 dark:bg-[#20232c] border border-blue-500/20 dark:border-[#2d313c] text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${isStreaming ? 'animate-pulse' : ''}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
      )}

      {/* Message Body */}
      <div className={`max-w-[92%] sm:max-w-[88%] lg:max-w-[90%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Bubble */}
        <div
          className={`rounded-2xl px-5 py-4 text-[15px] sm:text-base leading-relaxed transition-all ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-xs shadow-md font-normal'
              : isError
              ? 'bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-bl-xs'
              : 'bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-[#282b35] text-slate-800 dark:text-[#f1f3f7] rounded-bl-xs shadow-xs'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
          ) : !content && isStreaming ? (
            <div className="flex items-center gap-2.5 text-slate-400 dark:text-slate-400 py-1 text-sm font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Retrieving evidence and reasoning...</span>
            </div>
          ) : (
            <div className="prose prose-slate dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 text-[15px] sm:text-base">
              <Markdown
                content={content}
                onOpenPdf={onOpenPdf}
                activeDocument={activeDocument}
              />
              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-1.5 bg-blue-500 rounded-xs animate-pulse align-middle shadow-xs" />
              )}
            </div>
          )}
        </div>

        {/* Source Citation Chips */}
        {!isUser && safeSources.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3 animate-in fade-in duration-300">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sources:</span>
            {safeSources.map((source, index) => {
              const isObj = typeof source === 'object' && source !== null;
              const sourceName = isObj ? source.source || 'Evidence' : String(source);
              const page = isObj ? source.page : null;
              const docId = (isObj && source.documentId) || activeDocument?.id;

              const hasPdfPage = page != null && docId;

              return hasPdfPage ? (
                <button
                  key={index}
                  type="button"
                  onClick={() => onOpenPdf(docId, page)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs sm:text-[13px] bg-slate-100 dark:bg-[#1c1e26] hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-[#b0b5c3] hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-[#282b35] hover:border-blue-300 dark:hover:border-blue-500/40 transition-colors font-mono cursor-pointer shadow-2xs"
                  title={`Open ${sourceName} at page ${page}`}
                >
                  <span className="text-xs">📌</span>
                  <span className="truncate max-w-[180px] font-medium">{sourceName}</span>
                  <span className="text-slate-500 dark:text-slate-400">· p. {page}</span>
                </button>
              ) : (
                <span
                  key={index}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs sm:text-[13px] bg-slate-100 dark:bg-[#1c1e26] text-slate-700 dark:text-[#b0b5c3] border border-slate-200 dark:border-[#282b35] font-mono shadow-2xs"
                >
                  <span className="text-xs">📌</span>
                  <span className="truncate max-w-[180px] font-medium">{sourceName}</span>
                  {page != null && <span className="text-slate-500 dark:text-slate-400">· p. {page}</span>}
                </span>
              );
            })}
          </div>
        )}

        {/* Verification in progress */}
        {!isUser && isVerifying && !verification && (
          <div className="inline-flex items-center gap-2 mt-2.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium animate-pulse">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <span>Verifying inline citations against document excerpts...</span>
          </div>
        )}

        {/* Claim Verification Card */}
        {!isUser && verification && (
          <div className="w-full mt-3 animate-in fade-in duration-300">
            <ClaimVerification
              verification={verification}
              sources={safeSources}
              activeDocument={activeDocument}
              onOpenPdf={onOpenPdf}
            />
          </div>
        )}

        {/* Model Tag */}
        {!isUser && model && (
          <div className="mt-2 text-xs font-mono text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <span>⚡ {model}</span>
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </div>
  );
});

export function TypingIndicator() {
  return (
    <div className="flex w-full gap-3.5 sm:gap-4 my-5 justify-start animate-in fade-in duration-200">
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600/10 dark:bg-[#20232c] border border-blue-500/20 dark:border-[#2d313c] text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 animate-pulse shadow-2xs">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <div className="rounded-2xl px-5 py-4 bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-[#282b35] text-slate-500 dark:text-slate-400 rounded-bl-xs flex items-center gap-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Searching documents and generating response...</span>
      </div>
    </div>
  );
}
