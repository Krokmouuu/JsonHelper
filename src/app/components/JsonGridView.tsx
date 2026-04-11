import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize,
  Trash2,
  Plus,
  X,
  ArrowUpDown,
  ArrowLeftRight,
} from "lucide-react";

interface JsonGridViewProps {
  jsonCode: string;
  setJsonCode: (code: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  controlsVisible: boolean;
}

type PathSegment = string | number;
type TreeLayoutDirection = "vertical" | "horizontal";

type AddPropertyType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "date"
  | "datetime"
  | "color"
  | "object"
  | "array";

function toJsonString(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function setAtPath(
  source: unknown,
  path: PathSegment[],
  value: unknown,
): unknown {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(source)) {
    const next = [...source];
    const idx = Number(head);
    next[idx] = setAtPath(next[idx], rest, value);
    return next;
  }
  if (source && typeof source === "object") {
    const next: Record<string, unknown> = {
      ...(source as Record<string, unknown>),
    };
    next[String(head)] = setAtPath(next[String(head)], rest, value);
    return next;
  }
  return source;
}

function removeAtPath(source: unknown, path: PathSegment[]): unknown {
  if (path.length === 0) return source;
  const [head, ...rest] = path;

  if (rest.length === 0) {
    if (Array.isArray(source)) {
      const next = [...source];
      next.splice(Number(head), 1);
      return next;
    }
    if (source && typeof source === "object") {
      const next: Record<string, unknown> = {
        ...(source as Record<string, unknown>),
      };
      delete next[String(head)];
      return next;
    }
    return source;
  }

  if (Array.isArray(source)) {
    const next = [...source];
    const idx = Number(head);
    next[idx] = removeAtPath(next[idx], rest);
    return next;
  }
  if (source && typeof source === "object") {
    const next: Record<string, unknown> = {
      ...(source as Record<string, unknown>),
    };
    next[String(head)] = removeAtPath(next[String(head)], rest);
    return next;
  }
  return source;
}

function addAtPath(
  source: unknown,
  path: PathSegment[],
  key: string,
  value: unknown,
): unknown {
  const target = path.reduce<unknown>((acc, segment) => {
    if (Array.isArray(acc)) return acc[Number(segment)];
    if (acc && typeof acc === "object")
      return (acc as Record<string, unknown>)[String(segment)];
    return undefined;
  }, source);

  if (Array.isArray(target)) {
    const updatedTarget = [...target, value];
    return setAtPath(source, path, updatedTarget);
  }

  if (target && typeof target === "object") {
    const updatedTarget: Record<string, unknown> = {
      ...(target as Record<string, unknown>),
      [key]: value,
    };
    return setAtPath(source, path, updatedTarget);
  }

  return source;
}

function parseInputValue(raw: string): unknown {
  const text = raw.trim();
  if (text === "") return "";
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null") return null;
  const asNumber = Number(text);
  if (!Number.isNaN(asNumber) && text !== "") return asNumber;
  return raw;
}

function isHexColor(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value.trim());
}

function matchesSearchTerm(value: unknown, searchTerm: string): boolean {
  if (!searchTerm) return false;
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) return false;
  return String(value ?? "").toLowerCase().includes(needle);
}

function nodeIdFromPath(path: PathSegment[]) {
  if (path.length === 0) return "root";
  return `node-${path.map((segment) => String(segment)).join("-")}`;
}

function findFirstMatchingNodePath(
  data: unknown,
  searchTerm: string,
  path: PathSegment[] = [],
): PathSegment[] | null {
  const currentName = path.length > 0 ? path[path.length - 1] : "root";
  if (
    matchesSearchTerm(currentName, searchTerm) ||
    (data !== null && typeof data !== "object" && matchesSearchTerm(data, searchTerm))
  ) {
    return path;
  }

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i += 1) {
      const childPath = [...path, i];
      const match = findFirstMatchingNodePath(data[i], searchTerm, childPath);
      if (match) return match;
    }
    return null;
  }

  if (data && typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    const hasScalarMatch = entries.some(
      ([k, v]) =>
        matchesSearchTerm(k, searchTerm) ||
        (v === null || typeof v !== "object") && matchesSearchTerm(v, searchTerm),
    );
    if (hasScalarMatch) return path;

    for (const [k, v] of entries) {
      if (v && typeof v === "object") {
        const childPath = [...path, k];
        const match = findFirstMatchingNodePath(v, searchTerm, childPath);
        if (match) return match;
      }
    }
  }

  return null;
}

function defaultValueForType(type: AddPropertyType): unknown {
  switch (type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "null":
      return null;
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "datetime":
      return new Date().toISOString();
    case "color":
      return "#ffd60a";
    case "object":
      return {};
    case "array":
      return [];
    case "string":
    default:
      return "";
  }
}

