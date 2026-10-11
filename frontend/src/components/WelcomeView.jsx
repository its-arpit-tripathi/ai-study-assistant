import React from 'react';

export function WelcomeView({ activeDocument, onSelectPrompt }) {
  const suggestedPrompts = [
    'Summarize the core concepts and findings',
    'What methodology or approach is used?',
    'What are the key conclusions and takeaways?',
    'Compare the primary trade-offs discussed',
  ];

  const handleCardClick = (topic) => {
    if (activeDocument) {
      onSelectPrompt(`Explain ${topic} according to ${activeDocument.name}`);
    } else {
      onSelectPrompt(`Explain ${topic}`);
    }
  };

  return (
    <div className="w-full max-w-4xl xl:max-w-5xl my-auto flex flex-col items-center text-center relative z-10 pt-6 pb-8">
      {/* Clean Flat Central Emblem */}
      <div className="mb-6">
        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#1c1e26] border border-slate-200 dark:border-[#2d313c] p-3 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
      </div>

      {/* Hero Title */}
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white mb-3">
        NotebookLM Intelligence
      </h1>

      {/* Hero Subtitle */}
      <p className="text-slate-600 dark:text-[#9ea3b2] max-w-2xl text-[15px] sm:text-base leading-relaxed mb-10">
        {activeDocument ? (
          <>
            Ask questions about{' '}
            <span className="font-mono text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 bg-slate-200/60 dark:bg-[#1c1e26] px-2 py-0.5 rounded border border-slate-300 dark:border-[#2d313c] font-semibold">
              {activeDocument.name}
            </span>
            . Responses are strictly grounded in retrieved document chunks.
          </>
        ) : (
          'Upload documents or select an indexed source on the left to start grounded querying with verified citations.'
        )}
      </p>

      {/* Clean Matte Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-left mb-10">
        {/* Card 1: Document Ingestion */}
        <div
          onClick={() => handleCardClick('Document Ingestion')}
          className="p-5 rounded-xl bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-[#282b35] hover:border-blue-400 dark:hover:border-[#383d4a] transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#222530] text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-[#2e3240]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-[#222530] dark:text-slate-400 border border-slate-200 dark:border-[#2c303c]">
              PARSER
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">
            Document Ingestion
          </h3>
          <p className="text-xs sm:text-[13px] text-slate-500 dark:text-[#8a8f9f] leading-relaxed">
            PDF &amp; TXT semantic chunking and clean token alignment.
          </p>
        </div>

        {/* Card 2: Hybrid Search & Reranking */}
        <div
          onClick={() => handleCardClick('Hybrid Search & Reranking')}
          className="p-5 rounded-xl bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-[#282b35] hover:border-blue-400 dark:hover:border-[#383d4a] transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#222530] text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-[#2e3240]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-[#222530] dark:text-slate-400 border border-slate-200 dark:border-[#2c303c]">
              BM25+QDRANT
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">
            Hybrid Search &amp; Reranking
          </h3>
          <p className="text-xs sm:text-[13px] text-slate-500 dark:text-[#8a8f9f] leading-relaxed">
            Vector similarity matched with keyword BM25 rerankers.
          </p>
        </div>

        {/* Card 3: Verified Citations */}
        <div
          onClick={() => handleCardClick('Verified Citations')}
          className="p-5 rounded-xl bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-[#282b35] hover:border-blue-400 dark:hover:border-[#383d4a] transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#222530] text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-[#2e3240]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-[#222530] dark:text-slate-400 border border-slate-200 dark:border-[#2c303c]">
              GROUNDED
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">
            Verified Citations
          </h3>
          <p className="text-xs sm:text-[13px] text-slate-500 dark:text-[#8a8f9f] leading-relaxed">
            Directly mapped claims with page and sentence coordinates.
          </p>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      {activeDocument && (
        <div className="w-full flex flex-col items-center">
          <span className="text-xs sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-3">
            Suggested queries:
          </span>
          <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl">
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt(prompt)}
                className="text-xs sm:text-[13px] px-4 py-2 rounded-full bg-white dark:bg-[#1a1c22] border border-slate-200 dark:border-[#282b35] text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-xs hover:shadow-sm cursor-pointer"
              >
                ✨ {prompt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
