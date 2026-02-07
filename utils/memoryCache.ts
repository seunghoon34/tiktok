import { cache, CacheItem } from './cache';

/**
 * Hybrid Memory + Disk Cache
 * - Fast in-memory cache for hot data
 * - AsyncStorage backup for persistence
 * - LRU eviction to prevent memory bloat
 */

interface MemoryCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export class HybridCacheService {
  private static instance: HybridCacheService;
  private memoryCache: Map<string, MemoryCacheEntry<any>>;
  private maxMemoryEntries: number;
  
  public static getInstance(): HybridCacheService {
    if (!HybridCacheService.instance) {
      HybridCacheService.instance = new HybridCacheService();
    }
    return HybridCacheService.instance;
  }

  private constructor() {
    this.memoryCache = new Map();
    this.maxMemoryEntries = 100; // Limit memory cache to 100 entries
  }

  /**
   * Store data in both memory and disk cache
   */
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    const now = Date.now();
    
    // Store in memory cache
    this.memoryCache.set(key, {
      data,
      timestamp: now,
      ttl,
      accessCount: 0,
      lastAccessed: now
    });
    
    // Evict old entries if memory cache is full
    this.evictIfNeeded();
    
    // Store in disk cache (async, don't wait)
    cache.set(key, data, ttl).catch(error => {
      console.error('[HybridCache] Error writing to disk:', error);
    });
    
    console.log(`[HybridCache] Stored in memory: ${key}`);
  }

  /**
   * Get data from memory first, fallback to disk
   */
  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();
    
    // Try memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      // Check if expired
      if (memEntry.ttl > 0 && (now - memEntry.timestamp) > memEntry.ttl) {
        console.log(`[HybridCache] Memory expired: ${key}`);
        this.memoryCache.delete(key);
        await cache.delete(key);
        return null;
      }
      
      // Update access stats
      memEntry.accessCount++;
      memEntry.lastAccessed = now;
      
      console.log(`[HybridCache] Memory hit: ${key} (${memEntry.accessCount} accesses)`);
      return memEntry.data as T;
    }
    
    // Fallback to disk cache
    console.log(`[HybridCache] Memory miss, checking disk: ${key}`);
    const diskData = await cache.get<T>(key);
    
    if (diskData) {
      // Populate memory cache from disk
      this.memoryCache.set(key, {
        data: diskData,
        timestamp: now,
        ttl: 3600000, // Default 1 hour for disk-loaded items
        accessCount: 1,
        lastAccessed: now
      });
      console.log(`[HybridCache] Loaded from disk to memory: ${key}`);
      return diskData;
    }
    
    console.log(`[HybridCache] Complete miss: ${key}`);
    return null;
  }

  /**
   * Delete from both memory and disk
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await cache.delete(key);
    console.log(`[HybridCache] Deleted: ${key}`);
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    this.memoryCache.clear();
    await cache.clearAll();
    console.log('[HybridCache] Cleared all caches');
  }

  /**
   * Evict least recently used entries when memory is full
   */
  private evictIfNeeded(): void {
    if (this.memoryCache.size <= this.maxMemoryEntries) {
      return;
    }

    // Find least recently used entry
    let oldestKey: string | null = null;
    let oldestAccess = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      console.log(`[HybridCache] Evicted LRU entry: ${oldestKey}`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memoryEntries: number;
    memorySize: string;
    hitRate: string;
    topAccessed: Array<{ key: string; hits: number }>;
  } {
    let totalAccesses = 0;
    const entries = Array.from(this.memoryCache.entries());
    
    entries.forEach(([_, entry]) => {
      totalAccesses += entry.accessCount;
    });

    // Get top 5 most accessed keys
    const topAccessed = entries
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, 5)
      .map(([key, entry]) => ({
        key: key.split(':').pop() || key,
        hits: entry.accessCount
      }));

    // Estimate memory size (rough calculation)
    let estimatedSize = 0;
    entries.forEach(([key, entry]) => {
      estimatedSize += key.length + JSON.stringify(entry.data).length;
    });

    return {
      memoryEntries: this.memoryCache.size,
      memorySize: `${(estimatedSize / 1024).toFixed(2)} KB`,
      hitRate: totalAccesses > 0 ? `${((totalAccesses / (totalAccesses + 1)) * 100).toFixed(1)}%` : '0%',
      topAccessed
    };
  }

  /**
   * Manually prune expired entries from memory
   */
  pruneExpired(): number {
    const now = Date.now();
    let prunedCount = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.ttl > 0 && (now - entry.timestamp) > entry.ttl) {
        this.memoryCache.delete(key);
        prunedCount++;
      }
    }

    if (prunedCount > 0) {
      console.log(`[HybridCache] Pruned ${prunedCount} expired entries from memory`);
    }

    return prunedCount;
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmup(keys: string[]): Promise<void> {
    console.log(`[HybridCache] Warming up ${keys.length} cache entries...`);
    
    const promises = keys.map(key => this.get(key));
    await Promise.all(promises);
    
    console.log('[HybridCache] Warmup complete');
  }

  /**
   * Set max memory entries (useful for devices with limited RAM)
   */
  setMaxMemoryEntries(max: number): void {
    this.maxMemoryEntries = max;
    this.evictIfNeeded();
    console.log(`[HybridCache] Max memory entries set to: ${max}`);
  }

  /**
   * Check if key exists in memory (synchronous, very fast)
   */
  hasInMemory(key: string): boolean {
    return this.memoryCache.has(key);
  }

  /**
   * Get data from memory only (no disk fallback, synchronous)
   */
  getFromMemorySync(key: string): any | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (entry.ttl > 0 && (now - entry.timestamp) > entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = now;
    return entry.data;
  }
}

// Export singleton instance
export const hybridCache = HybridCacheService.getInstance();

// Helper function to migrate from old cache to hybrid cache
export async function migrateToHybridCache(): Promise<void> {
  console.log('[HybridCache] Migration not needed - hybrid cache is backward compatible');
}
