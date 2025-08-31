import { supabase } from './supabase';
import { cache, CacheService } from './cache';

export interface CachedFeedItem {
  id: string;
  uri: string;
  type: 'video' | 'picture';
  title: string;
  created_at: string;
  expired_at: string;
  is_muted: boolean;
  user_id: string;
  User: {
    username: string;
    id: string;
  };
  TextOverlay?: Array<{
    text: string;
    position_x: number;
    position_y: number;
    scale: number;
    rotation: number;
    font_size: number;
    media_width?: number;
    media_height?: number;
    screen_width?: number;
    screen_height?: number;
  }>;
}

export interface CachedFeed {
  items: CachedFeedItem[];
  cached_at: number;
  user_id: string;
  excluded_users: string[]; // List of blocked users when cached
  last_item_timestamp: string; // For pagination
}

export interface FeedSyncResult {
  items: CachedFeedItem[];
  hasNewItems: boolean;
  newItemCount: number;
  source: 'cache' | 'fresh' | 'cache+fresh';
}

export class FeedCacheService {
  private static instance: FeedCacheService;
  
  public static getInstance(): FeedCacheService {
    if (!FeedCacheService.instance) {
      FeedCacheService.instance = new FeedCacheService();
    }
    return FeedCacheService.instance;
  }

  private constructor() {}

  private getFeedKey(userId: string): string {
    return `${CacheService.KEYS.FEED_DATA}:${userId}`;
  }

  private getUserStoriesKey(targetUserId: string): string {
    return `${CacheService.KEYS.FEED_DATA}:user_stories:${targetUserId}`;
  }

  private getBlockedUsersKey(userId: string): string {
    return `${CacheService.KEYS.USER_METADATA}:blocked:${userId}`;
  }

  /**
   * Get blocked users list (cached for efficiency)
   */
  async getBlockedUsers(userId: string): Promise<string[]> {
    try {
      const cacheKey = this.getBlockedUsersKey(userId);
      const cached = await cache.get<string[]>(cacheKey);
      
      if (cached) {
        console.log(`[FeedCache] Using cached blocked users list (${cached.length} users)`);
        return cached;
      }

      // Fetch fresh blocked users
      const { data: blockedUsers, error } = await supabase
        .from('UserBlock')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

      if (error) throw error;

      const excludeUserIds = blockedUsers?.reduce((acc: string[], block) => {
        if (block.blocker_id === userId) acc.push(block.blocked_id);
        if (block.blocked_id === userId) acc.push(block.blocker_id);
        return acc;
      }, []) || [];

      // Add current user to exclude list
      excludeUserIds.push(userId);

      // Cache blocked users list for 1 hour
      await cache.set(cacheKey, excludeUserIds, 60 * 60 * 1000);
      console.log(`[FeedCache] Cached blocked users list (${excludeUserIds.length} users)`);
      
      return excludeUserIds;
    } catch (error) {
      console.error('[FeedCache] Error getting blocked users:', error);
      return [userId]; // At minimum, exclude self
    }
  }

  /**
   * Get feed items with smart caching
   */
  async getFeedWithSync(userId: string, loadMore: boolean = false): Promise<FeedSyncResult> {
    try {
      const feedKey = this.getFeedKey(userId);
      
      // Get current blocked users
      const excludeUserIds = await this.getBlockedUsers(userId);
      
      if (!loadMore) {
        // Try to get cached feed first
        const cachedFeed = await cache.get<CachedFeed>(feedKey);
        
        if (cachedFeed) {
          // Check if blocked users list has changed
          const blockedUsersChanged = !this.arraysEqual(cachedFeed.excluded_users, excludeUserIds);
          
          if (!blockedUsersChanged) {
            console.log(`[FeedCache] Using cached feed (${cachedFeed.items.length} items)`);
            
            // Check for new items since last cache
            const newItems = await this.fetchNewItems(userId, excludeUserIds, cachedFeed.last_item_timestamp);
            
            if (newItems.length > 0) {
              console.log(`[FeedCache] Found ${newItems.length} new items, merging with cache`);
              const mergedItems = [...newItems.reverse(), ...cachedFeed.items].slice(0, 50); // Keep only recent 50
              
              // Update cache with merged items
              await this.cacheFeed(userId, mergedItems, excludeUserIds);
              
              return {
                items: mergedItems,
                hasNewItems: true,
                newItemCount: newItems.length,
                source: 'cache+fresh'
              };
            } else {
              return {
                items: cachedFeed.items,
                hasNewItems: false,
                newItemCount: 0,
                source: 'cache'
              };
            }
          } else {
            console.log('[FeedCache] Blocked users changed, invalidating cache');
            await cache.delete(feedKey);
          }
        }
      }

      // Fetch fresh feed data
      console.log(`[FeedCache] Fetching fresh feed data for user: ${userId}`);
      const freshItems = await this.fetchFeedItems(userId, excludeUserIds, 50);
      
      if (!loadMore) {
        // Cache fresh feed data
        await this.cacheFeed(userId, freshItems, excludeUserIds);
      }
      
      return {
        items: freshItems,
        hasNewItems: true,
        newItemCount: freshItems.length,
        source: 'fresh'
      };
      
    } catch (error) {
      console.error('[FeedCache] Error in getFeedWithSync:', error);
      // Return empty feed on error
      return {
        items: [],
        hasNewItems: false,
        newItemCount: 0,
        source: 'fresh'
      };
    }
  }

