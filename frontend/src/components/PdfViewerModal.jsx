import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

export function PdfViewerModal({ isOpen, onClose, documentId, documentName, page, showToast }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let currentUrl = null;
    let active = true;

    if (isOpen && documentId) {
      queueMicrotask(() => {
        if (active) {
          setLoading(true);
          setError(null);
        }
      });

      api.getPdfBlob(documentId)
        .then((blob) => {
          if (!active) return;
          currentUrl = URL.createObjectURL(blob);
          setBlobUrl(currentUrl);
        })
        .catch((err) => {
          if (!active) return;
          setError(err.message || 'Failed to open PDF.');
          showToast?.(err.message || 'Failed to open PDF document.', 'error');
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }

    return () => {
      active = false;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      setBlobUrl(null);
    };
  }, [isOpen, documentId, showToast]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const targetPage = Number.isInteger(page) && page > 0 ? page : 1;
  const pdfSource = blobUrl ? `${blobUrl}#page=${targetPage}&view=FitH` : 'about:blank';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a1c22] border border-slate-200 dark:border-[#2c2f38] rounded-xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar Header */}
        <div className="h-13 px-4 border-b border-slate-200 dark:border-[#242730] flex items-center justify-between shrink-0 bg-slate-50 dark:bg-[#16181d]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-6 h-6 rounded bg-rose-500/10 text-rose-500 flex items-center justify-center font-mono text-[10px] font-semibold border border-rose-500/20">
              PDF
            </span>
            <span className="font-mono text-xs font-medium text-slate-800 dark:text-slate-200 truncate max-w-md">
              {documentName || 'Document Viewer'}
            </span>
            <span className="text-[11px] bg-slate-200 dark:bg-[#262934] text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-mono font-medium">
              Page {targetPage}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#252834] transition-colors cursor-pointer"
          >
            <span>Close</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 w-full h-full bg-slate-100 dark:bg-[#121316] relative overflow-hidden flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
              <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <p>Loading document evidence...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-6 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-center max-w-md">
              <p className="text-sm mb-3">⚠️ {error}</p>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded bg-rose-600 text-white text-xs font-medium hover:bg-rose-500 cursor-pointer"
              >
                Close
              </button>
            </div>
          )}

          {blobUrl && !loading && !error && (
            <iframe
              className="w-full h-full border-none"
              title="PDF Evidence Document"
              src={pdfSource}
            />
          )}
        </div>
      </div>
    </div>
  );
}
