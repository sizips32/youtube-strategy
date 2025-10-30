import { useState, useEffect, useRef } from "react";
import { useOntologyStore } from "../stores/useOntologyStore";
import { logger } from "../lib/logger";

interface SearchCommandProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  title: string;
  type: "entity" | "decision" | "action" | "metric" | "command";
  description?: string;
  path?: string;
  icon: string;
  action?: () => void;
}

export function SearchCommand({ isOpen, onClose }: SearchCommandProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const snapshot = useOntologyStore((state) => state.snapshot);
  const vaultName = import.meta.env.VITE_OBSIDIAN_VAULT || "MyObsidianVault";

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query) {
      // Show recent items or commands when no query
      setResults([
        {
          id: "cmd-new",
          title: "Create New Entity",
          type: "command",
          description: "Add a new entity to the ontology",
          icon: "➕",
          action: () => logger.info("Create new entity")
        },
        {
          id: "cmd-sync",
          title: "Sync Vault",
          type: "command",
          description: "Synchronize with Obsidian vault",
          icon: "🔄",
          action: () => logger.info("Sync vault")
        },
        {
          id: "cmd-export",
          title: "Export Data",
          type: "command",
          description: "Export ontology data",
          icon: "📥",
          action: () => logger.info("Export data")
        }
      ]);
      return;
    }

    // Search through snapshot data
    const searchResults: SearchResult[] = [];
    const searchTerm = query.toLowerCase();

    // Search entities
    snapshot?.entities.forEach((entity) => {
      if (entity.title.toLowerCase().includes(searchTerm)) {
        searchResults.push({
          id: entity.id,
          title: entity.title,
          type: "entity",
          description: entity.type,
          path: entity.filePath,
          icon: "📦"
        });
      }
    });

    // Search decisions
    snapshot?.decisions.forEach((decision) => {
      if (decision.title.toLowerCase().includes(searchTerm)) {
        searchResults.push({
          id: decision.id,
          title: decision.title,
          type: "decision",
          description: decision.context,
          path: decision.filePath,
          icon: "🎯"
        });
      }
    });

    // Search actions
    snapshot?.actions.forEach((action) => {
      const triggerLogic = action.triggerLogic?.toLowerCase() ?? "";
      const actionOutput = action.actionOutput?.toLowerCase() ?? "";
      if (
        triggerLogic.includes(searchTerm) ||
        actionOutput.includes(searchTerm)
      ) {
        searchResults.push({
          id: action.id,
          title: `${action.triggerLogic ?? "Unknown Trigger"} → ${action.actionOutput ?? "Unknown Output"}`,
          type: "action",
          description: action.status,
          path: action.filePath,
          icon: "⚡"
        });
      }
    });

    // Add commands that match
    if ("create".includes(searchTerm)) {
      searchResults.push({
        id: "cmd-new",
        title: "Create New Entity",
        type: "command",
        icon: "➕",
        action: () => logger.info("Create new entity")
      });
    }

    setResults(searchResults.slice(0, 10));
    setSelectedIndex(0);
  }, [query, snapshot]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  };

  const handleSelect = (result: SearchResult) => {
    if (result.action) {
      result.action();
    } else if (result.path) {
      // Open in Obsidian
      const encodedVault = encodeURIComponent(vaultName);
      window.open(`obsidian://open?vault=${encodedVault}&file=${encodeURIComponent(result.path)}`);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="button"
        aria-label="Close search"
      />

      {/* Command Palette */}
      <div className="fixed left-1/2 top-1/4 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/4">
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
          {/* Search Input */}
          <div className="flex items-center border-b border-slate-800 px-4">
            <svg
              className="h-5 w-5 text-slate-400"
              fill="none"
              viewBox="0 0 20 20"
              role="img"
              aria-label="Search icon"
            >
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
              <path
                d="M14 14L17 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search entities, decisions, actions, or type a command..."
              className="flex-1 bg-transparent px-3 py-4 text-slate-200 placeholder-slate-500 focus:outline-none"
              aria-label="Search"
            />
            <kbd className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                No results found for "{query}"
              </div>
            ) : (
              <div className="py-2">
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      index === selectedIndex
                        ? "bg-slate-800"
                        : "hover:bg-slate-800/50"
                    }`}
                    aria-selected={index === selectedIndex}
                    role="option"
                  >
                    <span className="text-xl">{result.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-200">
                        {result.title}
                      </div>
                      {result.description && (
                        <div className="text-xs text-slate-400 line-clamp-1">
                          {result.description}
                        </div>
                      )}
                    </div>
                    {result.type === "command" ? (
                      <span className="rounded bg-blue-900/30 px-2 py-0.5 text-xs text-blue-400">
                        Command
                      </span>
                    ) : (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                        {result.type}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5">↑↓</kbd> Navigate
              </span>
              <span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5">↵</kbd> Select
              </span>
              <span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5">ESC</kbd> Close
              </span>
            </div>
            <span>{results.length} results</span>
          </div>
        </div>
      </div>
    </>
  );
}
