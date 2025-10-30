import sampleSnapshot from "../data/sampleSnapshot.json";
import { logger } from "./logger";
import type { OntologySnapshot } from "../stores/useOntologyStore";

// Optimized Obsidian integration with caching, error handling, and performance improvements
interface CacheEntry {
  data: OntologySnapshot;
  timestamp: number;
  ttl: number;
}

interface ObsidianConfig {
  apiKey?: string;
  apiUrl?: string;
  cacheTTL?: number;
  retryAttempts?: number;
  timeout?: number;
}

interface FetchOptions {
  forceRefresh?: boolean;
}

class OptimizedObsidianClient {
  private cache = new Map<string, CacheEntry>();
  private config: Required<ObsidianConfig>;

  constructor(config: ObsidianConfig = {}) {
    this.config = {
      apiKey: config.apiKey || import.meta.env.VITE_OBSIDIAN_API_KEY || '',
      apiUrl: config.apiUrl || import.meta.env.VITE_OBSIDIAN_API_URL || 'https://127.0.0.1:27124',
      cacheTTL: config.cacheTTL || 5 * 60 * 1000, // 5 minutes
      retryAttempts: config.retryAttempts || 3,
      timeout: config.timeout || 10000 // 10 seconds
    };
  }

  async fetchOntologySnapshot(options: FetchOptions = {}): Promise<OntologySnapshot> {
    const { forceRefresh = false } = options;
    const cacheKey = 'ontology-snapshot';

    // Check cache first
    if (!forceRefresh) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.info('📦 Using cached ontology data');
        return cached;
      }
    } else {
      this.cache.delete(cacheKey);
      logger.info('🔄 Force refresh requested, bypassing cache');
    }

    try {
      // Try API first
      const snapshot = await this.fetchFromAPI();
      this.setCache(cacheKey, snapshot);
      return snapshot;
    } catch (apiError) {
      logger.warn('🚨 API fetch failed, trying file export:', apiError);

      try {
        // Fallback to file export
        const snapshot = await this.fetchFromFileExport();
        this.setCache(cacheKey, snapshot);
        return snapshot;
      } catch (fileError) {
        logger.error('💥 Both API and file export failed:', fileError);

        // Final fallback to sample data
        return this.getFallbackData();
      }
    }
  }

  private async fetchFromAPI(): Promise<OntologySnapshot> {
    if (!this.config.apiKey) {
      throw new Error('API key not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      // Test connection first
      await this.testConnection();

      // Fetch data with optimized approach
      const snapshot = await this.fetchOptimizedSnapshot();
      clearTimeout(timeoutId);

      logger.info('✅ Successfully fetched from Obsidian API');
      return snapshot;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    // Use Vite proxy to test connection
    const response = await this.retryFetch('/obsidian-api/', {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Connection test failed: ${response.status}`);
    }
  }

  private async fetchOptimizedSnapshot(): Promise<OntologySnapshot> {
    // Parallel fetch for better performance
    const [semanticData, kineticData, dynamicData] = await Promise.allSettled([
      this.fetchLayerData('1_SEMANTIC_LAYER'),
      this.fetchLayerData('2_KINETIC_LAYER'),
      this.fetchLayerData('3_DYNAMIC_LAYER')
    ]);

    const entities = [
      ...this.processLayerResult(semanticData, 'semantic'),
      ...this.processLayerResult(kineticData, 'kinetic'),
      ...this.processLayerResult(dynamicData, 'dynamic')
    ];

    return {
      generatedAt: new Date().toISOString(),
      entities,
      decisions: this.extractDecisions(entities),
      metrics: this.extractMetrics(entities),
      actions: this.extractActions(entities)
    };
  }

  private async fetchLayerData(layer: string) {
    // Use Vite proxy to avoid CORS and SSL issues
    // Proxy: /obsidian-api -> https://127.0.0.1:27124
    const endpoint = `/obsidian-api/vault/${layer}/`;
    const response = await this.retryFetch(endpoint, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${layer}: ${response.status}`);
    }

    return response.json();
  }

  private processLayerResult(result: PromiseSettledResult<any>, layerType: string) {
    if (result.status === 'rejected') {
      logger.warn(`❌ Failed to fetch ${layerType} layer:`, result.reason);
      return [];
    }

    const data = result.value;
    const files = Array.isArray(data) ? data : (data.files || data.children || []);

    return files
      .filter((file: any) => file.name?.endsWith('.md'))
      .map((file: any) => this.createOptimizedEntity(file, layerType));
  }

  private createOptimizedEntity(file: any, layer: string) {
    // Parse mtime from file - could be timestamp or ISO string
    let mtime = 0;
    if (typeof file.mtime === 'number') {
      // If it's already a number (milliseconds), use it
      mtime = file.mtime;
    } else if (file.mtime && typeof file.mtime === 'string') {
      // If it's an ISO string, convert to milliseconds
      mtime = new Date(file.mtime).getTime();
    } else if (file.stat?.mtime) {
      // Some Obsidian API responses use stat.mtime
      mtime = typeof file.stat.mtime === 'number'
        ? file.stat.mtime
        : new Date(file.stat.mtime).getTime();
    } else {
      // Fallback: use current time if no mtime is provided
      mtime = Date.now();
    }

    return {
      id: this.generateId(file.path || file.name),
      title: this.extractTitle(file.name),
      type: this.determineEntityType(file.name, layer),
      filePath: file.path || file.name,
      status: 'active',
      tags: this.extractTags(file.name),
      topics: this.extractTopics(file.name, layer),
      relatedDecisions: [],
      nextActions: this.extractNextActions(file.name),
      evidence: null,
      layer,
      lastModified: file.mtime || new Date().toISOString(),
      mtime // Add the mtime in milliseconds for sorting
    };
  }

  private async fetchFromFileExport(): Promise<OntologySnapshot> {
    // Try to load from the exported JSON file
    const response = await fetch('/data/ontology.json', {
      cache: 'no-cache',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`File export not found: ${response.status}`);
    }

    const data = await response.json();
    logger.info('📁 Loaded from file export');
    return data;
  }

  private getFallbackData(): OntologySnapshot {
    logger.info('🔄 Using fallback sample data');
    return sampleSnapshot as OntologySnapshot;
  }

  private async retryFetch(url: string, options: RequestInit): Promise<Response> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(this.config.timeout)
        });

        if (response.ok) {
          return response;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.retryAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.info(`🔄 Retry ${attempt}/${this.config.retryAttempts} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private getHeaders(): HeadersInit {
    return {
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Cache-Control': 'no-cache'
    };
  }

  private getFromCache(key: string): OntologySnapshot | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: OntologySnapshot): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL
    });
  }

  private extractDecisions(entities: any[]) {
    return entities
      .filter(e => e.type.includes('의사결정') || e.filePath.includes('decisions'))
      .map(e => ({
        id: e.id,
        title: e.title,
        context: '',
        dataEvidence: e.evidence,
        decidedAt: e.lastModified,
        followUp: '',
        status: e.status,
        filePath: e.filePath
      }));
  }

  private extractMetrics(entities: any[]) {
    return entities
      .filter(e => e.type.includes('지표') || e.filePath.includes('metrics'))
      .map(e => ({
        id: e.id,
        name: e.title,
        unit: '',
        values: [],
        filePath: e.filePath
      }));
  }

  private extractActions(entities: any[]) {
    return entities
      .filter(e => e.type.includes('자동화') || e.filePath.includes('actions'))
      .map(e => ({
        id: e.id,
        sourceEntity: e.title,
        triggerLogic: '',
        actionOutput: '',
        status: e.status,
        filePath: e.filePath
      }));
  }

  // Utility methods
  private generateId(path: string): string {
    return path?.replace(/[^a-zA-Z0-9]/g, '_') || `entity_${Date.now()}`;
  }

  private extractTitle(fileName: string): string {
    return fileName?.replace('.md', '') || 'Unknown';
  }

  private determineEntityType(fileName: string, layer: string): string {
    const name = fileName.toLowerCase();

    if (name.includes('index')) return '🗂️ 인덱스';
    if (name.includes('개념') || name.includes('concept')) return '📚 개념노트';
    if (name.includes('workflow') || name.includes('action')) return '🔗 워크플로우';
    if (name.includes('decision') || name.includes('결정')) return '🎯 의사결정';
    if (name.includes('metric') || name.includes('지표')) return '📊 지표';

    switch (layer) {
      case 'semantic': return '📚 개념노트';
      case 'kinetic': return '🔗 워크플로우';
      case 'dynamic': return '🎯 의사결정';
      default: return '📄 문서';
    }
  }

  private extractTags(fileName: string): string[] {
    const tags = [];
    const name = fileName.toLowerCase();

    if (name.includes('ai')) tags.push('#AI');
    if (name.includes('투자') || name.includes('invest')) tags.push('#투자');
    if (name.includes('기도') || name.includes('prayer') || name.includes('영성')) tags.push('#영성');
    if (name.includes('코드') || name.includes('code')) tags.push('#개발');

    return tags;
  }

  private extractTopics(fileName: string, layer: string): string[] {
    const topics = [];

    topics.push(layer); // Add layer as topic

    const name = fileName.toLowerCase();
    if (name.includes('brain')) topics.push('BRAIN시스템');
    if (name.includes('ontology')) topics.push('온톨로지');

    return topics;
  }

  private extractNextActions(fileName: string): string[] {
    // Extract potential next actions based on file name patterns
    const actions = [];
    const name = fileName.toLowerCase();

    if (name.includes('draft') || name.includes('초안')) {
      actions.push('검토 및 완성');
    }
    if (name.includes('todo') || name.includes('할일')) {
      actions.push('실행');
    }

    return actions;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for configuration
  updateConfig(newConfig: Partial<ObsidianConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('🗑️ Cache cleared');
  }

  getCacheInfo(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
export const obsidianClient = new OptimizedObsidianClient();

export async function fetchOntologySnapshot(url: string): Promise<OntologySnapshot> {
  try {
    // If using optimized client or Obsidian API, use the optimized client
    if (url === 'sample_fallback' || url.includes('127.0.0.1:27124') || url.includes('obsidian-api')) {
      return await obsidianClient.fetchOntologySnapshot();
    }

    // Original fetch for static JSON files
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Failed to fetch ontology: ${response.status}`);
    }

    const data = (await response.json()) as Partial<OntologySnapshot>;

    if (!data.generatedAt || !data.entities || !data.decisions || !data.metrics || !data.actions) {
      throw new Error("Snapshot schema invalid. 필수 필드가 누락되었습니다.");
    }

    return data as OntologySnapshot;
  } catch (error) {
    logger.warn("Primary snapshot fetch failed, fallback to bundled sample.", error);
    return sampleSnapshot as OntologySnapshot;
  }
}

