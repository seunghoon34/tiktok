import { supabase } from './supabase';
import { cache, CacheService } from './cache';
import { feedCache } from './feedCache'; // Reuse blocked users logic

export interface CachedNotification {
  id: string;
  type: 'SHOT' | 'MATCH' | string;
  read: boolean;
  created_at: string;
  from_user: string;
  to_user: string;
  sender: {
    id: string;
    username: string;
  };
  // Processed fields for UI
  username: string;
  userId: string;
  time: string;
  actionable: boolean;
  content: string;
}

export interface CachedNotificationData {
  notifications: CachedNotification[];
  cached_at: number;
  user_id: string;
  excluded_users: string[]; // Blocked users when cached
  last_notification_timestamp: string; // For incremental updates
}

export interface NotificationSyncResult {
  notifications: CachedNotification[];
  hasNewNotifications: boolean;
  newNotificationCount: number;
  source: 'cache' | 'fresh' | 'cache+fresh';
}

export class NotificationCacheService {
  private static instance: NotificationCacheService;
  
  public static getInstance(): NotificationCacheService {
    if (!NotificationCacheService.instance) {
      NotificationCacheService.instance = new NotificationCacheService();
    }
    return NotificationCacheService.instance;
  }

  private constructor() {}

  private getNotificationKey(userId: string): string {
    return `${CacheService.KEYS.NOTIFICATIONS}:${userId}`;
  }

  /**
   * Get notifications with smart caching and sync
   */
  async getNotificationsWithSync(userId: string): Promise<NotificationSyncResult> {
    try {
      const cacheKey = this.getNotificationKey(userId);
      
      // Get current blocked users (reuse from feedCache)
      const excludeUserIds = await feedCache.getBlockedUsers(userId);
      
      // Try to get cached notifications first
      const cachedData = await cache.get<CachedNotificationData>(cacheKey);
      
      if (cachedData) {
        // Check if blocked users list has changed
        const blockedUsersChanged = !this.arraysEqual(cachedData.excluded_users, excludeUserIds);
        
        if (!blockedUsersChanged) {
          console.log(`[NotificationCache] Using cached notifications (${cachedData.notifications.length} items)`);
          
          // Check for new notifications since last cache
          const newNotifications = await this.fetchNewNotifications(userId, excludeUserIds, cachedData.last_notification_timestamp);
          
          if (newNotifications.length > 0) {
            console.log(`[NotificationCache] Found ${newNotifications.length} new notifications, merging with cache`);
            const mergedNotifications = [...newNotifications.reverse(), ...cachedData.notifications].slice(0, 100); // Keep only recent 100
            
            // Update cache with merged notifications
            await this.cacheNotifications(userId, mergedNotifications, excludeUserIds);
            
            return {
              notifications: mergedNotifications,
              hasNewNotifications: true,
              newNotificationCount: newNotifications.length,
              source: 'cache+fresh'
            };
          } else {
            return {
              notifications: cachedData.notifications,
              hasNewNotifications: false,
              newNotificationCount: 0,
              source: 'cache'
            };
          }
        } else {
          console.log('[NotificationCache] Blocked users changed, invalidating cache');
          await cache.delete(cacheKey);
        }
      }

      // Fetch fresh notifications
      console.log(`[NotificationCache] Fetching fresh notifications for user: ${userId}`);
      const freshNotifications = await this.fetchNotifications(userId, excludeUserIds);
      
      // Cache fresh notifications
      await this.cacheNotifications(userId, freshNotifications, excludeUserIds);
      
      return {
        notifications: freshNotifications,
        hasNewNotifications: true,
        newNotificationCount: freshNotifications.length,
        source: 'fresh'
      };
      
    } catch (error) {
      console.error('[NotificationCache] Error in getNotificationsWithSync:', error);
      // Return empty notifications on error
      return {
        notifications: [],
        hasNewNotifications: false,
        newNotificationCount: 0,
        source: 'fresh'
      };
    }
  }

  /**
   * Fetch new notifications since a specific timestamp
   */
  private async fetchNewNotifications(userId: string, excludeUserIds: string[], sinceTimestamp: string): Promise<CachedNotification[]> {
    try {
      const { data, error } = await supabase
        .from('Notification')
        .select(`
          id,
          type,
          read,
          created_at,
          from_user,
          to_user,
          sender:from_user (id, username)
        `)
        .eq('to_user', userId)
        .not(excludeUserIds.length > 0 ? 'from_user' : 'id',
             excludeUserIds.length > 0 ? 'in' : 'eq',
             excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : userId)
        .gt('created_at', sinceTimestamp)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return this.processNotificationData(data || []);
    } catch (error) {
      console.error('[NotificationCache] Error fetching new notifications:', error);
      return [];
    }
  }

  /**
   * Fetch notifications from database
   */
  private async fetchNotifications(userId: string, excludeUserIds: string[]): Promise<CachedNotification[]> {
    try {
      const { data, error } = await supabase
        .from('Notification')
        .select(`
          id,
          type,
          read,
          created_at,
          from_user,
          to_user,
          sender:from_user (id, username)
        `)
        .eq('to_user', userId)
        .not(excludeUserIds.length > 0 ? 'from_user' : 'id',
             excludeUserIds.length > 0 ? 'in' : 'eq',
             excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : userId)
        .order('created_at', { ascending: false })
        .limit(100); // Load last 100 notifications

      if (error) throw error;

      return this.processNotificationData(data || []);
    } catch (error) {
      console.error('[NotificationCache] Error fetching notifications:', error);
      return [];
    }
  }

