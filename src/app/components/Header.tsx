import React from "react";
import {
  Columns2,
  FileText,
  Workflow,
  Eye,
  EyeOff,
} from "lucide-react";

interface HeaderProps {
  viewMode: 'split' | 'input' | 'visualizer';
  setViewMode: (mode: 'split' | 'input' | 'visualizer') => void;
  controlsVisible: boolean;
  setControlsVisible: (value: boolean) => void;
}

export function Header({
  viewMode,
  setViewMode,
  controlsVisible,
  setControlsVisible,
}: HeaderProps) {
  return (
    <header className="relative flex items-center px-6 border-b border-neutral-800 bg-[#0a0a0a] min-h-[80px]">
      <div className="flex items-center gap-6">
        <a
          href="https://github.com/Krokmouuu/JsonHelper"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-neutral-200 font-semibold text-xl tracking-tight hover:text-[#ffd60a] transition-colors"
          title="Open GitHub repository"
        >
          <img
            src="/images/json-helper.png"
            alt="JSON Helper logo"
            className="w-24 h-24 object-contain"
          />
          JSON Helper
        </a>
      </div>

      {controlsVisible && (
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 p-1 bg-transparent">
        <button 
          onClick={() => setViewMode('split')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
            viewMode === 'split' 
              ? 'bg-[#ffd60a] text-black shadow-[0_0_15px_rgba(255,214,10,0.3)]' 
              : 'border border-[#ffd60a] text-[#ffd60a] hover:bg-[#ffd60a]/10'
          }`}
        >
          <Columns2 className="w-4 h-4 shrink-0" />
          Split View
        </button>
        <button 
          onClick={() => setViewMode('input')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
            viewMode === 'input' 
              ? 'bg-[#ffd60a] text-black shadow-[0_0_15px_rgba(255,214,10,0.3)]' 
              : 'border border-[#ffd60a] text-[#ffd60a] hover:bg-[#ffd60a]/10'
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          Input Only
        </button>
        <button 
          onClick={() => setViewMode('visualizer')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
            viewMode === 'visualizer' 
              ? 'bg-[#ffd60a] text-black shadow-[0_0_15px_rgba(255,214,10,0.3)]' 
              : 'border border-[#ffd60a] text-[#ffd60a] hover:bg-[#ffd60a]/10'
          }`}
        >
          <Workflow className="w-4 h-4 shrink-0" />
          Visualizer Only
        </button>
      </div>
      )}

      <button
        className="absolute right-6 rounded-full border border-[#ffd60a] p-2 text-[#ffd60a] hover:bg-[#ffd60a]/10 transition-colors"
        onClick={() => setControlsVisible(!controlsVisible)}
        title={controlsVisible ? "Hide controls" : "Show controls"}
        aria-label={controlsVisible ? "Hide controls" : "Show controls"}
      >
        {controlsVisible ? (
          <Eye className="w-5 h-5" />
        ) : (
          <EyeOff className="w-5 h-5" />
        )}
      </button>

    </header>
  );
}