// Legacy fetchFromObsidianAPI - now uses optimized client internally
async function fetchFromObsidianAPI(baseUrl: string, options: FetchOptions = {}): Promise<OntologySnapshot> {
  logger.info('🔄 Legacy fetchFromObsidianAPI called, using optimized client');

  // Update the optimized client configuration if needed
  if (baseUrl) {
    obsidianClient.updateConfig({ apiUrl: baseUrl });
  }

  // Use the optimized client
  return await obsidianClient.fetchOntologySnapshot(options);
}

// Legacy functions - kept for compatibility but simplified

export interface DataviewRow {
  file: { name: string; path: string; ctime: string; mtime: string };
  [key: string]: unknown;
}

export interface DataviewExportOptions {
  includeMetrics?: boolean;
  includeActions?: boolean;
}

export interface OntologyExportPayload {
  generatedAt: string;
  entities: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
  metrics: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
}

export function buildSnapshotPayload(
  entities: DataviewRow[],
  decisions: DataviewRow[],
  metrics: DataviewRow[],
  actions: DataviewRow[],
  options: DataviewExportOptions = {}
): OntologyExportPayload {
  return {
    generatedAt: new Date().toISOString(),
    entities: entities.map(normalizeRow),
    decisions: decisions.map(normalizeRow),
    metrics: options.includeMetrics ? metrics.map(normalizeRow) : [],
    actions: options.includeActions ? actions.map(normalizeRow) : []
  };
}

function normalizeRow(row: DataviewRow): Record<string, unknown> {
  const { file, ...rest } = row;
  return {
    id: String(rest.id ?? file.path ?? cryptoRandomId()),
    title: String(rest.title ?? file.name),
    ...rest,
    file
  };
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}
