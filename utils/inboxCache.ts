import { supabase } from './supabase';
import { cache, CacheService } from './cache';
import { feedCache } from './feedCache'; // Reuse blocked users logic

export interface CachedChatParticipant {
  id: string;
  username: string;
  UserProfile?: {
    profilepicture: string;
  };
}

export interface CachedLastMessage {
  chat_id: string;
  content: string;
  created_at: string;
  sender_id: string;
}

export interface CachedChat {
  id: string;
  created_at: string;
  user1: CachedChatParticipant;
  user2: CachedChatParticipant;
  lastMessage: CachedLastMessage | null;
  unreadCount: number;
  last_activity: string; // For sorting
}

export interface CachedInboxData {
  chats: CachedChat[];
  cached_at: number;
  user_id: string;
  excluded_users: string[]; // Blocked users when cached
  total_unread_count: number;
}

export interface InboxSyncResult {
  chats: CachedChat[];
  totalUnreadCount: number;
  hasUpdates: boolean;
  source: 'cache' | 'fresh' | 'cache+fresh';
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
    return `inbox:${userId}`;
  }

  /**
   * Get inbox with smart caching and sync
   */
  async getInboxWithSync(userId: string): Promise<InboxSyncResult> {
    try {
      const cacheKey = this.getInboxKey(userId);
      
      // Get current blocked users (reuse from feedCache)
      const excludeUserIds = await feedCache.getBlockedUsers(userId);
      
      // Try to get cached inbox first
      const cachedData = await cache.get<CachedInboxData>(cacheKey);
      
      if (cachedData) {
        // Check if blocked users list has changed
        const blockedUsersChanged = !this.arraysEqual(cachedData.excluded_users, excludeUserIds);
        
        if (!blockedUsersChanged) {
          console.log(`[InboxCache] Using cached inbox (${cachedData.chats.length} chats)`);
          
          // For inbox, we'll refresh every time but use cache for instant display
          // then update with fresh data in background
          const freshData = await this.fetchInboxData(userId, excludeUserIds);
          
          if (this.hasInboxChanges(cachedData, freshData)) {
            console.log('[InboxCache] Found inbox changes, updating cache');
            await this.cacheInboxData(userId, freshData, excludeUserIds);
            
            return {
              chats: freshData.chats,
              totalUnreadCount: freshData.total_unread_count,
              hasUpdates: true,
              source: 'cache+fresh'
            };
          } else {
            return {
              chats: cachedData.chats,
              totalUnreadCount: cachedData.total_unread_count,
              hasUpdates: false,
              source: 'cache'
            };
          }
        } else {
          console.log('[InboxCache] Blocked users changed, invalidating cache');
          await cache.delete(cacheKey);
        }
      }

      // Fetch fresh inbox data
      console.log(`[InboxCache] Fetching fresh inbox data for user: ${userId}`);
      const freshData = await this.fetchInboxData(userId, excludeUserIds);
      
      // Cache fresh inbox data
      await this.cacheInboxData(userId, freshData, excludeUserIds);
      
      return {
        chats: freshData.chats,
        totalUnreadCount: freshData.total_unread_count,
        hasUpdates: true,
        source: 'fresh'
      };
      
    } catch (error) {
      console.error('[InboxCache] Error in getInboxWithSync:', error);
      // Return empty inbox on error
      return {
        chats: [],
        totalUnreadCount: 0,
        hasUpdates: false,
        source: 'fresh'
      };
    }
  }

  /**
   * Fetch inbox data from database
   */
  private async fetchInboxData(userId: string, excludeUserIds: string[]): Promise<CachedInboxData> {
    try {
      // Get chats excluding blocked users
      const { data: chatsData, error: chatsError } = await supabase
        .from('Chat')
        .select(`
          id, 
          created_at,
          user1:user1_id (
            id, 
            username,
            UserProfile (profilepicture)
          ),
          user2:user2_id (
            id,
            username,
            UserProfile (profilepicture)
          )
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .not(excludeUserIds.length > 0 ? 'user1_id' : 'id', 
             excludeUserIds.length > 0 ? 'in' : 'eq', 
             excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : userId)
        .not(excludeUserIds.length > 0 ? 'user2_id' : 'id', 
             excludeUserIds.length > 0 ? 'in' : 'eq', 
             excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : userId)
        .limit(50); // Increase limit for inbox

      if (chatsError) throw chatsError;

      if (!chatsData || chatsData.length === 0) {
        return {
          chats: [],
          cached_at: Date.now(),
          user_id: userId,
          excluded_users: excludeUserIds,
          total_unread_count: 0
        };
      }

      // Get chat IDs for batch queries
      const chatIds = chatsData.map(chat => chat.id);
      
      // Get last messages for all chats in one query
      const { data: lastMessages } = await supabase
        .from('Message')
        .select('chat_id, content, created_at, sender_id')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false });

      // Get unread counts for all chats in one query  
      const { data: unreadMessages } = await supabase
        .from('Message')
        .select('chat_id')
        .in('chat_id', chatIds)
        .eq('read', false)
        .neq('sender_id', userId);

      // Process the data efficiently
      const lastMessageMap = new Map<string, CachedLastMessage>();
      const unreadCountMap = new Map<string, number>();

      // Group last messages by chat_id
      lastMessages?.forEach(msg => {
        if (!lastMessageMap.has(msg.chat_id)) {
          lastMessageMap.set(msg.chat_id, msg);
        }
      });

      // Count unread messages by chat_id
      unreadMessages?.forEach(msg => {
        unreadCountMap.set(msg.chat_id, (unreadCountMap.get(msg.chat_id) || 0) + 1);
      });

      // Build final chat objects
      const processedChats: CachedChat[] = chatsData.map(chat => {
        const lastMessage = lastMessageMap.get(chat.id) || null;
        const unreadCount = unreadCountMap.get(chat.id) || 0;
        
        return {
          id: chat.id,
          created_at: chat.created_at,
          user1: chat.user1[0], // Supabase returns array, take first element
          user2: chat.user2[0], // Supabase returns array, take first element
          lastMessage,
          unreadCount,
          last_activity: lastMessage ? lastMessage.created_at : chat.created_at
        };
      });

      // Sort by last activity (most recent first)
      const sortedChats = processedChats.sort((a, b) => {
        const aTime = new Date(a.last_activity).getTime();
        const bTime = new Date(b.last_activity).getTime();
        return bTime - aTime;
      });

      // Calculate total unread count
      const totalUnreadCount = Array.from(unreadCountMap.values()).reduce((sum, count) => sum + count, 0);

      return {
        chats: sortedChats,
        cached_at: Date.now(),
        user_id: userId,
        excluded_users: excludeUserIds,
        total_unread_count: totalUnreadCount
      };

    } catch (error) {
      console.error('[InboxCache] Error fetching inbox data:', error);
      return {
        chats: [],
        cached_at: Date.now(),
        user_id: userId,
        excluded_users: excludeUserIds,
        total_unread_count: 0
      };
    }
  }

  /**
   * Cache inbox data
   */
  private async cacheInboxData(userId: string, inboxData: CachedInboxData, excludeUserIds: string[]): Promise<void> {
    try {
      const cacheKey = this.getInboxKey(userId);
      
      // Cache inbox with 5 minute TTL (active data that changes frequently)
      await cache.set(cacheKey, inboxData, 5 * 60 * 1000);
      console.log(`[InboxCache] Cached inbox with ${inboxData.chats.length} chats`);
    } catch (error) {
      console.error('[InboxCache] Error caching inbox data:', error);
    }
  }

  /**
   * Update specific chat in cache (when new message arrives)
   */
  async updateChatInCache(userId: string, chatId: string, lastMessage: CachedLastMessage, incrementUnread: boolean = false): Promise<void> {
    try {
      const cacheKey = this.getInboxKey(userId);
      const cachedData = await cache.get<CachedInboxData>(cacheKey);
      
      if (cachedData) {
        const updatedChats = cachedData.chats.map(chat => {
          if (chat.id === chatId) {
            const newUnreadCount = incrementUnread ? chat.unreadCount + 1 : chat.unreadCount;
            return {
              ...chat,
              lastMessage,
              unreadCount: newUnreadCount,
              last_activity: lastMessage.created_at
            };
          }
          return chat;
        });

        // Sort by last activity again
        const sortedChats = updatedChats.sort((a, b) => {
          const aTime = new Date(a.last_activity).getTime();
          const bTime = new Date(b.last_activity).getTime();
          return bTime - aTime;
        });

        // Recalculate total unread count
        const totalUnreadCount = sortedChats.reduce((sum, chat) => sum + chat.unreadCount, 0);

        const updatedData = {
          ...cachedData,
          chats: sortedChats,
          total_unread_count: totalUnreadCount
        };
        
        await cache.set(cacheKey, updatedData, 5 * 60 * 1000);
        console.log(`[InboxCache] Updated chat ${chatId} in cache`);
      }
    } catch (error) {
      console.error('[InboxCache] Error updating chat in cache:', error);
    }
  }

  /**
   * Mark chat as read in cache (reset unread count)
   */
  async markChatAsReadInCache(userId: string, chatId: string): Promise<void> {
    try {
      const cacheKey = this.getInboxKey(userId);
      const cachedData = await cache.get<CachedInboxData>(cacheKey);
      
      if (cachedData) {
        const updatedChats = cachedData.chats.map(chat => 
          chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
        );

        // Recalculate total unread count
        const totalUnreadCount = updatedChats.reduce((sum, chat) => sum + chat.unreadCount, 0);

        const updatedData = {
          ...cachedData,
          chats: updatedChats,
          total_unread_count: totalUnreadCount
        };
        
        await cache.set(cacheKey, updatedData, 5 * 60 * 1000);
        console.log(`[InboxCache] Marked chat ${chatId} as read in cache`);
      }
    } catch (error) {
      console.error('[InboxCache] Error marking chat as read in cache:', error);
    }
  }

  /**
   * Get total unread count from cache
   */
  async getTotalUnreadCount(userId: string): Promise<number> {
    try {
      const cacheKey = this.getInboxKey(userId);
      const cachedData = await cache.get<CachedInboxData>(cacheKey);
      
      if (cachedData) {
        return cachedData.total_unread_count;
      }
      
      // Fallback to fresh calculation if not cached
      const result = await this.getInboxWithSync(userId);
      return result.totalUnreadCount;
    } catch (error) {
      console.error('[InboxCache] Error getting total unread count:', error);
      return 0;
    }
  }

  /**
   * Invalidate inbox cache (call when user blocks/unblocks someone)
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
   * Helper methods
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every(val => b.includes(val));
  }

  private hasInboxChanges(cached: CachedInboxData, fresh: CachedInboxData): boolean {
    // Simple comparison - check if chat count or total unread count changed
    return cached.chats.length !== fresh.chats.length || 
           cached.total_unread_count !== fresh.total_unread_count ||
           JSON.stringify(cached.chats.map(c => ({ id: c.id, lastMessage: c.lastMessage?.content, unread: c.unreadCount }))) !==
           JSON.stringify(fresh.chats.map(c => ({ id: c.id, lastMessage: c.lastMessage?.content, unread: c.unreadCount })));
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    cachedInboxes: number;
    cacheSize: number;
  }> {
    try {
      const allStats = await cache.getStats();
      return {
        cachedInboxes: allStats.entriesByType.inbox || 0,
        cacheSize: allStats.totalSize
      };
    } catch (error) {
      console.error('[InboxCache] Error getting stats:', error);
      return { cachedInboxes: 0, cacheSize: 0 };
    }
  }
}

// Export singleton instance
export const inboxCache = InboxCacheService.getInstance();