export function JsonGridView({
  jsonCode,
  setJsonCode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  controlsVisible,
}: JsonGridViewProps) {
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const searchFocusTimeoutRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [treeLayout, setTreeLayout] =
    useState<TreeLayoutDirection>("vertical");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [addPropertyPath, setAddPropertyPath] = useState<PathSegment[] | null>(
    null,
  );
  const [propertyKey, setPropertyKey] = useState("");
  const [propertyType, setPropertyType] = useState<AddPropertyType>("string");
  const [addArrayItemPath, setAddArrayItemPath] = useState<
    PathSegment[] | null
  >(null);
  const [arrayItemType, setArrayItemType] = useState<AddPropertyType>("string");

  let parsedData: any = null;
  let errorMsg = "";
  try {
    parsedData = JSON.parse(jsonCode);
  } catch (e: any) {
    errorMsg = "Invalid JSON";
  }

  const updateByPath = (path: PathSegment[], value: unknown) => {
    const updated = setAtPath(parsedData, path, value);
    setJsonCode(toJsonString(updated));
  };

  const deleteByPath = (path: PathSegment[]) => {
    const updated = removeAtPath(parsedData, path);
    setJsonCode(toJsonString(updated));
  };

  const addOnPath = (path: PathSegment[], isArray: boolean) => {
    if (isArray) {
      setArrayItemType("string");
      setAddArrayItemPath(path);
      return;
    }
    setPropertyKey("");
    setPropertyType("string");
    setAddPropertyPath(path);
  };

  const closeAddPropertyModal = () => {
    setAddPropertyPath(null);
    setPropertyKey("");
    setPropertyType("string");
  };

  const closeAddArrayItemModal = () => {
    setAddArrayItemPath(null);
    setArrayItemType("string");
  };

  const submitAddProperty = () => {
    if (!addPropertyPath || !propertyKey.trim()) return;
    const updated = addAtPath(
      parsedData,
      addPropertyPath,
      propertyKey.trim(),
      defaultValueForType(propertyType),
    );
    setJsonCode(toJsonString(updated));
    closeAddPropertyModal();
  };

  const submitAddArrayItem = () => {
    if (!addArrayItemPath) return;
    const updated = addAtPath(
      parsedData,
      addArrayItemPath,
      "",
      defaultValueForType(arrayItemType),
    );
    setJsonCode(toJsonString(updated));
    closeAddArrayItemModal();
  };

  const zoomIn = () => {
    setZoom((prev) => Math.min(2, +(prev + 0.1).toFixed(2)));
  };

  const zoomOut = () => {
    setZoom((prev) => Math.max(0.5, +(prev - 0.1).toFixed(2)));
  };

  const resetZoom = () => {
    setZoom(1);
    hasCenteredRef.current = false;
  };

  const handleWheelZoom = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const isPinchGesture = event.ctrlKey;
    const isKeyboardZoom = event.metaKey || event.altKey;
    if (!isPinchGesture && !isKeyboardZoom) return;
    event.preventDefault();

    const container = canvasRef.current;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    setZoom((prev) => {
      const intensity = isPinchGesture ? 0.03 : 0.08;
      const next = Math.max(
        0.5,
        Math.min(
          2,
          +(prev + (event.deltaY < 0 ? intensity : -intensity)).toFixed(2),
        ),
      );
      if (next === prev) return prev;

      const worldX = (container.scrollLeft + mouseX) / prev;
      const worldY = (container.scrollTop + mouseY) / prev;
      container.scrollLeft = worldX * next - mouseX;
      container.scrollTop = worldY * next - mouseY;
      return next;
    });
  };

  const startPan = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !canvasRef.current) return;

    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a, label"))
      return;

    dragStateRef.current = {
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: canvasRef.current.scrollLeft,
      startScrollTop: canvasRef.current.scrollTop,
    };
    setIsPanning(true);
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStateRef.current.isDragging || !canvasRef.current) return;

      const deltaX = event.clientX - dragStateRef.current.startX;
      const deltaY = event.clientY - dragStateRef.current.startY;
      canvasRef.current.scrollLeft = dragStateRef.current.startScrollLeft - deltaX;
      canvasRef.current.scrollTop = dragStateRef.current.startScrollTop - deltaY;
    };

    const handleMouseUp = () => {
      if (!dragStateRef.current.isDragging) return;
      dragStateRef.current.isDragging = false;
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (searchFocusTimeoutRef.current !== null) {
        window.clearTimeout(searchFocusTimeoutRef.current);
      }
    };
  }, []);

  const hasCenteredRef = useRef(false);
  useEffect(() => {
    hasCenteredRef.current = false;
  }, []);

  useEffect(() => {
    if (hasCenteredRef.current) return;
    if (!parsedData) return;
    hasCenteredRef.current = true;

    const frame = requestAnimationFrame(() => {
      const container = canvasRef.current;
      if (!container) return;
      const rootNode = container.querySelector<HTMLElement>('[data-node-id]');
      if (!rootNode) return;

      const containerRect = container.getBoundingClientRect();
      const nodeRect = rootNode.getBoundingClientRect();
      const nodeCenterX = nodeRect.left + nodeRect.width / 2;
      const nodeCenterY = nodeRect.top + nodeRect.height / 2;
      const containerCenterX = containerRect.left + containerRect.width / 2;
      const containerCenterY = containerRect.top + containerRect.height / 2;

      container.scrollLeft += nodeCenterX - containerCenterX;
      container.scrollTop += nodeCenterY - containerCenterY;
    });
    return () => cancelAnimationFrame(frame);
  }, [parsedData]);

  const focusNodeById = (nodeId: string) => {
    if (!canvasRef.current) return;
    const container = canvasRef.current;
    const targetNode = container.querySelector<HTMLElement>(
      `[data-node-id="${nodeId}"]`,
    );
    if (!targetNode) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = targetNode.getBoundingClientRect();
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const containerCenterX = containerRect.left + containerRect.width / 2;
    const containerCenterY = containerRect.top + containerRect.height / 2;

    container.scrollTo({
      left: container.scrollLeft + (targetCenterX - containerCenterX),
      top: container.scrollTop + (targetCenterY - containerCenterY),
      behavior: "smooth",
    });
  };

  const applySearch = (rawTerm: string) => {
    const term = rawTerm.trim();
    setActiveSearch(term);
    if (!term || !parsedData) return;

    const firstMatchPath = findFirstMatchingNodePath(parsedData, term);
    if (!firstMatchPath) return;

    const targetId = nodeIdFromPath(firstMatchPath);
    const nextZoom = Math.max(zoom, 1.2);
    const zoomWillChange = nextZoom !== zoom;
    if (zoomWillChange) setZoom(nextZoom);

    if (searchFocusTimeoutRef.current !== null) {
      window.clearTimeout(searchFocusTimeoutRef.current);
    }
    searchFocusTimeoutRef.current = window.setTimeout(
      () => focusNodeById(targetId),
      zoomWillChange ? 220 : 0,
    );
  };

  const focusNodeForEditing = (path: PathSegment[]) => {
    const targetId = nodeIdFromPath(path);
    const nextZoom = Math.max(zoom, 1.15);
    const zoomWillChange = nextZoom !== zoom;
    if (zoomWillChange) setZoom(nextZoom);

    if (searchFocusTimeoutRef.current !== null) {
      window.clearTimeout(searchFocusTimeoutRef.current);
    }
    searchFocusTimeoutRef.current = window.setTimeout(
      () => focusNodeById(targetId),
      zoomWillChange ? 220 : 0,
    );
  };

  return (
    <div className={`relative w-full h-full bg-[#0a0a0a] overflow-hidden ${controlsVisible ? "" : "controls-hidden"}`}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #222 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Toolbar */}
      {controlsVisible && (
      <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20">
        <div className="flex items-center gap-6">
          <button
            className={`flex items-center gap-2 transition-colors font-medium ${canUndo ? "text-[#ffd60a] drop-shadow-[0_0_8px_rgba(255,214,10,0.35)] hover:text-[#d8ff58]" : "text-[#2f343d] cursor-not-allowed"}`}
            onClick={onUndo}
            disabled={!canUndo}
          >
            <Undo className="w-4 h-4" /> Undo
          </button>
          <button
            className={`flex items-center gap-2 transition-colors font-medium ${canRedo ? "text-[#ffd60a] drop-shadow-[0_0_8px_rgba(255,214,10,0.35)] hover:text-[#d8ff58]" : "text-[#2f343d] cursor-not-allowed"}`}
            onClick={onRedo}
            disabled={!canRedo}
          >
            <Redo className="w-4 h-4" /> Redo
          </button>
          <div
            className="relative flex h-9 w-[5.5rem] shrink-0 rounded-full border border-[#ffd60a]/35 bg-[#0a0a0a]/90 p-0.5 shadow-[0_0_12px_rgba(255,214,10,0.08)]"
            role="group"
            aria-label="Tree layout"
          >
            <div
              className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-[#ffd60a] shadow-[0_0_14px_rgba(255,214,10,0.45)] transition-[transform] duration-300 ease-[cubic-bezier(0.34,1.15,0.64,1)] will-change-transform"
              style={{
                transform:
                  treeLayout === "horizontal" ? "translateX(100%)" : "translateX(0)",
              }}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => setTreeLayout("vertical")}
              title="Top to bottom"
              aria-label="Layout top to bottom"
              aria-pressed={treeLayout === "vertical"}
              className={`relative z-10 flex flex-1 items-center justify-center rounded-full transition-[color,transform] duration-300 ease-out ${treeLayout === "vertical" ? "text-black scale-[1.03]" : "text-[#ffd60a]/75 hover:text-[#ffd60a]"}`}
            >
              <ArrowUpDown className="h-4 w-4 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setTreeLayout("horizontal")}
              title="Left to right"
              aria-label="Layout left to right"
              aria-pressed={treeLayout === "horizontal"}
              className={`relative z-10 flex flex-1 items-center justify-center rounded-full transition-[color,transform] duration-300 ease-out ${treeLayout === "horizontal" ? "text-black scale-[1.03]" : "text-[#ffd60a]/75 hover:text-[#ffd60a]"}`}
            >
              <ArrowLeftRight className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>

        <div className="relative flex items-center">
          <div
            className={`flex items-center rounded-full border border-[#ffd60a]/40 bg-[#0a0a0a]/90 backdrop-blur overflow-hidden transition-all duration-350 ease-[cubic-bezier(0.34,1.15,0.64,1)] ${isSearchOpen ? "w-[340px] pl-3 pr-1.5 py-1.5 gap-2" : "w-[120px] py-2.5 px-5 justify-center gap-2 cursor-pointer hover:bg-[#ffd60a]/10"}`}
            onClick={() => { if (!isSearchOpen) setIsSearchOpen(true); }}
          >
            <Search className="w-4 h-4 text-[#ffd60a] shrink-0" />
            {!isSearchOpen && (
              <span className="text-[#ffd60a] font-medium whitespace-nowrap">Search</span>
            )}
            {isSearchOpen && (
              <>
                <input
                  autoFocus
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applySearch(searchInput);
                    if (e.key === "Escape") {
                      setSearchInput("");
                      setActiveSearch("");
                      setIsSearchOpen(false);
                    }
                  }}
                  placeholder="Search key or value..."
                  className="flex-1 min-w-0 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-500"
                />
                <button
                  className="rounded-full bg-[#ffd60a] px-3 py-1.5 text-xs font-semibold text-black shrink-0 hover:bg-[#ffe44a] transition-colors"
                  onClick={() => applySearch(searchInput)}
                >
                  Find
                </button>
                <button
                  className="rounded-full p-1.5 text-neutral-400 hover:text-white transition-colors shrink-0"
                  onClick={() => {
                    setSearchInput("");
                    setActiveSearch("");
                    setIsSearchOpen(false);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
          {isSearchOpen && activeSearch && (
            <span className="absolute -bottom-5 right-0 text-[10px] text-neutral-500 whitespace-nowrap">
              Filtering: &quot;{activeSearch}&quot;
            </span>
          )}
        </div>
      </div>
      )}

      {/* Canvas Layer */}
      <div
        ref={canvasRef}
        onMouseDown={startPan}
        onWheel={handleWheelZoom}
        className={`absolute inset-0 overflow-auto z-10 p-24 pl-32 custom-scrollbar ${isPanning ? "cursor-grabbing select-none" : "cursor-grab"}`}
      >
        <div
          className="min-w-max min-h-max pt-16 pl-[55vw] pr-[55vw] pb-[55vh] origin-top-left transition-transform duration-200 ease-out"
          style={{ transform: `scale(${zoom})` }}
        >
          {errorMsg ? (
            <div className="text-red-500 font-mono">{errorMsg}</div>
          ) : parsedData ? (
            <NodeTree
              data={parsedData}
              name="root"
              path={[]}
              isRoot={true}
              layoutDirection={treeLayout}
              searchTerm={activeSearch}
              onFocusNode={focusNodeForEditing}
              onEdit={updateByPath}
              onDelete={deleteByPath}
              onAdd={addOnPath}
            />
          ) : null}
        </div>
      </div>

      {/* Zoom Controls */}
      {controlsVisible && (
      <div className="absolute bottom-6 left-6 flex flex-col gap-2 bg-[#111] border border-neutral-800 rounded-lg p-1 z-20">
        <button
          className="p-2 text-neutral-400 hover:text-white transition-colors"
          onClick={zoomIn}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-full h-px bg-neutral-800" />
        <button
          className="p-2 text-neutral-400 hover:text-white transition-colors"
          onClick={zoomOut}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-full h-px bg-neutral-800" />
        <button
          className="p-2 text-neutral-400 hover:text-white transition-colors"
          onClick={resetZoom}
          title="Reset zoom"
          aria-label="Reset zoom"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
      )}

      {/* Legend */}
      {controlsVisible && (
      <div className="absolute bottom-6 right-6 bg-[#111]/90 backdrop-blur border border-neutral-800 rounded-xl p-5 z-20 shadow-2xl">
        <div className="text-xs text-neutral-500 font-bold tracking-widest mb-4">
          LEGEND
        </div>
        <div className="flex flex-col gap-3">
          <LegendItem color="bg-purple-500" label="Root" />
          <LegendItem color="bg-blue-500" label="Object" />
          <LegendItem color="bg-orange-500" label="Array" />
          <LegendItem color="bg-green-500" label="Value" />
          <LegendItem color="bg-neutral-500" label="Pointer" />
        </div>
      </div>
      )}

      {addPropertyPath && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[500px] rounded-2xl border border-neutral-800 bg-[#08090b] shadow-[0_12px_60px_rgba(0,0,0,0.7)] p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-2xl font-semibold text-neutral-100">
                Add property
              </h3>
              <button
                className="text-neutral-500 hover:text-neutral-300 transition-colors"
                onClick={closeAddPropertyModal}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-neutral-300 mb-2 text-sm">
                  Key
                </label>
                <input
                  value={propertyKey}
                  onChange={(e) => setPropertyKey(e.target.value)}
                  placeholder="ex: name"
                  className="w-full rounded-xl border border-[#ffd60a]/50 focus:border-[#ffd60a] bg-[#111217] px-4 py-3 text-base text-neutral-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-neutral-300 mb-2 text-sm">
                  Type
                </label>
                <div className="relative">
                  <select
                    value={propertyType}
                    onChange={(e) =>
                      setPropertyType(e.target.value as AddPropertyType)
                    }
                    className="w-full appearance-none rounded-xl border border-neutral-700 bg-[#0b0d10] px-4 py-3 pr-10 text-base text-neutral-200 outline-none focus:border-[#ffd60a]/50"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="null">Null</option>
                    <option value="date">Date</option>
                    <option value="datetime">Datetime</option>
                    <option value="color">Color</option>
                    <option value="object">Object</option>
                    <option value="array">Array</option>
                  </select>
                  <svg
                    className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                className="rounded-xl px-6 py-2.5 text-base font-medium bg-[#ffd60a] text-black shadow-[0_0_20px_rgba(255,214,10,0.35)] hover:shadow-[0_0_30px_rgba(255,214,10,0.55)] transition-shadow disabled:opacity-50"
                onClick={submitAddProperty}
                disabled={!propertyKey.trim()}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {addArrayItemPath && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[500px] rounded-2xl border border-neutral-800 bg-[#08090b] shadow-[0_12px_60px_rgba(0,0,0,0.7)] p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-2xl font-semibold text-neutral-100">
                Add array item
              </h3>
              <button
                className="text-neutral-500 hover:text-neutral-300 transition-colors"
                onClick={closeAddArrayItemModal}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-neutral-300 mb-2 text-sm">
                Type
              </label>
              <div className="relative">
                <select
                  value={arrayItemType}
                  onChange={(e) =>
                    setArrayItemType(e.target.value as AddPropertyType)
                  }
                  className="w-full appearance-none rounded-xl border border-neutral-700 bg-[#0b0d10] px-4 py-3 pr-10 text-base text-neutral-200 outline-none focus:border-[#ffd60a]/50"
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="null">Null</option>
                  <option value="date">Date</option>
                  <option value="datetime">Datetime</option>
                  <option value="color">Color</option>
                  <option value="object">Object</option>
                  <option value="array">Array</option>
                </select>
                <svg
                  className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                className="rounded-xl px-6 py-2.5 text-base font-medium bg-[#ffd60a] text-black shadow-[0_0_20px_rgba(255,214,10,0.35)] hover:shadow-[0_0_30px_rgba(255,214,10,0.55)] transition-shadow"
                onClick={submitAddArrayItem}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-sm text-neutral-400 font-medium">{label}</span>
    </div>
  );
}

function NodeTree({
  data,
  name,
  path,
  isRoot,
  layoutDirection,
  searchTerm,
  onFocusNode,
  onEdit,
  onDelete,
  onAdd,
}: {
  data: any;
  name: string;
  path: PathSegment[];
  isRoot?: boolean;
  layoutDirection: TreeLayoutDirection;
  searchTerm: string;
  onFocusNode: (path: PathSegment[]) => void;
  onEdit: (path: PathSegment[], value: unknown) => void;
  onDelete: (path: PathSegment[]) => void;
  onAdd: (path: PathSegment[], isArray: boolean) => void;
}) {
  const isPrimitive = data === null || typeof data !== "object";
  const isArray = Array.isArray(data);
  const isObject = data !== null && typeof data === "object" && !isArray;

  const scalars: Array<{ name: string; value: any; path: PathSegment[] }> = [];
  const children: Array<{ name: string; value: any; path: PathSegment[] }> = [];

  if (isObject) {
    Object.entries(data).forEach(([k, v]) => {
      if (typeof v === "object" && v !== null) {
        children.push({ name: k, value: v, path: [...path, k] });
      } else {
        scalars.push({ name: k, value: v, path: [...path, k] });
      }
    });
  } else if (isArray) {
    data.forEach((v, i) => {
      children.push({ name: `${i}`, value: v, path: [...path, i] });
    });
  }

  const type = isRoot ? "root" : isArray ? "array" : "object";
  const hasSingleChild = children.length === 1;
  const isNodeMatch =
    matchesSearchTerm(name, searchTerm) ||
    scalars.some(
      (s) => matchesSearchTerm(s.name, searchTerm) || matchesSearchTerm(s.value, searchTerm),
    );

  if (isPrimitive) {
    return (
      <LeafNode
        name={name}
        value={data}
        path={path}
        nodeId={nodeIdFromPath(path)}
        isHighlighted={
          matchesSearchTerm(name, searchTerm) || matchesSearchTerm(data, searchTerm)
        }
        onFocusNode={onFocusNode}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  }

  const rootClass =
    layoutDirection === "vertical"
      ? "flex flex-col items-center"
      : "flex flex-row items-center";

  return (
    <div className={rootClass}>
      <NodeBox
        nodePath={path}
        nodeId={nodeIdFromPath(path)}
        name={name}
        scalars={scalars}
        type={type}
        itemCount={isArray ? data.length : null}
        canDelete={!isRoot}
        searchTerm={searchTerm}
        isHighlighted={isNodeMatch}
        onFocusNode={onFocusNode}
        onDeleteNode={() => onDelete(path)}
        onEdit={onEdit}
        onDelete={onDelete}
        onAdd={() => onAdd(path, isArray)}
      />

      {children.length > 0 &&
        (layoutDirection === "vertical" ? (
          <div className="flex flex-col items-center">
            <div className="node-connector-v h-16 shrink-0" />

            {hasSingleChild ? (
              <>
                <div className="node-connector-v h-16 shrink-0" />
                <NodeTree
                  data={children[0].value}
                  name={children[0].name}
                  path={children[0].path}
                  layoutDirection={layoutDirection}
                  searchTerm={searchTerm}
                  onFocusNode={onFocusNode}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAdd={onAdd}
                />
              </>
            ) : (
              <div className="flex gap-0 relative">
                {children.map((child, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === children.length - 1;
                  const midIndex = (children.length - 1) / 2;
                  const isLeftOfCenter = idx < midIndex;
                  const isRightOfCenter = idx > midIndex;
                  const isExactCenter = idx === midIndex;

                  return (
                    <div
                      key={idx}
                      className="relative flex min-w-[200px] flex-1 flex-col items-center px-8"
                    >
                      {isFirst ? (
                        <div className="node-connector-h node-connector-h-reverse absolute top-0 right-0 left-[calc(50%-1px)]" />
                      ) : isLast ? (
                        <div className="node-connector-h absolute top-0 right-[calc(50%-1px)] left-0" />
                      ) : isExactCenter ? (
                        <>
                          <div className="node-connector-h node-connector-h-reverse absolute top-0 right-[calc(50%-1px)] left-0" />
                          <div className="node-connector-h absolute top-0 right-0 left-[calc(50%-1px)]" />
                        </>
                      ) : isLeftOfCenter ? (
                        <div className="node-connector-h node-connector-h-reverse absolute top-0 right-0 left-0" />
                      ) : (
                        <div className="node-connector-h absolute top-0 right-0 left-0" />
                      )}
                      <div className="node-connector-v h-16 shrink-0" />
                      <NodeTree
                        data={child.value}
                        name={child.name}
                        path={child.path}
                        layoutDirection={layoutDirection}
                        searchTerm={searchTerm}
                        onFocusNode={onFocusNode}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onAdd={onAdd}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-row items-center">
            <div className="node-connector-h w-16 shrink-0 self-center" />

            {hasSingleChild ? (
              <NodeTree
                data={children[0].value}
                name={children[0].name}
                path={children[0].path}
                layoutDirection={layoutDirection}
                searchTerm={searchTerm}
                onFocusNode={onFocusNode}
                onEdit={onEdit}
                onDelete={onDelete}
                onAdd={onAdd}
              />
            ) : (
              <div className="relative flex flex-col gap-0">
                {children.map((child, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === children.length - 1;
                  const midIndex = (children.length - 1) / 2;
                  const isLeftOfCenter = idx < midIndex;
                  const isRightOfCenter = idx > midIndex;
                  const isExactCenter = idx === midIndex;

                  return (
                    <div
                      key={idx}
                      className="relative flex min-h-[200px] flex-1 flex-row items-center py-8"
                    >
                      {isFirst ? (
                        <div className="node-connector-v node-connector-v-reverse absolute top-[calc(50%-1px)] bottom-0 left-0" />
                      ) : isLast ? (
                        <div className="node-connector-v absolute top-0 bottom-[calc(50%-1px)] left-0" />
                      ) : isExactCenter ? (
                        <>
                          <div className="node-connector-v node-connector-v-reverse absolute top-0 bottom-[calc(50%-1px)] left-0" />
                          <div className="node-connector-v absolute top-[calc(50%-1px)] bottom-0 left-0" />
                        </>
                      ) : isLeftOfCenter ? (
                        <div className="node-connector-v node-connector-v-reverse absolute top-0 bottom-0 left-0" />
                      ) : (
                        <div className="node-connector-v absolute top-0 bottom-0 left-0" />
                      )}
                      <div className="node-connector-h w-16 shrink-0 self-center" />
                      <NodeTree
                        data={child.value}
                        name={child.name}
                        path={child.path}
                        layoutDirection={layoutDirection}
                        searchTerm={searchTerm}
                        onFocusNode={onFocusNode}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onAdd={onAdd}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

function LeafNode({
  nodeId,
  name,
  value,
  path,
  isHighlighted,
  onFocusNode,
  onEdit,
  onDelete,
}: {
  nodeId: string;
  name: string;
  value: unknown;
  path: PathSegment[];
  isHighlighted?: boolean;
  onFocusNode: (path: PathSegment[]) => void;
  onEdit: (path: PathSegment[], value: unknown) => void;
  onDelete: (path: PathSegment[]) => void;
}) {
  return (
    <div
      data-node-id={nodeId}
      className={`bg-[#0a0a0a] border border-green-600/80 rounded-[14px] w-[280px] shadow-[0_8px_32px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden relative ${isHighlighted ? "ring-2 ring-[#ffd60a]/70 shadow-[0_0_22px_rgba(255,214,10,0.22)]" : ""}`}
    >
      <div className="absolute inset-0 bg-[#111111] opacity-90 z-0 pointer-events-none" />
      <div className="px-5 py-4 flex justify-between items-center relative z-10">
        <span className="font-semibold text-[15px] text-green-400">{name}</span>
        <Trash2
          className="w-4 h-4 text-neutral-600 hover:text-red-400 transition-colors cursor-pointer"
          onClick={() => onDelete(path)}
        />
      </div>
      <div className="px-3 pb-3 relative z-10">
        {typeof value === "boolean" ? (
          <div className="flex justify-end pr-2">
            <div
              className={`w-10 h-5 rounded-full relative cursor-pointer transition-all duration-300 ease-out ${value ? "bg-[#ffd60a] shadow-[0_0_14px_rgba(255,214,10,0.45)]" : "bg-neutral-700"}`}
              onClick={() => onEdit(path, !value)}
            >
              <div
                className={`absolute left-1 top-[2px] w-4 h-4 bg-black rounded-full transition-transform duration-300 ease-out ${value ? "translate-x-4 scale-100" : "translate-x-0 scale-95"}`}
              />
            </div>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={value === null ? "null" : String(value)}
              onChange={(e) => onEdit(path, parseInputValue(e.target.value))}
              onFocus={() => onFocusNode(path)}
              className={`w-full bg-[#161616] border border-neutral-800 rounded-lg px-3 py-1.5 text-[13px] text-neutral-300 focus:border-[#ffd60a]/50 focus:ring-1 focus:ring-[#ffd60a]/50 outline-none transition-all ${isHexColor(value) ? "pr-10" : ""}`}
            />
            {isHexColor(value) && (
              <input
                type="color"
                value={value}
                onChange={(e) => onEdit(path, e.target.value)}
                className="color-input-inline absolute right-1.5 top-1/2 h-6 w-6 -translate-y-1/2 cursor-pointer"
                aria-label="Choose color"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NodeBox({
  nodePath,
  nodeId,
  name,
  scalars,
  type,
  itemCount,
  canDelete,
  searchTerm,
  isHighlighted,
  onFocusNode,
  onDeleteNode,
  onEdit,
  onDelete,
  onAdd,
}: {
  nodePath: PathSegment[];
  nodeId: string;
  name: string;
  scalars: Array<{ name: string; value: unknown; path: PathSegment[] }>;
  type: string;
  itemCount: number | null;
  canDelete: boolean;
  searchTerm: string;
  isHighlighted?: boolean;
  onFocusNode: (path: PathSegment[]) => void;
  onDeleteNode: () => void;
  onEdit: (path: PathSegment[], value: unknown) => void;
  onDelete: (path: PathSegment[]) => void;
  onAdd: () => void;
}) {
  const colors: Record<string, string> = {
    root: "border-purple-600",
    object: "border-blue-600",
    array: "border-orange-600",
  };

  const textColors: Record<string, string> = {
    root: "text-purple-400",
    object: "text-blue-400",
    array: "text-orange-400",
  };

  const borderColor = colors[type] || colors.object;
  const textColor = textColors[type] || textColors.object;

  return (
    <div
      data-node-id={nodeId}
      className={`bg-[#0a0a0a] border border-opacity-80 rounded-[14px] w-[280px] shadow-[0_8px_32px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden relative ${borderColor} ${isHighlighted ? "ring-2 ring-[#ffd60a]/70 shadow-[0_0_22px_rgba(255,214,10,0.22)]" : ""}`}
    >
      {/* Subtle background glow effect can be added here if needed, but #0a0a0a solid is close */}
      <div className="absolute inset-0 bg-[#111111] opacity-90 z-0 pointer-events-none" />

      <div className="px-5 py-4 flex justify-between items-center relative z-10">
        <div>
          <span className={`font-semibold text-[15px] ${textColor}`}>
            {name}
          </span>
          {type === "array" && (
            <span className="ml-3 text-[13px] text-neutral-500 font-medium">
              {itemCount} items
            </span>
          )}
        </div>
        {canDelete && (
          <Trash2
            className="w-4 h-4 text-neutral-600 hover:text-red-400 transition-colors cursor-pointer"
            onClick={onDeleteNode}
          />
        )}
      </div>

      {scalars.length > 0 && (
        <div className="px-3 pb-3 flex flex-col gap-2.5 relative z-10">
          {scalars.map((s, i) => (
            <div key={i} className="flex items-center gap-3 group">
              <span className="text-[13px] text-neutral-400 w-16 truncate font-medium pl-2">
                {s.name}
              </span>

              {typeof s.value === "boolean" ? (
                <div className="flex-1 flex justify-end pr-2">
                  <div
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-all duration-300 ease-out ${s.value ? "bg-[#ffd60a] shadow-[0_0_14px_rgba(255,214,10,0.45)]" : "bg-neutral-700"}`}
                    onClick={() => onEdit(s.path, !s.value)}
                  >
                    <div
                      className={`absolute left-1 top-[2px] w-4 h-4 bg-black rounded-full transition-transform duration-300 ease-out ${s.value ? "translate-x-4 scale-100" : "translate-x-0 scale-95"}`}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex">
                  <div className="relative w-full">
                    <input
                      type="text"
                      value={String(s.value)}
                      onChange={(e) =>
                        onEdit(s.path, parseInputValue(e.target.value))
                      }
                      onFocus={() => onFocusNode(nodePath)}
                      className={`w-full bg-[#161616] border border-neutral-800 rounded-lg px-3 py-1.5 text-[13px] text-neutral-300 focus:border-[#ffd60a]/50 focus:ring-1 focus:ring-[#ffd60a]/50 outline-none transition-all ${isHexColor(s.value) ? "pr-10" : ""} ${matchesSearchTerm(s.name, searchTerm) || matchesSearchTerm(s.value, searchTerm) ? "ring-1 ring-[#ffd60a]/50" : ""}`}
                    />
                    {isHexColor(s.value) && (
                      <input
                        type="color"
                        value={s.value}
                        onChange={(e) => onEdit(s.path, e.target.value)}
                        className="color-input-inline absolute right-1.5 top-1/2 h-6 w-6 -translate-y-1/2 cursor-pointer"
                        aria-label="Choose color"
                      />
                    )}
                  </div>
                </div>
              )}

              <div className="w-5 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2
                  className="w-3.5 h-3.5 text-neutral-500 hover:text-red-400 cursor-pointer"
                  onClick={() => onDelete(s.path)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className="py-3.5 flex items-center justify-center gap-2 text-[13px] text-neutral-400 hover:bg-white/5 border-t border-neutral-800/80 transition-colors relative z-10 font-medium"
        onClick={onAdd}
      >
        <Plus className="w-4 h-4" />
        {type === "array" ? "Item" : "Add property"}
      </button>
    </div>
  );
}
