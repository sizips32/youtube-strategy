import { useState } from "react";
import type { ViewMode } from "../App";
import { LAYER_COLORS, BRAND_COLORS } from "../utils/layerClassification";
import { logger } from "../lib/logger";

interface QuickActionBarProps {
  onViewChange?: (view: ViewMode) => void;
  onOpenSearch?: () => void;
}

export function QuickActionBar({ onViewChange, onOpenSearch }: QuickActionBarProps = {}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const vaultName = import.meta.env.VITE_OBSIDIAN_VAULT || "MyObsidianVault";
  const inboxFolder = import.meta.env.VITE_OBSIDIAN_INBOX_FOLDER || "0_INBOX";
  const dailyTemplatePath =
    import.meta.env.VITE_OBSIDIAN_DAILY_TEMPLATE || "Workflows/templates/Daily_Note_Template.md";
  const workflowTemplatePath =
    import.meta.env.VITE_OBSIDIAN_WORKFLOW_TEMPLATE ||
    "Workflows/templates/Template_Ontology_Knowledge_Graph.md";
  const templatePath =
    import.meta.env.VITE_OBSIDIAN_DEFAULT_TEMPLATE ||
    "Workflows/templates/Template_SMART Goal Generation.md";

  const encodedVault = encodeURIComponent(vaultName);

  const openObsidianUri = (uri: string) => {
    if (typeof window === "undefined") {
      logger.warn("Obsidian URI requires browser context", uri);
      return false;
    }

    const win = window.open(uri);

    if (!win) {
      logger.warn("Popup blocked or Obsidian URI handler unavailable", uri);
      return false;
    }

    return true;
  };

  const handleQuickCapture = () => {
    const timestamp = new Date().toISOString().replace(/[:]/g, "-");
    const fileName = `${inboxFolder}/Quick_Capture_${timestamp}.md`;
    const uri = `obsidian://new?vault=${encodedVault}&file=${encodeURIComponent(fileName)}`;
    openObsidianUri(uri);
  };

  const handleDailyNote = () => {
    const periodicNotesUri = `obsidian://advanced-uri?vault=${encodedVault}&commandid=periodic-notes%253Aopen-daily-note`;
    const fallbackUri = `obsidian://open?vault=${encodedVault}&file=${encodeURIComponent(dailyTemplatePath)}`;

    if (!openObsidianUri(periodicNotesUri)) {
      openObsidianUri(fallbackUri);
    }
  };

  const handleSearch = () => {
    if (onOpenSearch) {
      onOpenSearch();
    } else {
      logger.warn("Search command handler not provided");
    }
  };

  const handleWorkflow = () => {
    onViewChange?.("kanban");
    const uri = `obsidian://open?vault=${encodedVault}&file=${encodeURIComponent(workflowTemplatePath)}`;
    openObsidianUri(uri);
  };

  const handleLinkNodes = () => {
    onViewChange?.("graph");
    const uri = `obsidian://open?vault=${encodedVault}&file=${encodeURIComponent("Workflows/templates/Template_Ontology_Knowledge_Graph.md")}`;
    openObsidianUri(uri);
  };

  const handleApplyTemplate = () => {
    const uri = `obsidian://open?vault=${encodedVault}&file=${encodeURIComponent(templatePath)}`;
    openObsidianUri(uri);
  };

  const quickActions = [
    {
      id: "capture",
      label: "Quick Capture",
      icon: "📝",
      shortcut: "⌘⇧N",
      action: handleQuickCapture,
      color: LAYER_COLORS.semantic.gradient
    },
    {
      id: "daily",
      label: "Today's Note",
      icon: "📅",
      shortcut: "⌘T",
      action: handleDailyNote,
      color: BRAND_COLORS.accent
    },
    {
      id: "search",
      label: "Search Vault",
      icon: "🔍",
      shortcut: "⌘⇧F",
      action: handleSearch,
      color: LAYER_COLORS.kinetic.gradient
    },
    {
      id: "workflow",
      label: "New Workflow",
      icon: "⚡",
      shortcut: "⌘W",
      action: handleWorkflow,
      color: LAYER_COLORS.dynamic.gradient
    },
    {
      id: "connect",
      label: "Link Nodes",
      icon: "🔗",
      shortcut: "⌘L",
      action: handleLinkNodes,
      color: "from-pink-500 to-pink-600"
    },
    {
      id: "template",
      label: "Apply Template",
      icon: "📋",
      shortcut: "⌘⇧T",
      action: handleApplyTemplate,
      color: "from-indigo-500 to-indigo-600"
    }
  ];

  const recentActivities = [
    { type: "created", target: "AI Investment Analysis", time: "2 min ago", icon: "📝" },
    { type: "updated", target: "BRAIN Dashboard", time: "15 min ago", icon: "✏️" },
    { type: "linked", target: "Spiritual Growth → Daily Practice", time: "1 hr ago", icon: "🔗" },
    { type: "completed", target: "Weekly Review", time: "3 hr ago", icon: "✅" }
  ];

  return (
    <div className="border-b border-slate-800 bg-slate-950/50 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <span className="mr-2 text-xs font-semibold uppercase text-slate-500">
            Quick Actions
          </span>
          {quickActions.slice(0, isExpanded ? 6 : 4).map((action) => (
            <button
              key={action.id}
              onClick={action.action}
              className="group relative flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-sm transition-all hover:border-slate-700 hover:bg-slate-800/50"
              title={`${action.label} (${action.shortcut})`}
              aria-label={action.label}
            >
              <span className="text-base">{action.icon}</span>
              <span className="text-slate-300">{action.label}</span>
              <kbd className="ml-2 hidden rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-500 group-hover:block">
                {action.shortcut}
              </kbd>
            </button>
          ))}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
            aria-label={isExpanded ? "Show less quick actions" : "Show more quick actions"}
          >
            {isExpanded ? "Show Less" : "More..."}
          </button>
        </div>

        {/* Recent Activity Ticker */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold uppercase">Recent</span>
            <div className="flex items-center gap-3">
              {recentActivities.slice(0, 2).map((activity, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <span>{activity.icon}</span>
                  <span className="text-slate-400">{activity.target}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-600">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Actions */}
      {isExpanded && (
        <div className="mt-3 grid grid-cols-6 gap-2 border-t border-slate-800 pt-3">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={action.action}
              className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${action.color} p-4 text-white shadow-lg transition-all hover:scale-105`}
              aria-label={action.label}
            >
              <div className="relative z-10">
                <div className="mb-2 text-3xl">{action.icon}</div>
                <div className="text-sm font-medium">{action.label}</div>
                <div className="mt-1 text-xs opacity-80">{action.shortcut}</div>
              </div>
              <div className="absolute inset-0 bg-black opacity-0 transition-opacity group-hover:opacity-10" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
