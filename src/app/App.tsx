import React, { useEffect, useReducer, useState } from "react";
import { Header } from "./components/Header";
import { JsonEditor } from "./components/JsonEditor";
import { JsonGridView } from "./components/JsonGridView";

function decodeJsonFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("json");
    if (!encoded) return null;
    const decoded = atob(encoded);
    JSON.parse(decoded);
    return decoded;
  } catch {
    return null;
  }
}

const INITIAL_JSON = `{
  "version": "1.0",
  "team": "Atlas",
  "createdAt": "2026-04-01T04:58:09.989Z",
  "active": true,
  "members": [
    {
      "id": 1,
      "name": "Alice",
      "role": "Engineer"
    },
    {
      "id": 2,
      "name": "Bob",
      "role": "Designer"
    }
  ],
  "settings": {
    "theme": "dark",
    "languages": [
      "fr",
      "en"
    ]
  }
}`;

const STORAGE_KEYS = {
  jsonCode: "jsonhelper.jsonCode",
  viewMode: "jsonhelper.viewMode",
} as const;

interface HistoryState {
  entries: string[];
  index: number;
}

type HistoryAction =
  | { type: "SET"; payload: string }
  | { type: "UNDO" }
  | { type: "REDO" };

function historyReducer(
  state: HistoryState,
  action: HistoryAction,
): HistoryState {
  switch (action.type) {
    case "SET": {
      const nextValue = action.payload;
      const currentValue = state.entries[state.index];
      if (nextValue === currentValue) return state;

      const nextEntries = [...state.entries.slice(0, state.index + 1), nextValue];
      return {
        entries: nextEntries,
        index: nextEntries.length - 1,
      };
    }
    case "UNDO":
      return state.index > 0 ? { ...state, index: state.index - 1 } : state;
    case "REDO":
      return state.index < state.entries.length - 1
        ? { ...state, index: state.index + 1 }
        : state;
    default:
      return state;
  }
}

export default function App() {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [viewMode, setViewMode] = useState<"split" | "input" | "visualizer">(
    () => {
      const savedViewMode = localStorage.getItem(STORAGE_KEYS.viewMode);
      if (
        savedViewMode === "split" ||
        savedViewMode === "input" ||
        savedViewMode === "visualizer"
      ) {
        return savedViewMode;
      }
      return "split";
    },
  );
  const [history, dispatchHistory] = useReducer(
    historyReducer,
    null,
    (): HistoryState => {
      const fromUrl = decodeJsonFromUrl();
      const initialJson =
        fromUrl ?? localStorage.getItem(STORAGE_KEYS.jsonCode) ?? INITIAL_JSON;
      return {
        entries: [initialJson],
        index: 0,
      };
    },
  );
  const jsonCode = history.entries[history.index];
  const setJsonCode = (code: string) => {
    dispatchHistory({ type: "SET", payload: code });
  };
  const canUndo = history.index > 0;
  const canRedo = history.index < history.entries.length - 1;

  const undoJson = () => {
    dispatchHistory({ type: "UNDO" });
  };

  const redoJson = () => {
    dispatchHistory({ type: "REDO" });
  };

  const handleShare = async () => {
    try {
      const encoded = btoa(jsonCode);
      const url = `${window.location.origin}${window.location.pathname}?json=${encoded}`;
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard not available — silently fail
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.viewMode, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.jsonCode, jsonCode);
  }, [jsonCode]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#0a0a0a] text-neutral-200 font-sans overflow-hidden">
      <Header
        viewMode={viewMode}
        setViewMode={setViewMode}
        controlsVisible={controlsVisible}
        setControlsVisible={setControlsVisible}
        onShare={handleShare}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Editor */}
        {(viewMode === "split" || viewMode === "input") && (
          <div
            className={`${viewMode === "input" ? "w-full" : "w-[450px] min-w-[350px] max-w-[600px]"} flex-shrink-0 transition-all duration-300`}
          >
            <JsonEditor
              jsonCode={jsonCode}
              setJsonCode={setJsonCode}
              controlsVisible={controlsVisible}
            />
          </div>
        )}

        {/* Right Panel: Visualizer */}
        {(viewMode === "split" ||
          viewMode === "visualizer") && (
          <div className="flex-1 min-w-0 transition-all duration-300">
            <JsonGridView
              jsonCode={jsonCode}
              setJsonCode={setJsonCode}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undoJson}
              onRedo={redoJson}
              controlsVisible={controlsVisible}
            />
          </div>
        )}
      </div>
    </div>
  );
}