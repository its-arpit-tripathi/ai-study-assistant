import React, { useState, useMemo } from 'react';

/**
 * NotebookLM-Grade High-Fidelity Markdown Renderer
 * Supports:
 * - Structured Markdown Tables (headers, cell alignment, zebra striping, responsive scroll)
 * - Executive Answer & Bottom Line Callout Banners
 * - Numbered Section Headers (1. Foundations of ...)
 * - Evidence Quotation Callouts
 * - Gradient Dividers (---)
 * - Clickable Inline Citation Pills ([Source: doc, p. 1])
 * - Code Blocks with syntax header & copy button
 * - Bullet and Numbered Lists
 * - Headings (H1 to H6)
 * - Freeze-proof streaming token loop safety
 */
export const Markdown = React.memo(function Markdown({ content, onOpenPdf, activeDocument }) {
  if (!content) return null;

  const blocks = useMemo(() => parseBlocksAdvanced(content), [content]);

  return (
    <div className="markdown-content space-y-3.5 text-slate-800 dark:text-[#f1f3f7] leading-relaxed">
      {blocks.map((block, idx) => (
        <BlockRenderer
          key={idx}
          block={block}
          onOpenPdf={onOpenPdf}
          activeDocument={activeDocument}
        />
      ))}
    </div>
  );
});

function isTableRow(line) {
  if (!line) return false;
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
}

function isTableSeparator(line) {
  if (!isTableRow(line)) return false;
  return /^\|(?:\s*:?-+:?\s*\|)+$/.test(line.trim());
}

function splitCollapsedTableRows(line) {
  const trimmed = line.trim();
  if (trimmed.includes('| |') || trimmed.includes('|  |')) {
    return trimmed
      .split(/(?<=\|)\s+(?=\|)/)
      .map((r) => r.trim())
      .filter(Boolean);
  }
  return [line];
}

