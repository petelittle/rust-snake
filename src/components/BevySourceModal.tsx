import { useState } from 'react';
import { BEVY_SOURCE_FILES } from '../data/bevySourceFiles';

interface BevySourceModalProps {
  open: boolean;
  onClose: () => void;
}

export function BevySourceModal({ open, onClose }: BevySourceModalProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const activeFile = BEVY_SOURCE_FILES[activeIndex] ?? BEVY_SOURCE_FILES[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: 'rgba(7, 10, 15, 0.86)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bevy-source-title"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700/80 shadow-2xl"
        style={{ backgroundColor: '#0f141d' }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2
              id="bevy-source-title"
              className="font-display text-lg font-bold text-slate-50"
            >
              Rust + Bevy 0.15 Project Source
            </h2>
            <p className="text-xs text-slate-400">
              Located in the workspace under rust-bevy-snake/ · Run locally with cargo run --release
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[36px] rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 whitespace-nowrap shrink-0 hover:bg-slate-700 cursor-pointer"
            >
              {copied ? 'Copied' : 'Copy File'}
            </button>
            <button
              type="button"
              aria-label="Close source viewer"
              onClick={onClose}
              className="min-h-[36px] rounded-md bg-orange-600 px-3.5 py-1.5 text-xs font-semibold text-white whitespace-nowrap shrink-0 hover:bg-orange-500 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-800 bg-[#0a0e14] px-4 py-2">
          {BEVY_SOURCE_FILES.map((file, idx) => {
            const label = file.path.replace('rust-bevy-snake/', '');
            const active = idx === activeIndex;
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => {
                  setActiveIndex(idx);
                  setCopied(false);
                }}
                className={`rounded-md px-3 py-1.5 font-mono-tabular text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto p-5 bg-[#090c11]">
          <pre className="font-mono-tabular text-xs leading-relaxed text-slate-200 whitespace-pre">
            <code>{activeFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
