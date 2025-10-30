import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { logger } from "./lib/logger";
import { NavigationSidebar } from "./components/NavigationSidebar";
import { OntologyFlowView } from "./components/OntologyFlowView";
import { KnowledgeGraphView } from "./components/KnowledgeGraphView";
import { TimelineView } from "./components/TimelineView";
import { AnalyticsView } from "./components/AnalyticsView";
import { DataIntegrationPanel } from "./components/DataIntegrationPanel";
import { WorkspaceManager } from "./components/WorkspaceManager";
import { QuickActionBar } from "./components/QuickActionBar";
import { NotificationCenter } from "./components/NotificationCenter";
import { SearchCommand } from "./components/SearchCommand";
import { DashboardHeader } from "./components/DashboardHeader";
import { AIAssistant } from "./components/AIAssistant";
import { HelpGuide } from "./components/HelpGuide";
import { OnboardingTour } from "./components/OnboardingTour";
import { useOntologyStore, OntologyEntity } from "./stores/useOntologyStore";
import { calculateLayerDistribution } from "./utils/layerClassification";

// Use exported ontology.json file (real Obsidian data)
// This file is generated from Obsidian vault via exportOntology.mjs script
const DATA_URL = import.meta.env.VITE_ONTOLOGY_DATA_URL ?? "/obsidian-api";
const AUTO_REFRESH_ENABLED_KEY = "autoRefreshEnabled.v2";
const AUTO_REFRESH_INTERVAL_KEY = "autoRefreshInterval";

export type ViewMode = "flow" | "graph" | "table" | "kanban" | "timeline" | "analytics";

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("flow");
  const [selectedEntity, setSelectedEntity] = useState<OntologyEntity | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Auto-refresh settings with localStorage persistence
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => {
    const saved = localStorage.getItem(AUTO_REFRESH_ENABLED_KEY);
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [autoRefreshInterval, setAutoRefreshInterval] = useState(() => {
    const saved = localStorage.getItem(AUTO_REFRESH_INTERVAL_KEY);
    return saved ? parseInt(saved, 10) : 30000; // 30 seconds default
  });

  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInFlightRef = useRef(false);

  const handleViewChange = (newView: ViewMode) => {
    setViewMode(newView);
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // 첫 방문 시 온보딩 표시
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboardingTour");
    if (!hasSeenOnboarding) {
      setTimeout(() => setShowOnboarding(true), 500);
    }
  }, []);

  useEffect(() => {
    localStorage.removeItem("autoRefreshEnabled");
  }, []);

  // Save auto-refresh settings to localStorage
  useEffect(() => {
    localStorage.setItem(AUTO_REFRESH_ENABLED_KEY, JSON.stringify(autoRefreshEnabled));
  }, [autoRefreshEnabled]);

  useEffect(() => {
    localStorage.setItem(AUTO_REFRESH_INTERVAL_KEY, autoRefreshInterval.toString());
  }, [autoRefreshInterval]);

  const handleOpenSearch = () => {
    setSearchOpen(true);
  };

  const loadOntology = useOntologyStore((state) => state.loadOntology);
  const loading = useOntologyStore((state) => state.loading);
  const error = useOntologyStore((state) => state.error);
  const snapshot = useOntologyStore((state) => state.snapshot);

  const refreshOntology = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    setIsRefreshing(true);
    try {
      await loadOntology(DATA_URL, { forceRefresh: true });
      setLastRefreshTime(new Date().toLocaleTimeString());
    } catch (err) {
      logger.error("Failed to refresh ontology:", err);
    } finally {
      refreshInFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [loadOntology]);

  // Initial load
  useEffect(() => {
    refreshOntology();
  }, [refreshOntology]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    refreshOntology();

    const interval = setInterval(() => {
      refreshOntology();
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, autoRefreshInterval, refreshOntology]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      // Cmd/Ctrl + B for sidebar toggle
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
      // View mode shortcuts (1-6)
      if (e.altKey && e.key >= "1" && e.key <= "6") {
        const modes: ViewMode[] = ["flow", "graph", "table", "kanban", "timeline", "analytics"];
        const index = parseInt(e.key) - 1;
        if (modes[index]) {
          handleViewChange(modes[index]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const stats = useMemo(() => {
    logger.debug('Calculating stats, snapshot:', snapshot);
    if (!snapshot) {
      logger.debug('No snapshot available, returning zero stats');
      return { semantic: 0, kinetic: 0, dynamic: 0, total: 0 };
    }
    logger.debug('Snapshot entities:', snapshot.entities);
    const distribution = calculateLayerDistribution(snapshot.entities);
    logger.debug('Layer distribution calculated:', distribution);
    return distribution;
  }, [snapshot]);

  const renderMainView = () => {
    switch (viewMode) {
      case "flow":
        return (
          <OntologyFlowView
            onEntitySelect={setSelectedEntity}
            onViewChange={handleViewChange}
          />
        );
      case "graph":
        return <KnowledgeGraphView onEntitySelect={setSelectedEntity} />;
      case "table":
        return <DataIntegrationPanel onEntitySelect={setSelectedEntity} />;
      case "kanban":
        return <WorkspaceManager />;
      case "timeline":
        return <TimelineView />;
      case "analytics":
        return <AnalyticsView />;
      default:
        return <OntologyFlowView onEntitySelect={setSelectedEntity} />;
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="rounded-xl border border-red-900 bg-red-950/20 p-8 text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h2 className="mb-2 text-xl font-semibold text-red-300">Failed to Load Ontology</h2>
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={refreshOntology}
            className="mt-4 rounded-lg bg-red-900 px-4 py-2 text-sm text-white hover:bg-red-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar Navigation */}
      <NavigationSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        currentView={viewMode}
        onViewChange={handleViewChange}
        stats={stats}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <DashboardHeader
          viewMode={viewMode}
          onViewChange={handleViewChange}
          onSearchOpen={handleOpenSearch}
          autoRefreshEnabled={autoRefreshEnabled}
          onAutoRefreshToggle={setAutoRefreshEnabled}
          autoRefreshInterval={autoRefreshInterval}
          onAutoRefreshIntervalChange={setAutoRefreshInterval}
          isRefreshing={isRefreshing}
          lastRefreshTime={lastRefreshTime}
          onManualRefresh={refreshOntology}
        />

        {/* Quick Action Bar */}
        <QuickActionBar
          onViewChange={handleViewChange}
          onOpenSearch={handleOpenSearch}
        />

        {/* Main View */}
        <main className="flex-1 overflow-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500"></div>
                <p className="text-sm text-slate-400">Loading Ontology...</p>
              </div>
            </div>
          ) : (
            <div className="h-full">{renderMainView()}</div>
          )}
        </main>
      </div>

      {/* Notification Center */}
      <NotificationCenter />

      {/* AI Assistant */}
      <AIAssistant />

      {/* Help Guide */}
      <HelpGuide />

      {/* Command Palette */}
      {searchOpen && (
        <SearchCommand
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* Onboarding Tour */}
      <OnboardingTour
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  );
}

export default App;
