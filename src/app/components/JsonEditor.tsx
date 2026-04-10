import React, { useEffect, useRef, useState } from 'react';
import { Copy, Plus } from 'lucide-react';

interface JsonEditorProps {
  jsonCode: string;
  setJsonCode: (code: string) => void;
  controlsVisible: boolean;
}

function buildObjectJson() {
  return JSON.stringify({}, null, 2);
}

function buildArrayJson() {
  return JSON.stringify([], null, 2);
}

function buildBasicJson() {
  return JSON.stringify(
    {
      version: "1.0",
      name: "Starter JSON",
      active: true,
      items: [],
    },
    null,
    2,
  );
}

export function JsonEditor({
  jsonCode,
  setJsonCode,
  controlsVisible,
}: JsonEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const [copyLabel, setCopyLabel] = useState<'Copy' | 'Copied'>('Copy');
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonCode);
      setCopyLabel('Copied');
      window.setTimeout(() => setCopyLabel('Copy'), 1500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = jsonCode;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopyLabel('Copied');
        window.setTimeout(() => setCopyLabel('Copy'), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  const handleNewPreset = (preset: 'basic' | 'array' | 'object') => {
    if (preset === 'basic') {
      setJsonCode(buildBasicJson());
    } else if (preset === 'array') {
      setJsonCode(buildArrayJson());
    } else {
      setJsonCode(buildObjectJson());
    }
    setIsNewMenuOpen(false);
  };

  const btnOutline =
    'flex items-center gap-1.5 rounded-full border border-[#ffd60a]/45 px-2.5 py-1 text-xs font-medium text-[#ffd60a] transition-colors hover:bg-[#ffd60a]/10';
  const btnYellow =
    'flex items-center gap-1.5 rounded-full bg-[#ffd60a] px-3 py-1 text-xs font-semibold text-black shadow-[0_0_10px_rgba(255,214,10,0.25)] transition-shadow hover:shadow-[0_0_16px_rgba(255,214,10,0.4)]';
  const iconSm = 'h-3.5 w-3.5 shrink-0';

  useEffect(() => {
    if (!isNewMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!newMenuRef.current) return;
      if (!newMenuRef.current.contains(event.target as Node)) {
        setIsNewMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [isNewMenuOpen]);

  const lines = jsonCode.split('\n');

  let isValidJson = false;
  let jsonParseError: string | null = null;
  try {
    JSON.parse(jsonCode);
    isValidJson = true;
  } catch (e) {
    isValidJson = false;
    jsonParseError = e instanceof Error ? e.message : String(e);
  }

  // Sync scroll between textarea and pre
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Naive JSON syntax highlighter
  const highlightCode = (text: string) => {
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'text-[#4ade80]'; // Default boolean/number (green)
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-[#60a5fa]'; // Key (blue)
          } else {
            cls = 'text-[#f68f3a]'; // String (orange/yellow)
          }
        }
        return `<span class="${cls}">${match}</span>`;
      });
    return formatted;
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d10] border-r border-neutral-800 text-sm">
      <div className="flex justify-between items-center gap-4 p-6 border-b border-neutral-800">
        <div
          className={`shrink-0 text-[11px] px-4 py-1.5 rounded-full uppercase tracking-widest font-bold border shadow-inner ${
            isValidJson
              ? "bg-neutral-800/60 text-neutral-400 border-neutral-700"
              : "bg-red-950/40 text-red-500 border-red-500/50"
          }`}
        >
          {isValidJson ? (
            <>
              Valid
              <br />
              JSON
            </>
          ) : (
            <>
              Invalid
              <br />
              JSON
            </>
          )}
        </div>
        {controlsVisible && (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className={btnOutline}
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            <Copy className={iconSm} />
            {copyLabel}
          </button>
          <div className="relative" ref={newMenuRef}>
            <button
              type="button"
              className={btnYellow}
              onClick={() => setIsNewMenuOpen((prev) => !prev)}
              title="Create blank JSON"
            >
              <Plus className={iconSm} />
              New
            </button>
            {isNewMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-40 rounded-lg border border-neutral-700 bg-[#111319] p-1.5 shadow-2xl">
                <button
                  type="button"
                  className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-neutral-200 hover:bg-[#ffd60a]/15"
                  onClick={() => handleNewPreset('basic')}
                >
                  Basic
                </button>
                <button
                  type="button"
                  className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-neutral-200 hover:bg-[#ffd60a]/15"
                  onClick={() => handleNewPreset('array')}
                >
                  Blank Array
                </button>
                <button
                  type="button"
                  className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-neutral-200 hover:bg-[#ffd60a]/15"
                  onClick={() => handleNewPreset('object')}
                >
                  Blank Object
                </button>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {!isValidJson && jsonParseError && (
        <div className="border-b border-neutral-800 px-6 py-2">
          <div
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-950/35 px-3 py-2 font-mono text-[11px] font-medium leading-snug text-red-400 break-words"
          >
            {jsonParseError}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden relative flex py-4 bg-[#0a0a0a]">
        <div className="flex flex-col text-[#4b5563] select-none pl-4 pr-5 text-right font-mono text-[13px] leading-[22px] min-w-[3.5rem] pt-[2px]">
          {lines.map((_, i) => (
            <div key={i + 1}>{i + 1}</div>
          ))}
        </div>

        <div className="relative flex-1 overflow-hidden font-mono text-[13px] leading-[22px]">
          <pre
            ref={preRef}
            className="absolute inset-0 p-0 m-0 w-full h-full pointer-events-none whitespace-pre overflow-hidden bg-transparent pt-[2px]"
            dangerouslySetInnerHTML={{ __html: highlightCode(jsonCode) }}
            aria-hidden="true"
          />
          <textarea
            ref={textareaRef}
            className="absolute inset-0 w-full h-full resize-none outline-none border-none p-0 m-0 bg-transparent text-transparent caret-white whitespace-pre overflow-auto pt-[2px]"
            value={jsonCode}
            onChange={(e) => setJsonCode(e.target.value)}
            onScroll={handleScroll}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