export function parseBlocksAdvanced(rawText) {
  if (!rawText) return [];

  const rawLines = rawText.split(/\r?\n/);
  const lines = [];
  for (const l of rawLines) {
    if (l.includes('| |') || l.includes('|  |')) {
      lines.push(...splitCollapsedTableRows(l));
    } else {
      lines.push(l);
    }
  }

  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const startIndex = i;
    const line = lines[i];

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Horizontal Rule (---, ___, ***)
    if (/^[-_*]{3,}$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Fenced Code Block
    if (line.trim().startsWith('```')) {
      const langMatch = line.trim().match(/^```(\w*)/);
      const language = langMatch ? langMatch[1] : '';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++;
      }
      blocks.push({
        type: 'code',
        language: language || 'text',
        code: codeLines.join('\n'),
      });
      continue;
    }

    // Markdown Table Block
    if (isTableRow(line)) {
      const tableLines = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      const parsedRows = [];
      for (const tLine of tableLines) {
        if (isTableSeparator(tLine)) continue;
        const cells = tLine
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        if (cells.length > 0) {
          parsedRows.push(cells);
        }
      }
      if (parsedRows.length > 0) {
        blocks.push({
          type: 'table',
          headers: parsedRows[0],
          rows: parsedRows.slice(1),
        });
        continue;
      }
    }

    // Standard Headings (# to ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const type = level <= 3 ? `h${level}` : 'h3';
      blocks.push({ type, text });
      i++;
      continue;
    }

    // Numbered Section Header (e.g., "1. Foundations of AI‑Powered Personalized Learning")
    const numberedSectionMatch = line.match(/^(\d+)\.\s+([A-Z0-9].*)$/);
    if (numberedSectionMatch && line.length < 90 && !line.includes(':')) {
      blocks.push({
        type: 'section_header',
        number: numberedSectionMatch[1],
        title: numberedSectionMatch[2],
      });
      i++;
      continue;
    }

    // Executive Answer or Bottom Line callout
    if (/^(?:Executive\s+Answer|Executive\s+Summary|Bottom\s+Line|Key\s+Takeaway)\b[:\s]*/i.test(line)) {
      const titleMatch = line.match(/^(Executive\s+Answer|Executive\s+Summary|Bottom\s+Line|Key\s+Takeaway)\b[:\s]*(.*)/i);
      const title = titleMatch ? titleMatch[1] : 'Executive Answer';
      const text = titleMatch ? titleMatch[2] : line;
      blocks.push({
        type: 'callout',
        badge: title,
        text,
      });
      i++;
      continue;
    }

    // Direct Evidence Quote (Evidence: "...")
    if (/^Evidence:\s*“/i.test(line) || /^Evidence:\s*"/i.test(line)) {
      blocks.push({
        type: 'evidence_quote',
        text: line.replace(/^Evidence:\s*/i, ''),
      });
      i++;
      continue;
    }

    // Blockquote (> ...)
    if (line.startsWith('> ') || line === '>') {
      const quoteLines = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        quoteLines.push(lines[i].startsWith('> ') ? lines[i].slice(2) : '');
        i++;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
      continue;
    }

    // Unordered List (- or * or +)
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Regular Ordered List (1. 2. 3. numbered steps)
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Paragraph accumulation
    const isBlockBoundary = (l) => {
      if (!l || !l.trim()) return true;
      if (/^[-_*]{3,}$/.test(l.trim())) return true;
      if (l.trim().startsWith('```')) return true;
      if (isTableRow(l)) return true;
      if (/^#{1,6}\s+/.test(l)) return true;
      if (/^(\d+)\.\s+([A-Z0-9].*)$/.test(l) && l.length < 90 && !l.includes(':')) return true;
      if (/^(?:Executive\s+Answer|Executive\s+Summary|Bottom\s+Line|Key\s+Takeaway)\b[:\s]*/i.test(l)) return true;
      if (/^Evidence:\s*[“"]/i.test(l)) return true;
      if (l.startsWith('> ') || l === '>') return true;
      if (/^\s*[-*+]\s+/.test(l)) return true;
      if (/^\s*\d+\.\s+/.test(l)) return true;
      return false;
    };

    const paragraphLines = [];
    while (i < lines.length && !isBlockBoundary(lines[i])) {
      paragraphLines.push(lines[i]);
      i++;
    }

    if (paragraphLines.length > 0) {
      blocks.push({ type: 'p', text: paragraphLines.join(' ') });
    }

    // Loop progression invariant guarantee
    if (i === startIndex) {
      blocks.push({ type: 'p', text: line });
      i++;
    }
  }

  return blocks;
}

function BlockRenderer({ block, onOpenPdf, activeDocument }) {
  if (block.type === 'hr') {
    return <hr className="my-5 border-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-[#2c303d] to-transparent" />;
  }

  if (block.type === 'callout') {
    const isBottomLine = /bottom\s+line/i.test(block.badge);
    return (
      <div
        className={`my-3.5 p-4 rounded-xl border shadow-2xs transition-all ${
          isBottomLine
            ? 'bg-gradient-to-br from-indigo-50/70 to-blue-50/40 dark:from-indigo-950/20 dark:to-blue-950/10 border-indigo-200 dark:border-indigo-900/40'
            : 'bg-gradient-to-br from-blue-50/80 to-slate-50/40 dark:from-blue-950/30 dark:to-slate-900/20 border-blue-200 dark:border-blue-900/50'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold shadow-2xs ${
              isBottomLine
                ? 'bg-indigo-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            <span>{isBottomLine ? '💡' : '✨'}</span>
            <span>{block.badge}</span>
          </span>
        </div>
        <p className="text-[14.5px] sm:text-[15.5px] text-slate-800 dark:text-[#f1f3f7] leading-relaxed font-normal">
          {renderInline(block.text, onOpenPdf, activeDocument)}
        </p>
      </div>
    );
  }

  if (block.type === 'section_header') {
    return (
      <div className="mt-6 mb-3 flex items-center gap-2.5 pb-2 border-b border-slate-200/80 dark:border-[#282b35]/80">
        <span className="w-6 h-6 rounded-lg bg-blue-600 text-white dark:bg-blue-500 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
          {block.number}
        </span>
        <h2 className="text-[16px] sm:text-[17.5px] font-bold text-slate-900 dark:text-white tracking-tight">
          {renderInline(block.title, onOpenPdf, activeDocument)}
        </h2>
      </div>
    );
  }

  if (block.type === 'evidence_quote') {
    return (
      <div className="my-2.5 pl-3.5 pr-3 py-2.5 rounded-r-xl border-l-3 border-amber-500 bg-amber-50/60 dark:bg-amber-950/20 text-slate-700 dark:text-slate-300 text-xs sm:text-[13.5px] shadow-2xs">
        <div className="flex items-center gap-1.5 mb-1 text-amber-700 dark:text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <span>💬</span>
          <span>Cited Excerpt</span>
        </div>
        <p className="italic leading-relaxed">
          {renderInline(block.text, onOpenPdf, activeDocument)}
        </p>
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <TableBlock
        headers={block.headers}
        rows={block.rows}
        onOpenPdf={onOpenPdf}
        activeDocument={activeDocument}
      />
    );
  }

  if (block.type === 'code') {
    return <CodeBlock language={block.language} code={block.code} />;
  }

  if (block.type === 'h1') {
    return <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-4 mb-2">{renderInline(block.text, onOpenPdf, activeDocument)}</h1>;
  }
  if (block.type === 'h2') {
    return <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-3.5 mb-1.5">{renderInline(block.text, onOpenPdf, activeDocument)}</h2>;
  }
  if (block.type === 'h3') {
    return <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mt-3 mb-1">{renderInline(block.text, onOpenPdf, activeDocument)}</h3>;
  }

  if (block.type === 'blockquote') {
    return (
      <blockquote className="border-l-3 border-blue-500 pl-3.5 my-2.5 text-slate-600 dark:text-slate-300 italic">
        {renderInline(block.text, onOpenPdf, activeDocument)}
      </blockquote>
    );
  }

  if (block.type === 'ul') {
    return (
      <ul className="list-disc list-outside pl-5 my-2 space-y-1.5 text-slate-800 dark:text-[#f1f3f7]">
        {block.items.map((item, idx) => (
          <li key={idx} className="leading-relaxed">{renderInline(item, onOpenPdf, activeDocument)}</li>
        ))}
      </ul>
    );
  }

  if (block.type === 'ol') {
    return (
      <ol className="list-decimal list-outside pl-5 my-2 space-y-1.5 text-slate-800 dark:text-[#f1f3f7]">
        {block.items.map((item, idx) => (
          <li key={idx} className="leading-relaxed">{renderInline(item, onOpenPdf, activeDocument)}</li>
        ))}
      </ol>
    );
  }

  if (block.type === 'p') {
    return <p className="leading-relaxed mb-2.5 text-slate-800 dark:text-[#f1f3f7]">{renderInline(block.text, onOpenPdf, activeDocument)}</p>;
  }

  return null;
}

function TableBlock({ headers = [], rows = [], onOpenPdf, activeDocument }) {
  if (!headers || headers.length === 0) return null;

  return (
    <div className="my-4 rounded-xl border border-slate-200 dark:border-[#282b35] overflow-hidden shadow-xs bg-white dark:bg-[#181a21]">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-[13.5px]">
          <thead>
            <tr className="bg-slate-100/80 dark:bg-[#20232c] border-b border-slate-200 dark:border-[#282b35]">
              {headers.map((header, idx) => (
                <th
                  key={idx}
                  className="py-3 px-3.5 sm:px-4 font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] sm:text-xs"
                >
                  {renderInline(header, onOpenPdf, activeDocument)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#242732]">
            {rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors even:bg-slate-50/50 dark:even:bg-[#15171d]/50"
              >
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className="py-3 px-3.5 sm:px-4 text-slate-700 dark:text-[#d1d5e0] leading-relaxed align-top"
                  >
                    {renderInline(cell, onOpenPdf, activeDocument)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-slate-700/60 bg-[#0f1117] text-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#171922] border-b border-slate-800 text-xs font-mono text-slate-400">
        <span>{language || 'code'}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs hover:bg-slate-700/50 text-slate-300 hover:text-white transition-colors cursor-pointer"
          onClick={handleCopy}
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 text-[13.5px] font-mono leading-relaxed overflow-x-auto text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function parseCitationTag(tag) {
  // Matches 【Source: doc.pdf, p. 1, Chunk 2】 or [Source: doc.pdf, p. 2]
  const clean = tag.replace(/^[【\[]\s*Source:\s*/i, '').replace(/[】\]]$/, '').trim();
  const parts = clean.split(',').map((p) => p.trim());
  const sourceName = parts[0] || 'Evidence';
  let page = null;
  for (const part of parts.slice(1)) {
    const pageMatch = part.match(/^p\.?\s*(\d+)/i);
    if (pageMatch) {
      page = Number(pageMatch[1]);
      break;
    }
  }
  return { sourceName, page };
}

function renderInline(text, onOpenPdf, activeDocument) {
  if (!text) return null;

  // Split by inline code `...`
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((part, pIdx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={pIdx} className="px-1.5 py-0.5 rounded text-[13px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-300 dark:bg-blue-950/40 border border-blue-500/20">
          {part.slice(1, -1)}
        </code>
      );
    }

    // Split by citation tags 【Source: ...】 or [Source: ...]
    const citationParts = part.split(/([【\[]Source:[^】\]]+[】\]])/g);
    return citationParts.map((cPart, cIdx) => {
      if (/^[【\[]Source:[^】\]]+[】\]]$/i.test(cPart)) {
        const { sourceName, page } = parseCitationTag(cPart);
        const docId = activeDocument?.id;
        const canOpen = page != null && docId && typeof onOpenPdf === 'function';

        return canOpen ? (
          <button
            key={`${pIdx}-${cIdx}`}
            type="button"
            onClick={() => onOpenPdf(docId, page)}
            className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-md text-[11.5px] sm:text-xs font-mono font-medium bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800/60 shadow-2xs cursor-pointer align-baseline transition-all"
            title={`View ${sourceName} at page ${page}`}
          >
            <span>📌</span>
            <span className="font-semibold truncate max-w-[150px]">{sourceName}</span>
            {page != null && <span>· p. {page}</span>}
          </button>
        ) : (
          <span
            key={`${pIdx}-${cIdx}`}
            className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-md text-[11.5px] sm:text-xs font-mono font-medium bg-slate-100 dark:bg-[#20232c] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#282b35] shadow-2xs align-baseline"
          >
            <span>📌</span>
            <span className="font-semibold truncate max-w-[150px]">{sourceName}</span>
            {page != null && <span>· p. {page}</span>}
          </span>
        );
      }

      // Bold formatting **...**
      const boldParts = cPart.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, bIdx) => {
        if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length >= 4) {
          return (
            <strong key={`${pIdx}-${cIdx}-${bIdx}`} className="font-semibold text-slate-900 dark:text-white">
              {bPart.slice(2, -2)}
            </strong>
          );
        }

        // Italic formatting *...*
        const italicParts = bPart.split(/(\*[^*]+\*)/g);
        return italicParts.map((iPart, iIdx) => {
          if (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length >= 2) {
            return <em key={`${pIdx}-${cIdx}-${bIdx}-${iIdx}`}>{iPart.slice(1, -1)}</em>;
          }
          return iPart;
        });
      });
    });
  });
}