  /**
   * Process raw notification data into cached format
   */
  private processNotificationData(rawData: any[]): CachedNotification[] {
    return rawData.map(notification => ({
      ...notification,
      // UI-ready fields
      username: notification.sender?.username,
      userId: notification.sender?.id,
      time: this.formatDate(notification.created_at),
      actionable: notification.type === 'SHOT' || notification.type === 'MATCH',
      content: this.getNotificationContent(notification.type, notification.sender?.username)
    }));
  }

  /**
   * Cache notifications data
   */
  private async cacheNotifications(userId: string, notifications: CachedNotification[], excludeUserIds: string[]): Promise<void> {
    try {
      const cacheKey = this.getNotificationKey(userId);
      
      const cachedData: CachedNotificationData = {
        notifications,
        cached_at: Date.now(),
        user_id: userId,
        excluded_users: excludeUserIds,
        last_notification_timestamp: notifications.length > 0 ? notifications[0].created_at : new Date().toISOString()
      };

      // Cache notifications with 1 hour TTL
      await cache.set(cacheKey, cachedData, CacheService.TTL.NOTIFICATIONS);
      console.log(`[NotificationCache] Cached ${notifications.length} notifications`);
    } catch (error) {
      console.error('[NotificationCache] Error caching notifications:', error);
    }
  }

  /**
   * Mark notification as read and update cache
   */
  async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      // Update in database
      const { error } = await supabase
        .from('Notification')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      // Update in cache
      const cacheKey = this.getNotificationKey(userId);
      const cachedData = await cache.get<CachedNotificationData>(cacheKey);
      
      if (cachedData) {
        const updatedNotifications = cachedData.notifications.map(notification =>
          notification.id === notificationId 
            ? { ...notification, read: true }
            : notification
        );
        
        const updatedData = { ...cachedData, notifications: updatedNotifications };
        await cache.set(cacheKey, updatedData, CacheService.TTL.NOTIFICATIONS);
        console.log(`[NotificationCache] Updated notification ${notificationId} as read in cache`);
      }
    } catch (error) {
      console.error('[NotificationCache] Error marking notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read and update cache
   */
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      // Update in database
      const { error } = await supabase
        .from('Notification')
        .update({ read: true })
        .eq('to_user', userId)
        .eq('read', false);

      if (error) throw error;

      // Update in cache
      const cacheKey = this.getNotificationKey(userId);
      const cachedData = await cache.get<CachedNotificationData>(cacheKey);
      
      if (cachedData) {
        const updatedNotifications = cachedData.notifications.map(notification => ({
          ...notification,
          read: true
        }));
        
        const updatedData = { ...cachedData, notifications: updatedNotifications };
        await cache.set(cacheKey, updatedData, CacheService.TTL.NOTIFICATIONS);
        console.log(`[NotificationCache] Marked all notifications as read in cache`);
      }
    } catch (error) {
      console.error('[NotificationCache] Error marking all notifications as read:', error);
    }
  }

  /**
   * Invalidate notifications cache (call when user blocks/unblocks someone)
   */
  async invalidateNotifications(userId: string): Promise<void> {
    try {
      const cacheKey = this.getNotificationKey(userId);
      await cache.delete(cacheKey);
      console.log(`[NotificationCache] Invalidated notifications cache for user: ${userId}`);
    } catch (error) {
      console.error('[NotificationCache] Error invalidating notifications:', error);
    }
  }

  /**
   * Add new notification to cache (for real-time updates)
   */
  async addNotificationToCache(userId: string, notification: any): Promise<void> {
    try {
      const cacheKey = this.getNotificationKey(userId);
      const cachedData = await cache.get<CachedNotificationData>(cacheKey);
      
      if (cachedData) {
        const processedNotification = this.processNotificationData([notification])[0];
        const updatedNotifications = [processedNotification, ...cachedData.notifications].slice(0, 100); // Keep only recent 100
        
        const updatedData = { 
          ...cachedData, 
          notifications: updatedNotifications,
          last_notification_timestamp: processedNotification.created_at
        };
        
        await cache.set(cacheKey, updatedData, CacheService.TTL.NOTIFICATIONS);
        console.log(`[NotificationCache] Added new notification to cache`);
      }
    } catch (error) {
      console.error('[NotificationCache] Error adding notification to cache:', error);
    }
  }

  /**
   * Helper methods
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every(val => b.includes(val));
  }

  private formatDate(dateString: string): string {
    // Reuse the same logic from activity.tsx
    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${diffInDays}d ago`;
  }

  private getNotificationContent(type: string, username: string): string {
    switch (type) {
      case 'SHOT':
        return `${username} sent you a shot! 📸`;
      case 'MATCH':
        return `You matched with ${username}! 💕`;
      default:
        return `${username} sent you a notification`;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    cachedNotifications: number;
    cacheSize: number;
  }> {
    try {
      const allStats = await cache.getStats();
      return {
        cachedNotifications: allStats.entriesByType.notifications || 0,
        cacheSize: allStats.totalSize
      };
    } catch (error) {
      console.error('[NotificationCache] Error getting stats:', error);
      return { cachedNotifications: 0, cacheSize: 0 };
    }
  }
}

// Export singleton instance
export const notificationCache = NotificationCacheService.getInstance();