  /**
   * Fetch new items since a specific timestamp
   */
  private async fetchNewItems(userId: string, excludeUserIds: string[], sinceTimestamp: string): Promise<CachedFeedItem[]> {
    try {
      const { data, error } = await supabase
        .from('Video')
        .select(`
          *,
          User(username, id),
          TextOverlay(
            text,
            position_x,
            position_y,
            scale,
            rotation,
            font_size,
            media_width,
            media_height,
            screen_width,
            screen_height
          )
        `)
        .not(excludeUserIds.length > 0 ? 'user_id' : 'id',
             excludeUserIds.length > 0 ? 'in' : 'eq',
             excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : userId)
        .gt('expired_at', new Date().toISOString())
        .gt('created_at', sinceTimestamp)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return this.processRawFeedData(data || []);
    } catch (error) {
      console.error('[FeedCache] Error fetching new items:', error);
      return [];
    }
  }

  /**
   * Fetch feed items from database
   */
  private async fetchFeedItems(userId: string, excludeUserIds: string[], limit: number = 50): Promise<CachedFeedItem[]> {
    try {
      const { data, error } = await supabase
        .from('Video')
        .select(`
          *,
          User(username, id),
          TextOverlay(
            text,
            position_x,
            position_y,
            scale,
            rotation,
            font_size,
            media_width,
            media_height,
            screen_width,
            screen_height
          )
        `)
        .not(excludeUserIds.length > 0 ? 'user_id' : 'id',
             excludeUserIds.length > 0 ? 'in' : 'eq',
             excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : userId)
        .gt('expired_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return this.processRawFeedData(data || []);
    } catch (error) {
      console.error('[FeedCache] Error fetching feed items:', error);
      return [];
    }
  }

  /**
   * Process raw database data into cached format
   */
  private processRawFeedData(rawData: any[]): CachedFeedItem[] {
    return rawData.map(item => ({
      ...item,
      type: item.uri.toLowerCase().endsWith('.mov') ? 'video' : 'picture',
    })) as CachedFeedItem[];
  }

  /**
   * Cache feed data
   */
  private async cacheFeed(userId: string, items: CachedFeedItem[], excludeUserIds: string[]): Promise<void> {
    try {
      const feedKey = this.getFeedKey(userId);
      
      const cachedFeed: CachedFeed = {
        items,
        cached_at: Date.now(),
        user_id: userId,
        excluded_users: excludeUserIds,
        last_item_timestamp: items.length > 0 ? items[0].created_at : new Date().toISOString()
      };

      // Cache feed with 10 minute TTL (feeds change frequently)
      await cache.set(feedKey, cachedFeed, 10 * 60 * 1000);
      console.log(`[FeedCache] Cached feed with ${items.length} items`);
    } catch (error) {
      console.error('[FeedCache] Error caching feed:', error);
    }
  }

  /**
   * Invalidate feed cache (call when user blocks/unblocks someone)
   */
  async invalidateFeed(userId: string): Promise<void> {
    try {
      const feedKey = this.getFeedKey(userId);
      const blockedKey = this.getBlockedUsersKey(userId);
      
      await Promise.all([
        cache.delete(feedKey),
        cache.delete(blockedKey)
      ]);
      
      console.log(`[FeedCache] Invalidated feed cache for user: ${userId}`);
    } catch (error) {
      console.error('[FeedCache] Error invalidating feed:', error);
    }
  }

  /**
   * Helper to compare arrays
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every(val => b.includes(val));
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    cachedFeeds: number;
    cachedBlockedLists: number;
    totalCacheSize: number;
  }> {
    try {
      const allStats = await cache.getStats();
      return {
        cachedFeeds: allStats.entriesByType.feed_data || 0,
        cachedBlockedLists: allStats.entriesByType.user_metadata || 0,
        totalCacheSize: allStats.totalSize
      };
    } catch (error) {
      console.error('[FeedCache] Error getting stats:', error);
      return { cachedFeeds: 0, cachedBlockedLists: 0, totalCacheSize: 0 };
    }
  }

  /**
   * Get user stories with caching (for /userstories?user_id=X)
   */
  async getUserStories(targetUserId: string): Promise<CachedFeedItem[]> {
    try {
      const cacheKey = this.getUserStoriesKey(targetUserId);
      
      // Try to get from cache first
      const cached = await cache.get<CachedFeedItem[]>(cacheKey);
      if (cached) {
        console.log(`[FeedCache] Using cached user stories for user: ${targetUserId} (${cached.length} stories)`);
        return cached;
      }

      // Fetch fresh user stories
      console.log(`[FeedCache] Fetching fresh user stories for user: ${targetUserId}`);
      const stories = await this.fetchUserStories(targetUserId);
      
      // Cache user stories for 30 minutes (shorter TTL since user-specific)
      if (stories.length > 0) {
        await cache.set(cacheKey, stories, 30 * 60 * 1000); // 30 minutes
        console.log(`[FeedCache] Cached ${stories.length} user stories for user: ${targetUserId}`);
      }
      
      return stories;
    } catch (error) {
      console.error(`[FeedCache] Error getting user stories for ${targetUserId}:`, error);
      return [];
    }
  }

  /**
   * Fetch user stories from database
   */
  private async fetchUserStories(targetUserId: string): Promise<CachedFeedItem[]> {
    try {
      const { data, error } = await supabase
        .from('Video')
        .select(`
          *,
          User(username, id),
          TextOverlay(
            text,
            position_x,
            position_y,
            scale,
            rotation,
            font_size,
            media_width,
            media_height,
            screen_width,
            screen_height
          )
        `)
        .eq('user_id', targetUserId)
        .gt('expired_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return this.processRawFeedData(data || []);
    } catch (error) {
      console.error(`[FeedCache] Error fetching user stories for ${targetUserId}:`, error);
      return [];
    }
  }

  /**
   * Invalidate user stories cache for a specific user
   */
  async invalidateUserStories(targetUserId: string): Promise<void> {
    try {
      const cacheKey = this.getUserStoriesKey(targetUserId);
      await cache.delete(cacheKey);
      console.log(`[FeedCache] Invalidated user stories cache for user: ${targetUserId}`);
    } catch (error) {
      console.error(`[FeedCache] Error invalidating user stories for ${targetUserId}:`, error);
    }
  }

  /**
   * Preload user stories for likely-to-be-viewed users
   */
  async preloadUserStories(userIds: string[]): Promise<void> {
    try {
      console.log(`[FeedCache] Preloading user stories for ${userIds.length} users...`);
      
      // Process in parallel but limit concurrency
      const batchSize = 3;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        await Promise.all(batch.map(userId => this.getUserStories(userId)));
      }
      
      console.log(`[FeedCache] Preloading completed for ${userIds.length} users`);
    } catch (error) {
      console.error('[FeedCache] Error preloading user stories:', error);
    }
  }

  /**
   * Clear all feed caches
   */
  async clearAllFeeds(): Promise<void> {
    try {
      console.log('[FeedCache] Clearing all feed caches...');
      // This will be handled by general cache cleanup
      // Could implement more targeted clearing if needed
      console.log('[FeedCache] Feed caches cleared');
    } catch (error) {
      console.error('[FeedCache] Error clearing feeds:', error);
    }
  }
}

// Export singleton instance
export const feedCache = FeedCacheService.getInstance();
