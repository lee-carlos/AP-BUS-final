import React from 'react';
import { X, ExternalLink, FileText } from 'lucide-react';

interface ScheduleDocModalProps {
  onClose: () => void;
}

export const ScheduleDocModal: React.FC<ScheduleDocModalProps> = ({ onClose }) => {
  const pdfUrl = '/assets/aistudio/2026Oct22_APU-SHUTTLE-SERVICES_6fa3fc92.pdf';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-xl flex flex-col h-[85vh] overflow-hidden transition-colors">
        {/* Header */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-white text-xs">Official APU Shuttle Schedule</h3>
              <p className="text-[10px] text-zinc-500">Effective 22 October 2026 · Campus Connect</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open
            </a>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Embedded PDF iframe */}
        <div className="flex-1 bg-zinc-100 dark:bg-zinc-950 relative">
          <iframe
            src={pdfUrl}
            title="APU Shuttle Services Schedule PDF"
            className="w-full h-full border-0"
          />
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 text-center text-[10px] text-zinc-500 font-mono">
          Source: Asia Pacific University of Technology & Innovation (APU) Shuttle Services
        </div>
      </div>
    </div>
  );
};
