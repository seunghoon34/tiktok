import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class CacheService {
  private static instance: CacheService;
  
  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private constructor() {}

  // Cache keys for different data types
  static readonly KEYS = {
    PROFILES: 'cache:profiles',
    CHAT_HISTORY: 'cache:chat_history',
    NOTIFICATIONS: 'cache:notifications', 
    MEDIA_URLS: 'cache:media_urls',
    USER_METADATA: 'cache:user_metadata',
    FEED_DATA: 'cache:feed_data'
  } as const;

  // TTL constants (in milliseconds)
  static readonly TTL = {
    PROFILES: 5 * 60 * 1000,             // 5 minutes
    CHAT_HISTORY: 0,                    // Never expire (persist forever)
    NOTIFICATIONS: 60 * 60 * 1000,      // 1 hour
    MEDIA_URLS: 20 * 60 * 60 * 1000,   // 20 hours
    USER_METADATA: 24 * 60 * 60 * 1000, // 24 hours
    FEED_DATA: 30 * 60 * 1000          // 30 minutes
  } as const;

  /**
   * Store data in cache with TTL
   */
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(cacheItem));
      console.log(`[Cache] Stored: ${key}`);
    } catch (error) {
      console.error(`[Cache] Error storing ${key}:`, error);
    }
  }

  /**
   * Get data from cache, returns null if expired or not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) {
        console.log(`[Cache] Miss: ${key}`);
        return null;
      }

      const cacheItem: CacheItem<T> = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache item has expired (ttl = 0 means never expire)
      if (cacheItem.ttl > 0 && (now - cacheItem.timestamp) > cacheItem.ttl) {
        console.log(`[Cache] Expired: ${key}`);
        await this.delete(key);
        return null;
      }

      console.log(`[Cache] Hit: ${key}`);
      return cacheItem.data;
    } catch (error) {
      console.error(`[Cache] Error reading ${key}:`, error);
      return null;
    }
  }

  /**
   * Get data from cache with metadata (TTL, timestamp)
   */
  async getWithMeta<T>(key: string): Promise<CacheItem<T> | null> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const cacheItem: CacheItem<T> = JSON.parse(cached);
      const now = Date.now();

      if (cacheItem.ttl > 0 && (now - cacheItem.timestamp) > cacheItem.ttl) {
        await this.delete(key);
        return null;
      }

      return cacheItem;
    } catch (error) {
      console.error(`[Cache] Error reading meta ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete specific cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
      console.log(`[Cache] Deleted: ${key}`);
    } catch (error) {
      console.error(`[Cache] Error deleting ${key}:`, error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache:'));
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`[Cache] Cleared ${cacheKeys.length} cache entries`);
    } catch (error) {
      console.error('[Cache] Error clearing cache:', error);
    }
  }

  /**
   * Clean up expired cache entries (run on app start)
   */
  async cleanup(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache:'));
      
      let cleanedCount = 0;
      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          try {
            const cacheItem: CacheItem<any> = JSON.parse(cached);
            const now = Date.now();
            
            // Remove if expired (ttl = 0 means never expire)
            if (cacheItem.ttl > 0 && (now - cacheItem.timestamp) > cacheItem.ttl) {
              await AsyncStorage.removeItem(key);
              cleanedCount++;
            }
          } catch (parseError) {
            // Remove corrupted cache entries
            await AsyncStorage.removeItem(key);
            cleanedCount++;
          }
        }
      }
      
      console.log(`[Cache] Cleanup completed: removed ${cleanedCount} expired entries`);
    } catch (error) {
      console.error('[Cache] Error during cleanup:', error);
    }
  }

  /**
   * Get cache statistics for debugging
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    entriesByType: Record<string, number>;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache:'));
      
      let totalSize = 0;
      const entriesByType: Record<string, number> = {};
      
      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          totalSize += cached.length;
          
          // Extract cache type from key (e.g., 'cache:profiles' -> 'profiles')
          const type = key.split(':')[1] || 'unknown';
          entriesByType[type] = (entriesByType[type] || 0) + 1;
        }
      }
      
      return {
        totalEntries: cacheKeys.length,
        totalSize: Math.round(totalSize / 1024), // Size in KB
        entriesByType
      };
    } catch (error) {
      console.error('[Cache] Error getting stats:', error);
      return { totalEntries: 0, totalSize: 0, entriesByType: {} };
    }
  }

  /**
   * Clear cache every 24 hours (call this on app start)
   */
  async performDailyCleanup(): Promise<void> {
    const DAILY_CLEANUP_KEY = 'cache:last_daily_cleanup';
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    try {
      const lastCleanup = await AsyncStorage.getItem(DAILY_CLEANUP_KEY);
      const lastCleanupTime = lastCleanup ? parseInt(lastCleanup) : 0;
      
      if (now - lastCleanupTime > oneDayMs) {
        console.log('[Cache] Performing daily cleanup...');
        await this.cleanup();
        await AsyncStorage.setItem(DAILY_CLEANUP_KEY, now.toString());
        console.log('[Cache] Daily cleanup completed');
      }
    } catch (error) {
      console.error('[Cache] Error in daily cleanup:', error);
    }
  }
}

// Export singleton instance
export const cache = CacheService.getInstance();
