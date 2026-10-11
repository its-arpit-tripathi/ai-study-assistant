import React, { useRef, useState } from 'react';
import { api } from '../utils/api';

export function Sidebar({
  documents,
  activeDocument,
  onSelectDocument,
  onDeleteDocument,
  onUploadSuccess,
  isOpen,
  onClose,
  showToast,
  onOpenPdf,
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ percent: 0, text: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleProcessUpload(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) handleProcessUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProcessUpload = async (file) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'txt'].includes(ext)) {
      showToast('Only PDF and TXT files are supported.', 'error');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showToast('File exceeds the 20MB limit.', 'error');
      return;
    }

    if (isUploading) {
      showToast('Please wait for the current upload to finish.', 'info');
      return;
    }

    setIsUploading(true);
    setUploadProgress({ percent: 25, text: 'Uploading file to server...' });

    try {
      const p1 = setTimeout(() => {
        setUploadProgress({ percent: 55, text: 'Extracting text & recursive chunking...' });
      }, 1000);

      const p2 = setTimeout(() => {
        setUploadProgress({ percent: 80, text: 'Generating embeddings & indexing Qdrant...' });
      }, 2500);

      const res = await api.uploadDocument(file);

      clearTimeout(p1);
      clearTimeout(p2);

      const chunkCount = Number(res.document?.chunkCount ?? res.document?.chunks ?? 0);
      const isCompleted = res.document?.status === 'indexed' && chunkCount > 0;

      setUploadProgress({
        percent: 100,
        text: isCompleted ? 'Indexing complete!' : 'Processing embeddings in background...',
      });

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress({ percent: 0, text: '' });
        if (isCompleted) {
          showToast(`"${res.document.name}" processed (${chunkCount} chunks)!`, 'success');
        } else {
          showToast(`"${res.document.name}" uploaded. Processing chunks in background...`, 'info');
        }
        onUploadSuccess(res.document);
      }, 600);
    } catch (err) {
      setIsUploading(false);
      setUploadProgress({ percent: 0, text: '' });
      showToast(err.message || 'Failed to upload document.', 'error');
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalChunks = documents.reduce(
    (acc, doc) => acc + (Number(doc.chunkCount ?? doc.chunk_count ?? doc.chunks) || 0),
    0
  );
  const progressPercent = Math.min(Math.round((totalChunks / 50000) * 100), 100);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 lg:static w-80 lg:w-[340px] xl:w-[360px] flex-shrink-0 border-r border-slate-200 dark:border-[#242730] bg-slate-50/95 dark:bg-[#16181d] flex flex-col justify-between overflow-hidden transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="p-4 sm:p-5 flex flex-col h-full overflow-hidden">
          {/* Mobile Close Header */}
          <div className="flex items-center justify-between pb-3 lg:hidden border-b border-slate-200 dark:border-[#242730] mb-3">
            <span className="font-semibold text-base text-slate-800 dark:text-white">Documents & Sources</span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative group cursor-pointer border border-dashed rounded-xl p-5 sm:p-6 text-center transition-all mb-4 shadow-2xs ${
              isDragging
                ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/15 ring-2 ring-blue-500/20'
                : 'border-slate-300 dark:border-[#313542] hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-[#1b1d24]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-[#242732] flex items-center justify-center text-slate-700 dark:text-slate-300 mb-2.5 shadow-2xs">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">Drop document here</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">PDF or TXT up to 20MB</p>
            </div>
          </div>

          {/* Upload Progress Card */}
          {isUploading && (
            <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate">{uploadProgress.text}</p>
            </div>
          )}

          {/* Sources Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200 dark:border-[#242730]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sources</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 dark:bg-[#252834] text-slate-700 dark:text-slate-300">
                {documents.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs sm:text-[13px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add</span>
            </button>
          </div>

          {/* Search Box if documents > 3 */}
          {documents.length > 3 && (
            <div className="mb-2.5">
              <input
                type="text"
                placeholder="Search sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg bg-white dark:bg-[#1a1c22] border border-slate-200 dark:border-[#2c2f36] text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Sources Scrollable List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {filteredDocs.length === 0 ? (
              <div className="text-center py-12 text-xs sm:text-sm text-slate-400 dark:text-slate-500">
                <p className="font-medium">No documents uploaded yet.</p>
                <p className="mt-1 text-xs">Upload a PDF or TXT above to begin.</p>
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isActive = activeDocument?.id === doc.id;
                const ext = doc.name.split('.').pop()?.toUpperCase() || 'DOC';

                return (
                  <div
                    key={doc.id}
                    onClick={() => onSelectDocument(doc)}
                    className={`rounded-xl p-3.5 transition-all cursor-pointer ${
                      isActive
                        ? 'border border-blue-500/50 bg-blue-50/50 dark:bg-[#1b1d24] shadow-sm ring-1 ring-blue-500/20'
                        : 'border border-slate-200 dark:border-[#282b35] bg-white dark:bg-[#1a1c22] hover:border-slate-300 dark:hover:border-[#353945]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* File Extension Badge */}
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 font-mono text-[10px] font-bold border border-rose-500/20 shadow-2xs">
                          {ext === 'PDF' ? 'PDF' : 'TXT'}
                        </div>

                        {/* Title & Stats */}
                        <div className="min-w-0">
                          <h4
                            className={`text-xs sm:text-[13px] font-medium truncate font-mono leading-tight ${
                              isActive
                                ? 'text-blue-600 dark:text-white font-semibold'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                            title={doc.name}
                          >
                            {doc.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {doc.status === 'processing' ? (
                              <>
                                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                                <span className="text-amber-500 dark:text-amber-400 font-medium">Processing chunks...</span>
                              </>
                            ) : doc.status === 'queued' ? (
                              <>
                                <span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-pulse shrink-0" />
                                <span className="text-sky-500 dark:text-sky-400 font-medium">Queued in background...</span>
                              </>
                            ) : doc.status === 'failed' ? (
                              <>
                                <span className="inline-block w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                <span className="text-rose-500 dark:text-rose-400 font-medium">Processing failed</span>
                              </>
                            ) : (
                              <>
                                <span>{(doc.chunkCount ?? doc.chunk_count ?? doc.chunks ?? 0)} chunks</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  {isActive ? 'Ready' : 'Indexed'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {onOpenPdf && ext === 'PDF' && (
                          <button
                            type="button"
                            onClick={() => onOpenPdf(doc.id, 1)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#232732] transition-colors"
                            title="View details / document"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.257-5.064 7-9.542 7-4.477 0-8.268-2.743-9.542-7z" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteDocument(doc)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-[#232732] transition-colors"
                          title="Delete source"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-[#242730] mt-auto">
            <div className="flex justify-between items-center text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 mb-2">
              <span className="font-medium">Storage &amp; Index</span>
              <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                {totalChunks.toLocaleString()} / 50k
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-[#242732] h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(progressPercent, 4)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 text-center">
              {documents.length} document{documents.length !== 1 ? 's' : ''} • {totalChunks.toLocaleString()} chunks indexed
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
