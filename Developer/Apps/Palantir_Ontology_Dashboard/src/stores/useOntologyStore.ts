import { create } from "zustand";
import { obsidianClient, fetchOntologySnapshot } from "../lib/obsidian";
import { logger } from "../lib/logger";

export type OntologyEntityType = string;

export interface OntologyEntity {
  id: string;
  type: OntologyEntityType;
  title: string;
  name?: string; // 선택적: title과 동일한 의미, 없으면 title 사용
  content?: string; // 선택적: 본문 요약 등
  connections?: string[]; // 선택적: 관련 노드 id 목록
  status?: string;
  tags?: string[];
  topics?: string[];
  relatedDecisions?: string[];
  nextActions?: string[];
  owner?: string;
  evidence?: string;
  filePath?: string;
  entityType?: string;
  mtime?: number; // File modification time in milliseconds
  lastModified?: string; // 선택적: ISO 문자열
  layer?: string; // 선택적: 분류 레이어 힌트
}

export interface OntologyDecision {
  id: string;
  title: string;
  context: string;
  dataEvidence?: string;
  decidedAt?: string;
  followUp?: string;
  status?: string;
  filePath?: string;
}

export interface OntologyMetric {
  id: string;
  name: string;
  unit?: string;
  values: Array<{ timestamp: string; value: number }>;
  filePath?: string;
}

export interface OntologyAction {
  id: string;
  sourceEntity: string;
  triggerLogic: string;
  actionOutput: string;
  status?: string;
  filePath?: string;
}

export interface OntologySnapshot {
  generatedAt: string;
  entities: OntologyEntity[];
  decisions: OntologyDecision[];
  metrics: OntologyMetric[];
  actions: OntologyAction[];
}

export interface EntityFilters {
  type: OntologyEntityType | "All";
  status: string | "All";
  tag: string | "All";
  search: string;
}

interface OntologyState {
  loading: boolean;
  error: string | null;
  snapshot: OntologySnapshot | null;
  entities: OntologyEntity[]; // 추가된 속성
  lastUpdated: string | null;
  filters: EntityFilters;
  selectedEntityId: string | null;
  loadOntology: (url: string, options?: { forceRefresh?: boolean }) => Promise<void>;
  setFilter: <K extends keyof EntityFilters>(key: K, value: EntityFilters[K]) => void;
  resetFilters: () => void;
  selectEntity: (id: string | null) => void;
  updateEntity: (id: string, updates: Partial<OntologyEntity>) => void;
  clearCache: () => void;
  getCacheInfo: () => { size: number; keys: string[] };
}

const defaultFilters: EntityFilters = {
  type: "All",
  status: "All",
  tag: "All",
  search: ""
};

const CACHE_BUST_PARAM = "_ts";

function withCacheBust(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${CACHE_BUST_PARAM}=${Date.now()}`;
}

function normalizeEntity(entity: OntologyEntity): OntologyEntity {
  return {
    ...entity,
    name: entity.name ?? entity.title,
    content: entity.content ?? "",
    connections: entity.connections ?? entity.relatedDecisions ?? [],
  };
}

export const useOntologyStore = create<OntologyState>((set) => ({
  loading: false,
  error: null,
  snapshot: null,
  entities: [], // 추가된 초기값
  lastUpdated: null,
  filters: { ...defaultFilters },
  selectedEntityId: null,
  loadOntology: async (url: string, options: { forceRefresh?: boolean } = {}) => {
    const { forceRefresh = false } = options;
    const fallbackUrl = withCacheBust("/data/ontology.json");
    const shouldUseOptimizedClient =
      url === 'sample_fallback' || url.includes('obsidian') || url.includes('127.0.0.1');

    const requestUrl = !shouldUseOptimizedClient && forceRefresh
      ? withCacheBust(url)
      : url;

    logger.info('Loading ontology from:', requestUrl, 'forceRefresh:', forceRefresh);
    set({ loading: true, error: null });
    try {
      // Use optimized client with caching and fallback strategies
      let snapshot = shouldUseOptimizedClient
        ? await obsidianClient.fetchOntologySnapshot({ forceRefresh })
        : await fetchOntologySnapshot(requestUrl);

      if (shouldUseOptimizedClient && (!snapshot.entities || snapshot.entities.length === 0)) {
        console.warn('⚠️ Obsidian API returned empty snapshot, falling back to exported data');
        snapshot = await fetchOntologySnapshot(fallbackUrl);
      }

      logger.info('✅ Ontology loaded successfully:', snapshot);
      const normalizedEntities = snapshot.entities.map(normalizeEntity);
      set({
        loading: false,
        snapshot: { ...snapshot, entities: normalizedEntities },
        entities: normalizedEntities,
        lastUpdated: snapshot.generatedAt,
        error: null
      });
    } catch (error) {
      logger.error('💥 Failed to load ontology:', error);

      if (shouldUseOptimizedClient) {
        try {
          logger.warn('Attempting fallback to local export due to API error');
          const fallbackSnapshot = await fetchOntologySnapshot(fallbackUrl);
          const normalizedFallback = fallbackSnapshot.entities.map(normalizeEntity);
          set({
            loading: false,
            snapshot: { ...fallbackSnapshot, entities: normalizedFallback },
            entities: normalizedFallback,
            lastUpdated: fallbackSnapshot.generatedAt,
            error: null
          });
          return;
        } catch (fallbackError) {
          logger.error('💥 Fallback snapshot load failed:', fallbackError);
        }
      }

      set({
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  },
  setFilter: (key, value) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value
      }
    })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
  selectEntity: (id) => set({ selectedEntityId: id }),
  updateEntity: (id, updates) =>
    set((state) => ({
      entities: state.entities.map((entity) =>
        entity.id === id ? { ...entity, ...updates } : entity
      ),
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            entities: state.snapshot.entities.map((entity) =>
              entity.id === id ? { ...entity, ...updates } : entity
            )
          }
        : null
    })),
  clearCache: () => {
    obsidianClient.clearCache();
    logger.info('🗑️ Ontology cache cleared');
  },
  getCacheInfo: () => obsidianClient.getCacheInfo()
}));
