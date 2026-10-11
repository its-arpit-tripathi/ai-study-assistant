import React, { useState } from 'react';

export function ClaimVerification({ verification, sources = [], activeDocument, onOpenPdf }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!verification || typeof verification !== 'object') {
    return null;
  }

  const statusInfo = getVerificationStatus(verification.status);
  const counts = verification.counts || {};
  const claims = Array.isArray(verification.claims) ? verification.claims : [];

  // Map footer sources by chunkId
  const sourceByChunkId = new Map();
  if (Array.isArray(sources)) {
    sources.forEach((s) => {
      if (s && typeof s === 'object' && s.chunkId) {
        sourceByChunkId.set(s.chunkId, s);
      }
    });
  }

  const countSummary = [
    `${Number(counts.supported) || 0} supported`,
    `${Number(counts.uncertain) || 0} uncertain`,
    `${Number(counts.unsupported) || 0} unsupported`,
  ].join(' · ');

  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#282b35] bg-white dark:bg-[#1a1c22] overflow-hidden shadow-2xs transition-colors">
      {/* Header Accordion Toggle */}
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#20222a] transition-colors cursor-pointer text-left"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[11px] font-bold ${statusInfo.badgeBg}`}>
            {statusInfo.icon}
          </span>
          <span className="text-xs sm:text-[13.5px] font-semibold text-slate-800 dark:text-slate-200">
            Claim Verification
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusInfo.badgeBg}`}>
            {statusInfo.label}
          </span>
        </div>

        <div className="text-slate-400">
          <svg
            className={`w-4 h-4 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Accordion Body */}
      {isOpen && (
        <div className="px-4 pb-4 pt-1.5 border-t border-slate-100 dark:border-[#242730] space-y-3 text-xs sm:text-[13px]">
          {verification.summary && (
            <p className="text-slate-600 dark:text-[#9ea3b2] leading-relaxed pt-1">
              {verification.summary}
            </p>
          )}

          {verification.counts && (
            <div className="inline-block px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#20232c] text-slate-600 dark:text-slate-400 font-mono text-xs">
              {countSummary}
            </div>
          )}

          {claims.length > 0 ? (
            <div className="space-y-2.5">
              {claims.map((claim, idx) => (
                <ClaimItem
                  key={idx}
                  claim={claim}
                  sourceByChunkId={sourceByChunkId}
                  activeDocument={activeDocument}
                  onOpenPdf={onOpenPdf}
                />
              ))}
            </div>
          ) : (
            <p className="text-slate-400 dark:text-slate-500">No individual claims returned for verification.</p>
          )}

          <p className="text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-[#242730]">
            AI-assisted evidence assessment. A supported status is not an absolute guarantee of factual correctness.
          </p>
        </div>
      )}
    </div>
  );
}

function ClaimItem({ claim, sourceByChunkId, activeDocument, onOpenPdf }) {
  const claimStatus = getVerificationStatus(claim.status);
  const evidenceIds = Array.isArray(claim.supportingChunkIds) ? claim.supportingChunkIds : [];
  const supportingEvidence = Array.isArray(claim.supportingEvidence) ? claim.supportingEvidence : [];

  const evidenceMap = new Map();
  supportingEvidence.forEach((item) => {
    if (item && item.chunkId) {
      evidenceMap.set(item.chunkId, item);
    }
  });

  return (
    <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#15171d] border border-slate-200 dark:border-[#252834]">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${claimStatus.badgeBg}`}>
          {claimStatus.icon} {claimStatus.label}
        </span>
      </div>

      <p className="text-xs sm:text-[13.5px] text-slate-800 dark:text-slate-200 font-medium mb-1.5 leading-snug">
        {claim.claim || 'Claim unavailable'}
      </p>

      {claim.reason && (
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mb-2">
          {claim.reason}
        </p>
      )}

      {/* Evidence items */}
      {evidenceIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Evidence:</span>
          {evidenceIds.map((id) => {
            const evidence = evidenceMap.get(id);
            const footerSource = sourceByChunkId.get(id);

            const sourceName = evidence?.source || footerSource?.source || activeDocument?.name || 'Document';
            const page = evidence?.page ?? footerSource?.page ?? null;
            const docId = activeDocument?.id || footerSource?.documentId || '';

            const canOpenPdf = page != null && docId;

            return canOpenPdf ? (
              <button
                key={id}
                type="button"
                onClick={() => onOpenPdf(docId, page)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-slate-200/70 dark:bg-[#20232c] hover:bg-blue-100 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-mono cursor-pointer shadow-2xs"
                title={`Open ${sourceName} at page ${page}`}
              >
                <span>📕</span>
                <span className="truncate max-w-[140px]">{sourceName}</span>
                <span>· p. {page}</span>
              </button>
            ) : (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-slate-200/70 dark:bg-[#20232c] text-slate-700 dark:text-slate-300 font-mono"
              >
                <span>📄 {sourceName}{page != null ? ` · p. ${page}` : ''}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getVerificationStatus(status) {
  switch (String(status || '').toLowerCase()) {
    case 'verified':
      return {
        label: 'Verified Grounding',
        icon: '✓',
        badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
      };
    case 'supported':
      return {
        label: 'Supported',
        icon: '✓',
        badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
      };
    case 'unsupported':
      return {
        label: 'Not supported',
        icon: '✕',
        badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
      };
    case 'issues_found':
      return {
        label: 'Issues Found',
        icon: '⚠',
        badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
      };
    case 'uncertain':
    case 'partially_verified':
      return {
        label: 'Partially Verified',
        icon: '⚠',
        badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
      };
    default:
      return {
        label: 'Not verified',
        icon: '?',
        badgeBg: 'bg-slate-500/10 text-slate-500 border border-slate-500/20',
      };
  }
}
