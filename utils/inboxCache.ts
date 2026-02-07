import { cache, CacheService } from './cache';
import { supabase } from './supabase';

export interface CachedInboxItem {
  id: string;
  created_at: string;
  user1: {
    id: string;
    username: string;
  };
  user2: {
    id: string;
    username: string;
  };
  lastMessage: {
    chat_id: string;
    content: string;
    created_at: string;
  } | null;
  unreadCount: number;
}

export interface CachedInbox {
  chats: CachedInboxItem[];
  cached_at: number;
  excluded_users: string[]; // List of blocked users when cached
}

export class InboxCacheService {
  private static instance: InboxCacheService;
  
  public static getInstance(): InboxCacheService {
    if (!InboxCacheService.instance) {
      InboxCacheService.instance = new InboxCacheService();
    }
    return InboxCacheService.instance;
  }

  private constructor() {}

  private getInboxKey(userId: string): string {
    return `${CacheService.KEYS.CHAT_HISTORY}:inbox:${userId}`;
  }

  /**
   * Get inbox with smart caching
   * Returns cached data immediately, then checks for updates
   */
  async getInboxWithSync(userId: string): Promise<{
    chats: CachedInboxItem[];
    source: 'cache' | 'fresh';
    hasUpdates: boolean;
  }> {
    try {
      const cacheKey = this.getInboxKey(userId);
      
      // Try to get cached inbox first
      const cachedInbox = await cache.get<CachedInbox>(cacheKey);
      
      if (cachedInbox) {
        console.log(`[InboxCache] Loaded ${cachedInbox.chats.length} chats from cache`);
        
        // Check if cache is fresh enough (less than 5 minutes old)
        const cacheAge = Date.now() - cachedInbox.cached_at;
        const CACHE_FRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes
        
        if (cacheAge < CACHE_FRESH_THRESHOLD) {
          return {
            chats: cachedInbox.chats,
            source: 'cache',
            hasUpdates: false
          };
        }
        
        console.log('[InboxCache] Cache older than 5 minutes, will refresh in background');
        
        // Return cache immediately, but trigger background refresh
        this.refreshInboxInBackground(userId, cachedInbox.excluded_users);
        
        return {
          chats: cachedInbox.chats,
          source: 'cache',
          hasUpdates: false
        };
      }
      
      // No cache, fetch fresh
      console.log('[InboxCache] No cache found, fetching fresh');
      const freshChats = await this.fetchInboxFromDB(userId);
      
      return {
        chats: freshChats,
        source: 'fresh',
        hasUpdates: false
      };
      
    } catch (error) {
      console.error('[InboxCache] Error in getInboxWithSync:', error);
      // On error, try to fetch fresh data
      const freshChats = await this.fetchInboxFromDB(userId);
      return {
        chats: freshChats,
        source: 'fresh',
        hasUpdates: false
      };
    }
  }

