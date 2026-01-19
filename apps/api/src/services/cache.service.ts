import fs from 'fs/promises';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'data', 'search-cache.json');

export interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

export class FileCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private isLoaded = false;

  async load() {
    try {
      await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
      const content = await fs.readFile(CACHE_FILE, 'utf-8');
      const json = JSON.parse(content);
      this.cache = new Map(Object.entries(json));
      console.log(`[Cache] Loaded ${this.cache.size} entries from disk.`);
    } catch (error) {
        if ((error as any).code !== 'ENOENT') {
            console.warn('[Cache] Failed to load cache from disk:', error);
        }
      this.cache = new Map();
    }
    this.isLoaded = true;
  }

  async save() {
    try {
      const obj = Object.fromEntries(this.cache);
      await fs.writeFile(CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
      console.log('[Cache] Persisted to disk.');
    } catch (error) {
      console.error('[Cache] Failed to save cache:', error);
    }
  }

  get<T>(key: string): CacheEntry<T> | undefined {
    return this.cache.get(key);
  }

  set<T>(key: string, data: T) {
    this.cache.set(key, { timestamp: Date.now(), data });
    // Auto-save on set (could be throttled in production)
    this.save(); 
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  // Helper to check validity based on TTL
  isValid(key: string, ttlMs: number): boolean {
      const entry = this.get(key);
      if (!entry) return false;
      return (Date.now() - entry.timestamp) < ttlMs;
  }
}

export const fileCache = new FileCacheService();
