import { useState, useMemo, useEffect } from "react";
import { useOntologyStore } from "../stores/useOntologyStore";
import { logger } from "../lib/logger";

interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  priority?: "low" | "medium" | "high" | "critical";
  assignee?: string;
  dueDate?: string;
  layer: "semantic" | "kinetic" | "dynamic";
  metadata?: Array<{
    label: string;
    value: string;
  }>;
}

interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  color: string;
  limit?: number;
}

interface WorkflowManifest {
  version?: string;
  metadata?: {
    owner?: string;
    description?: string;
  };
  applications?: ManifestApplication[];
  automations?: ManifestAutomation[];
  feedback_loops?: ManifestFeedbackLoops;
}

interface ManifestApplication {
  id: string;
  layer: string;
  description?: string;
  commands?: Record<string, string>;
  port?: number;
  env?: string;
}

interface ManifestAutomation {
  id: string;
  location: string;
  template?: string;
  description?: string;
  trigger: string;
  outputs?: string[];
}

interface ManifestFeedbackLoops {
  daily?: {
    source: string;
    automation?: string;
  };
  weekly?: {
    source: string;
    automation?: string;
  };
  runlog?: {
    path: string;
    retention_days?: number;
  };
}

export function WorkspaceManager() {
  const snapshot = useOntologyStore((state) => state.snapshot);
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<"workflow" | "projects" | "ideas">("workflow");
  const [manifest, setManifest] = useState<WorkflowManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [manifestLoading, setManifestLoading] = useState<boolean>(true);

  const boards = [
    { id: "workflow" as const, label: "Workflow Pipeline", icon: "🔄" },
    { id: "projects" as const, label: "Active Projects", icon: "🚀" },
    { id: "ideas" as const, label: "Idea Backlog", icon: "💡" }
  ];

  useEffect(() => {
    let cancelled = false;

    const loadManifest = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/workflowManifest.json`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} while loading workflow manifest`);
        }
        const data = (await response.json()) as WorkflowManifest;
        if (!cancelled) {
          setManifest(data);
          setManifestError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setManifestError(error instanceof Error ? error.message : String(error));
          setManifest(null);
        }
      } finally {
        if (!cancelled) {
          setManifestLoading(false);
        }
      }
    };

    loadManifest();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo((): KanbanColumn[] => {
    if (selectedBoard === "workflow") {
      if (manifestLoading) {
        return [
          {
            id: "workflow-loading",
            title: "⏳ Manifest Loading",
            cards: [
              {
                id: "manifest-loading",
                title: "Loading workflow manifest…",
                description: "Fetching data from workflowManifest.json",
                layer: "kinetic"
              }
            ],
            color: "from-slate-500 to-slate-600"
          }
        ];
      }

      if (manifestError || !manifest) {
        return [
          {
            id: "workflow-error",
            title: "⚠️ Manifest Error",
            cards: [
              {
                id: "manifest-error",
                title: "Failed to load manifest",
                description: manifestError ?? "Unknown error occurred.",
                layer: "dynamic",
                priority: "high"
              }
            ],
            color: "from-red-500 to-red-600"
          }
        ];
      }

      const applicationCards: KanbanCard[] = (manifest.applications ?? []).map((app) => ({
        id: `app-${app.id}`,
        title: app.id,
        description: app.description,
        tags: [
          ...(app.port ? [`port:${app.port}`] : []),
          ...(app.env ? [`env:${app.env}`] : []),
          ...Object.keys(app.commands ?? {})
        ],
        metadata: [
          { label: "Location", value: app.layer },
          {
            label: "Commands",
            value: Object.entries(app.commands ?? {})
              .map(([name, command]) => `${name}: ${command}`)
              .join(" • ")
          }
        ].filter((meta) => meta.value),
        layer: "kinetic"
      }));

      const automationCards: KanbanCard[] = (manifest.automations ?? []).map((automation) => ({
        id: `automation-${automation.id}`,
        title: automation.id,
        description: automation.description,
        tags: [
          automation.trigger,
          ...(automation.outputs ?? []).slice(0, 3)
        ].filter(Boolean),
        metadata: [
          { label: "Location", value: automation.location },
          ...(automation.template
            ? [{ label: "Template", value: automation.template }]
            : []),
          ...(automation.outputs && automation.outputs.length > 3
            ? [{ label: "Outputs", value: automation.outputs.join(", ") }]
            : [])
        ],
        layer: "kinetic",
        priority: "high"
      }));

      const feedbackCards: KanbanCard[] = [];
      const loops = manifest.feedback_loops ?? {};

      if (loops.daily) {
        feedbackCards.push({
          id: "feedback-daily",
          title: "Daily Feedback Loop",
          description: "Daily BRAIN summary syncing into Feedback_Loops.",
          tags: ["daily", loops.daily.automation ?? "automation?"],
          metadata: [
            { label: "Source", value: loops.daily.source },
            ...(loops.daily.automation
              ? [{ label: "Automation", value: loops.daily.automation }]
              : [])
          ],
          layer: "dynamic",
          priority: "medium"
        });
      }

      if (loops.weekly) {
        feedbackCards.push({
          id: "feedback-weekly",
          title: "Weekly Review Loop",
          description: "Weekly review note generation and Todoist sync.",
          tags: ["weekly", loops.weekly.automation ?? "automation?"],
          metadata: [
            { label: "Source", value: loops.weekly.source },
            ...(loops.weekly.automation
              ? [{ label: "Automation", value: loops.weekly.automation }]
              : [])
          ],
          layer: "dynamic",
          priority: "medium"
        });
      }

      if (loops.runlog) {
        feedbackCards.push({
          id: "feedback-runlog",
          title: "Automation Runlog",
          description: "Persistence layer for execution evidence.",
          tags: ["logging", "retention"],
          metadata: [
            { label: "Path", value: loops.runlog.path },
            ...(loops.runlog.retention_days
              ? [{ label: "Retention", value: `${loops.runlog.retention_days} days` }]
              : [])
          ],
          layer: "dynamic",
          priority: "low"
        });
      }

      return [
        {
          id: "applications",
          title: "🧩 Applications",
          cards: applicationCards,
          color: "from-blue-500 to-blue-600"
        },
        {
          id: "automations",
          title: "🤖 Automations",
          cards: automationCards,
          color: "from-purple-500 to-purple-600"
        },
        {
          id: "feedback",
          title: "📈 Feedback Loops",
          cards: feedbackCards,
          color: "from-emerald-500 to-emerald-600"
        }
      ];
    }

    if (!snapshot) return [];

    // Default empty columns for other boards
    return [
      { id: "todo", title: "To Do", cards: [], color: "from-slate-500 to-slate-600" },
      { id: "progress", title: "In Progress", cards: [], color: "from-blue-500 to-blue-600" },
      { id: "done", title: "Done", cards: [], color: "from-green-500 to-green-600" }
    ];
  }, [selectedBoard, snapshot, manifest, manifestLoading, manifestError]);

  const handleDragStart = (cardId: string) => {
    setDraggedCard(cardId);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
  };

  const handleDrop = (columnId: string) => {
    logger.info(`Dropped ${draggedCard} into ${columnId}`);
    // Implementation would update the store here
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-slate-500";
    }
  };

  const getLayerIcon = (layer: string) => {
    switch (layer) {
      case "semantic": return "📚";
      case "kinetic": return "⚡";
      case "dynamic": return "🔄";
      default: return "📄";
    }
  };

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Workspace Manager</h2>
          <p className="mt-1 text-sm text-slate-400">
            Organize and track your ontology workflow with visual kanban boards
          </p>
        </div>

        {/* Board Selector */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-1">
          {boards.map((board) => (
            <button
              key={board.id}
              onClick={() => setSelectedBoard(board.id)}
              className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-all ${
                selectedBoard === board.id
                  ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-300"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{board.icon}</span>
              {board.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex h-full gap-4" style={{ minWidth: `${columns.length * 320}px` }}>
          {columns.map((column) => (
            <div
              key={column.id}
              className="flex w-80 flex-col rounded-xl border border-slate-800 bg-slate-950/50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(column.id)}
            >
              {/* Column Header */}
              <div className="border-b border-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">{column.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {column.cards.length}
                      {column.limit && ` / ${column.limit}`}
                    </span>
                    <button className="rounded p-1 text-slate-400 hover:bg-slate-800">
                      <span>⋯</span>
                    </button>
                  </div>
                </div>
                {column.limit && (
                  <div className="mt-2">
                    <div className="h-1 w-full rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${column.color}`}
                        style={{
                          width: `${Math.min(100, (column.cards.length / column.limit) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="space-y-2">
                  {column.cards.map((card) => (
                    <div
                      key={card.id}
                      draggable={selectedBoard !== "workflow"}
                      onDragStart={() => selectedBoard !== "workflow" && handleDragStart(card.id)}
                      onDragEnd={handleDragEnd}
                      className={`rounded-lg border border-slate-800 bg-slate-900/50 p-3 transition-all ${
                        selectedBoard !== "workflow"
                          ? "cursor-move hover:border-slate-700 hover:bg-slate-800/50"
                          : "cursor-default"
                      } ${
                        draggedCard === card.id ? "opacity-50" : ""
                      }`}
                    >
                      {/* Card Header */}
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getLayerIcon(card.layer)}</span>
                          <h4 className="text-sm font-medium text-slate-200 line-clamp-2">
                            {card.title}
                          </h4>
                        </div>
                        {card.priority && (
                          <div
                            className={`h-2 w-2 rounded-full ${getPriorityColor(card.priority)}`}
                            title={card.priority}
                          />
                        )}
                      </div>

                      {/* Card Description */}
                      {card.description && (
                        <p className="mb-2 text-xs text-slate-400 line-clamp-2">
                          {card.description}
                        </p>
                      )}

                      {/* Card Tags */}
                      {card.tags && card.tags.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {card.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400"
                            >
                              {tag}
                          </span>
                        ))}
                      </div>
                      )}

                      {/* Card Metadata */}
                      {card.metadata && card.metadata.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {card.metadata.slice(0, 4).map((meta) => (
                            <div key={`${card.id}-${meta.label}`} className="flex items-start gap-1 text-xs">
                              <span className="text-slate-500">{meta.label}:</span>
                              <span className="text-slate-300 break-words">{meta.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Card Footer */}
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        {card.assignee && <span>{card.assignee}</span>}
                        {card.dueDate && <span>{card.dueDate}</span>}
                      </div>
                    </div>
                  ))}

                  {/* Add Card Button */}
                  {selectedBoard !== "workflow" && (
                    <button className="w-full rounded-lg border border-dashed border-slate-700 py-2 text-sm text-slate-500 hover:border-slate-600 hover:bg-slate-900/50 hover:text-slate-400" aria-label="Add card">
                      + Add Card
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Add Column Button */}
          {selectedBoard !== "workflow" && (
            <div className="flex w-80 items-center justify-center rounded-xl border border-dashed border-slate-700">
              <button className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-900/50 hover:text-slate-400" aria-label="Add column">
                + Add Column
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4">
        <div className="flex items-center gap-6 text-xs text-slate-500">
          <span>Total Cards: {columns.reduce((acc, col) => acc + col.cards.length, 0)}</span>
          <span>Active Columns: {columns.length}</span>
          <span>WIP Limit: {columns.find(c => c.id === "processing")?.limit || "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
            Export Board
          </button>
          <button className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-1.5 text-sm text-white hover:from-blue-500 hover:to-purple-500">
            Save Layout
          </button>
        </div>
      </div>
    </div>
  );
}