  /**
   * Fetch inbox from database
   */
  private async fetchInboxFromDB(userId: string): Promise<CachedInboxItem[]> {
    try {
      // Get blocked users
      const { data: blockedUsers, error: blockError } = await supabase
        .from('UserBlock')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

      if (blockError) throw blockError;

      const excludeUserIds = blockedUsers?.reduce((acc: string[], block) => {
        if (block.blocker_id === userId) acc.push(block.blocked_id);
        if (block.blocked_id === userId) acc.push(block.blocker_id);
        return acc;
      }, []) || [];

      // Get chats
      const { data: chats, error } = await supabase
        .from('Chat')
        .select(`
          id, 
          created_at,
          user1:user1_id (
            id, 
            username
          ),
          user2:user2_id (
            id,
            username
          )
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .not(excludeUserIds.length > 0 ? 'user1_id' : 'id', 
             excludeUserIds.length > 0 ? 'in' : 'eq', 
             excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : userId)
        .not(excludeUserIds.length > 0 ? 'user2_id' : 'id', 
             excludeUserIds.length > 0 ? 'in' : 'eq', 
             excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : userId)
        .limit(10);

      if (error) throw error;

      const chatIds = chats.map(chat => chat.id);
      
      // Get last messages
      const { data: lastMessages } = await supabase
        .from('Message')
        .select('chat_id, content, created_at')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false });

      // Get unread counts
      const { data: unreadMessages } = await supabase
        .from('Message')
        .select('chat_id')
        .in('chat_id', chatIds)
        .eq('read', false)
        .neq('sender_id', userId);

      // Process the data
      const lastMessageMap = new Map();
      const unreadCountMap = new Map();

      lastMessages?.forEach(msg => {
        if (!lastMessageMap.has(msg.chat_id)) {
          lastMessageMap.set(msg.chat_id, msg);
        }
      });

      unreadMessages?.forEach(msg => {
        unreadCountMap.set(msg.chat_id, (unreadCountMap.get(msg.chat_id) || 0) + 1);
      });

      const chatsWithDetails = chats.map(chat => ({
        ...chat,
        user1: Array.isArray(chat.user1) ? chat.user1[0] : chat.user1,
        user2: Array.isArray(chat.user2) ? chat.user2[0] : chat.user2,
        lastMessage: lastMessageMap.get(chat.id) || null,
        unreadCount: unreadCountMap.get(chat.id) || 0
      }));

      const sortedChats = chatsWithDetails.sort((a, b) => {
        const aTime = a.lastMessage 
          ? new Date(a.lastMessage.created_at).getTime() 
          : new Date(a.created_at).getTime();
        const bTime = b.lastMessage 
          ? new Date(b.lastMessage.created_at).getTime() 
          : new Date(b.created_at).getTime();
        return bTime - aTime;
      });

      // Cache the results
      await this.cacheInbox(userId, sortedChats, excludeUserIds);

      console.log(`[InboxCache] Fetched and cached ${sortedChats.length} chats`);
      return sortedChats;
      
    } catch (error) {
      console.error('[InboxCache] Error fetching inbox from DB:', error);
      return [];
    }
  }

  /**
   * Cache inbox data
   */
  private async cacheInbox(userId: string, chats: CachedInboxItem[], excludeUserIds: string[]): Promise<void> {
    try {
      const cacheKey = this.getInboxKey(userId);
      
      const cachedInbox: CachedInbox = {
        chats,
        cached_at: Date.now(),
        excluded_users: excludeUserIds
      };

      // Cache inbox with 10 minute TTL
      await cache.set(cacheKey, cachedInbox, 10 * 60 * 1000);
      console.log(`[InboxCache] Cached inbox with ${chats.length} chats`);
    } catch (error) {
      console.error('[InboxCache] Error caching inbox:', error);
    }
  }

  /**
   * Background refresh (fire and forget)
   */
  private async refreshInboxInBackground(userId: string, currentExcludedUsers: string[]): Promise<void> {
    // Don't await this - let it run in background
    this.fetchInboxFromDB(userId).catch(error => {
      console.error('[InboxCache] Background refresh failed:', error);
    });
  }

  /**
   * Invalidate inbox cache (call when user blocks/unblocks someone or when new match happens)
   */
  async invalidateInbox(userId: string): Promise<void> {
    try {
      const cacheKey = this.getInboxKey(userId);
      await cache.delete(cacheKey);
      console.log(`[InboxCache] Invalidated inbox cache for user: ${userId}`);
    } catch (error) {
      console.error('[InboxCache] Error invalidating inbox:', error);
    }
  }

  /**
   * Update a specific chat in cache (useful for real-time updates)
   */
  async updateChatInCache(userId: string, chatId: string, updates: Partial<CachedInboxItem>): Promise<void> {
    try {
      const cacheKey = this.getInboxKey(userId);
      const cachedInbox = await cache.get<CachedInbox>(cacheKey);
      
      if (!cachedInbox) {
        console.log('[InboxCache] No cache to update');
        return;
      }

      const updatedChats = cachedInbox.chats.map(chat => 
        chat.id === chatId ? { ...chat, ...updates } : chat
      );

      // Re-sort after update (in case last message changed)
      const sortedChats = updatedChats.sort((a, b) => {
        const aTime = a.lastMessage 
          ? new Date(a.lastMessage.created_at).getTime() 
          : new Date(a.created_at).getTime();
        const bTime = b.lastMessage 
          ? new Date(b.lastMessage.created_at).getTime() 
          : new Date(b.created_at).getTime();
        return bTime - aTime;
      });

      await this.cacheInbox(userId, sortedChats, cachedInbox.excluded_users);
      console.log(`[InboxCache] Updated chat ${chatId} in cache`);
    } catch (error) {
      console.error('[InboxCache] Error updating chat in cache:', error);
    }
  }
}

// Export singleton instance
export const inboxCache = InboxCacheService.getInstance();
