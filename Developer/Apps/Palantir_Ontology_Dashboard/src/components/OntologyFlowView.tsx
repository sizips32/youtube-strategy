import { useMemo, useState } from "react";
import { logger } from "../lib/logger";
import { useOntologyStore } from "../stores/useOntologyStore";
import { ObsidianLinkButton } from "./ObsidianLinkButton";
import { classifyEntityLayer } from "../utils/layerClassification";
import { ViewRecommendation } from "./ViewRecommendation";
import { WorkflowGuide } from "./WorkflowGuide";
import type { OntologyEntity } from "../stores/useOntologyStore";
import type { ViewMode } from "../App";

interface OntologyFlowViewProps {
  onEntitySelect?: (entity: OntologyEntity | null) => void;
  onViewChange?: (view: ViewMode) => void;
}

type LayerType = "inbox" | "semantic" | "kinetic" | "dynamic";

interface FlowNode {
  id: string;
  title: string;
  type: string;
  layer: LayerType;
  status?: string;
  connections: string[];
  metadata: {
    tags?: string[];
    owner?: string;
    updatedAt?: string;
    filePath?: string;
    mtime?: number; // File modification time in milliseconds
  };
}

export function OntologyFlowView({ onEntitySelect, onViewChange }: OntologyFlowViewProps = {}) {
  const snapshot = useOntologyStore((state) => state.snapshot);
  const [selectedLayer, setSelectedLayer] = useState<LayerType | "all">("all");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(true);

  // Track how many nodes to show per layer (for "View more" functionality)
  const [nodesToShowPerLayer, setNodesToShowPerLayer] = useState<Record<LayerType, number>>({
    inbox: 10,
    semantic: 10,
    kinetic: 10,
    dynamic: 10
  });

  const flowData = useMemo(() => {
    if (!snapshot) return { nodes: [], connections: [] };

    const nodes: FlowNode[] = snapshot.entities.map((entity) => {
      const layer = classifyEntityLayer(entity);
      logger.debug(`OntologyFlowView: Entity "${entity.title}" (type: ${entity.type}) -> ${layer} layer`);

      // Extract modification time from entity if available
      let mtime = 0;
      if (entity.mtime) {
        mtime = entity.mtime;
      } else if (entity.filePath) {
        // Fallback: use a hash-based pseudo-timestamp from the file path
        // This ensures consistent ordering when real mtime is unavailable
        const hash = entity.filePath.split('').reduce((acc, char) => {
          return ((acc << 5) - acc) + char.charCodeAt(0);
        }, 0);
        mtime = Math.abs(hash) % (Date.now());
      }

      return {
        id: entity.id,
        title: entity.title,
        type: entity.type || "unknown",
        layer,
        status: entity.status,
        connections: entity.relatedDecisions || [],
        metadata: {
          tags: entity.tags,
          owner: entity.owner,
          updatedAt: entity.filePath,
          filePath: entity.filePath,
          mtime: mtime
        }
      };
    });

    const connections = snapshot.actions.map((action) => ({
      source: action.sourceEntity,
      target: action.actionOutput,
      type: action.triggerLogic,
      status: action.status
    }));

    return { nodes, connections };
  }, [snapshot]);

  const layers: Array<{
    id: LayerType;
    name: string;
    description: string;
    color: string;
    icon: string;
  }> = [
    {
      id: "inbox",
      name: "Inbox",
      description: "Untriaged quick captures",
      color: "from-cyan-500 to-cyan-600",
      icon: "📥"
    },
    {
      id: "semantic",
      name: "Semantic Layer",
      description: "Static knowledge structure and meaning",
      color: "from-blue-500 to-blue-600",
      icon: "📚"
    },
    {
      id: "kinetic",
      name: "Kinetic Layer",
      description: "Active processes and workflows",
      color: "from-purple-500 to-purple-600",
      icon: "⚡"
    },
    {
      id: "dynamic",
      name: "Dynamic Layer",
      description: "Evolution and decision-making",
      color: "from-amber-500 to-amber-600",
      icon: "🔄"
    }
  ];

  const filteredNodes = useMemo(() => {
    if (selectedLayer === "all") return flowData.nodes;
    return flowData.nodes.filter((node) => node.layer === selectedLayer);
  }, [flowData.nodes, selectedLayer]);

  const nodesByLayer = useMemo(() => {
    const grouped: Record<LayerType, FlowNode[]> = {
      inbox: [],
      semantic: [],
      kinetic: [],
      dynamic: []
    };

    filteredNodes.forEach((node) => {
      grouped[node.layer].push(node);
    });

    // Sort each layer by modification time (most recent first)
    Object.keys(grouped).forEach((key) => {
      grouped[key as LayerType].sort((a, b) => {
        const aTime = a.metadata.mtime || 0;
        const bTime = b.metadata.mtime || 0;
        return bTime - aTime; // Descending order (newest first)
      });
    });

    return grouped;
  }, [filteredNodes]);

  const selectedNodeData = flowData.nodes.find((n) => n.id === selectedNode) || null;

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar Guides */}
      {showGuides && (
        <div className="w-80 border-r border-slate-800 overflow-y-auto bg-slate-950/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-100">학습 가이드</h3>
            <button
              onClick={() => setShowGuides(false)}
              className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
            >
              ✕
            </button>
          </div>

          {/* Workflow Guide */}
          <div className="mb-6">
            <WorkflowGuide
              currentView="flow"
              onViewChange={onViewChange || (() => {})}
            />
          </div>

          {/* View Recommendation */}
          {selectedNodeData && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase">
                스마트 추천
              </h4>
              <ViewRecommendation
                selectedEntity={{
                  id: selectedNodeData.id,
                  type: selectedNodeData.type,
                  title: selectedNodeData.title,
                  name: selectedNodeData.title,
                  content: "",
                  connections: selectedNodeData.connections,
                  tags: selectedNodeData.metadata.tags,
                  filePath: selectedNodeData.metadata.filePath
                } as OntologyEntity}
                currentView="flow"
                onViewChange={onViewChange || (() => {})}
              />
            </div>
          )}
        </div>
      )}

      {/* Main Flow Visualization */}
      <div className="flex-1 p-6">
        {/* Layer Filter Tabs */}
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => setSelectedLayer("all")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              selectedLayer === "all"
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                : "border border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            All Layers
          </button>
          {layers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => setSelectedLayer(layer.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                selectedLayer === layer.id
                  ? `bg-gradient-to-r ${layer.color} text-white`
                  : "border border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{layer.icon}</span>
              {layer.name}
            </button>
          ))}
        </div>

        {/* Flow Visualization */}
        <div className="relative h-[calc(100%-4rem)] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50">
          {/* Layer Columns */}
          <div className="flex h-full">
            {layers.map((layer, index) => (
              <div
                key={layer.id}
                className={`flex-1 border-r border-slate-800 p-4 ${
                  selectedLayer !== "all" && selectedLayer !== layer.id ? "opacity-30" : ""
                }`}
              >
                {/* Layer Header */}
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{layer.icon}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200">{layer.name}</h3>
                      <p className="text-xs text-slate-400">{layer.description}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className={`h-1 w-full rounded-full bg-gradient-to-r ${layer.color}`} />
                    <span className="text-xs text-slate-400">
                      {nodesByLayer[layer.id].length} nodes
                    </span>
                  </div>
                </div>

                {/* Nodes in Layer */}
                <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100% - 100px)" }}>
                  {nodesByLayer[layer.id].slice(0, nodesToShowPerLayer[layer.id]).map((node, index) => {
                    // Format the update time for display
                    const formatUpdateTime = (mtime?: number) => {
                      if (!mtime || mtime === 0) return "Not updated";
                      const date = new Date(mtime);
                      const now = new Date();
                      const diffMs = now.getTime() - date.getTime();
                      const diffMins = Math.floor(diffMs / 60000);
                      const diffHours = Math.floor(diffMs / 3600000);
                      const diffDays = Math.floor(diffMs / 86400000);

                      if (diffMins < 1) return "Just now";
                      if (diffMins < 60) return `${diffMins}m ago`;
                      if (diffHours < 24) return `${diffHours}h ago`;
                      if (diffDays < 7) return `${diffDays}d ago`;
                      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
                    };

                    return (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(node.id)}
                        className={`w-full rounded-lg border p-3 text-left transition-all ${
                          selectedNode === node.id
                            ? "border-blue-500 bg-blue-950/20"
                            : "border-slate-800 bg-slate-900/50 hover:bg-slate-800/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-500 flex-shrink-0">
                                #{index + 1}
                              </span>
                              <h4 className="text-sm font-medium text-slate-200 line-clamp-1">
                                {node.title}
                              </h4>
                            </div>
                            {node.metadata.tags && node.metadata.tags.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {node.metadata.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="mt-1 text-xs text-slate-500">
                              {formatUpdateTime(node.metadata.mtime)}
                            </div>
                          </div>
                          {node.status && (
                            <span
                              className={`ml-2 h-2 w-2 rounded-full flex-shrink-0 ${
                                node.status === "active"
                                  ? "bg-green-500"
                                  : node.status === "pending"
                                  ? "bg-yellow-500"
                                  : "bg-slate-500"
                              }`}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {nodesByLayer[layer.id].length > nodesToShowPerLayer[layer.id] && (
                    <button
                      onClick={() => {
                        setNodesToShowPerLayer(prev => ({
                          ...prev,
                          [layer.id]: prev[layer.id] + 10
                        }));
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/50 py-2 text-xs text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all"
                    >
                      ↓ View {Math.min(10, nodesByLayer[layer.id].length - nodesToShowPerLayer[layer.id])} more ({nodesByLayer[layer.id].length - nodesToShowPerLayer[layer.id]} remaining)
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Flow Arrows Overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center">
            <div className="flex w-full justify-around px-32">
              <svg width="100" height="40" className="text-slate-600">
                <path
                  d="M 0 20 L 80 20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
                <path d="M 75 15 L 85 20 L 75 25" fill="currentColor" />
              </svg>
              <svg width="100" height="40" className="text-slate-600">
                <path
                  d="M 0 20 L 80 20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
                <path d="M 75 15 L 85 20 L 75 25" fill="currentColor" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className="w-96 border-l border-slate-800 bg-slate-950/95 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">Node Details</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"
            >
              ✕
            </button>
          </div>
          {(() => {
            const node = flowData.nodes.find((n) => n.id === selectedNode);
            if (!node) return null;

            return (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Title</label>
                  <p className="mt-1 text-sm text-slate-200">{node.title}</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500">Layer</label>
                  <p className="mt-1 text-sm text-slate-200">
                    {layers.find((l) => l.id === node.layer)?.name}
                  </p>
                </div>

                {node.status && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Status</label>
                    <p className="mt-1 text-sm text-slate-200">{node.status}</p>
                  </div>
                )}

                {node.metadata.tags && node.metadata.tags.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Tags</label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {node.metadata.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {node.metadata.mtime && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Last Updated</label>
                    <p className="mt-1 text-sm text-slate-400">
                      {new Date(node.metadata.mtime).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}

                {node.connections.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Connections</label>
                    <p className="mt-1 text-sm text-slate-400">{node.connections.length} linked nodes</p>
                  </div>
                )}

                {node.metadata.filePath && (
                  <div className="pt-4">
                    <ObsidianLinkButton
                      path={node.metadata.filePath}
                      label="Open in Obsidian"
                      variant="default"
                    />
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
