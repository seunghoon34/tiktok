import { cache } from './cache';
import { profileCache } from './profileCache';
import { chatCache } from './chatCache';
import { mediaCache } from './mediaCache';
import { feedCache } from './feedCache';
import { notificationCache } from './notificationCache';

export class CacheDebugService {
  /**
   * Print comprehensive cache statistics to console
   */
  static async printCacheStats(): Promise<void> {
    console.log('\n=== CACHE STATISTICS ===');
    
    try {
      // Overall cache stats
      const generalStats = await cache.getStats();
      console.log('📊 General Cache:');
      console.log(`   Total entries: ${generalStats.totalEntries}`);
      console.log(`   Total size: ${generalStats.totalSize}KB`);
      console.log('   Entries by type:', generalStats.entriesByType);
      
      // Profile cache stats
      console.log('\n👤 Profile Cache:');
      const profileStats = await profileCache.getStats();
      console.log(`   Cached profiles: ${profileStats.cachedProfiles}`);
      
      // Chat cache stats
      console.log('\n💬 Chat Cache:');
      const chatStats = await chatCache.getStats();
      console.log(`   Cached chats: ${chatStats.cachedChats}`);
      console.log(`   Total messages: ${chatStats.totalMessages} (estimated)`);
      
      // Media cache stats
      console.log('\n🎬 Media Cache:');
      const mediaStats = await mediaCache.getStats();
      console.log(`   Cached URLs: ${mediaStats.cachedUrls}`);
      
      // Feed cache stats
      console.log('\n📺 Feed Cache:');
      const feedStats = await feedCache.getStats();
      console.log(`   Cached feeds: ${feedStats.cachedFeeds}`);
      console.log(`   Cached blocked lists: ${feedStats.cachedBlockedLists}`);
      
      // User stories cache is included in feed cache stats as feed_data entries
      
      // Notification cache stats
      console.log('\n🔔 Notification Cache:');
      const notificationStats = await notificationCache.getStats();
      console.log(`   Cached notifications: ${notificationStats.cachedNotifications}`);
      
      console.log('========================\n');
    } catch (error) {
      console.error('Error getting cache stats:', error);
    }
  }

  /**
   * Clear all caches (for testing)
   */
  static async clearAllCaches(): Promise<void> {
    try {
      await cache.clearAll();
      console.log('🗑️ All caches cleared');
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }

  /**
   * Test cache performance
   */
  static async testCachePerformance(userId: string): Promise<void> {
    console.log('\n🚀 Testing cache performance...');
    
    // Test profile cache
    const profileStart = Date.now();
    await profileCache.getProfile(userId);
    const profileFirstLoad = Date.now() - profileStart;
    
    const profileCacheStart = Date.now();
    await profileCache.getProfile(userId);
    const profileCachedLoad = Date.now() - profileCacheStart;
    
    console.log(`📈 Profile load times:`);
    console.log(`   First load: ${profileFirstLoad}ms`);
    console.log(`   Cached load: ${profileCachedLoad}ms`);
    console.log(`   Speed improvement: ${Math.round((profileFirstLoad / profileCachedLoad) * 100)}%`);
  }

  /**
   * Test enhanced chat loading
   */
  static async testChatSync(chatId: string, userId: string): Promise<void> {
    console.log('\n💬 Testing enhanced chat sync...');
    
    const { EnhancedChatService } = await import('./chatCacheEnhanced');
    
    const start = Date.now();
    const result = await EnhancedChatService.loadMessagesWithSync(chatId, userId);
    const loadTime = Date.now() - start;
    
    console.log(`📨 Chat sync results:`);
    console.log(`   Total messages: ${result.messages.length}`);
    console.log(`   New messages: ${result.newMessageCount}`);
    console.log(`   Load time: ${loadTime}ms`);
    console.log(`   Source: ${result.hasNewMessages ? 'Cache + Fresh' : 'Cache only'}`);
  }

  /**
   * Test user stories caching performance
   */
  static async testUserStoriesCache(targetUserId: string): Promise<void> {
    console.log(`\n👤 Testing user stories cache for user: ${targetUserId}...`);
    
    const { feedCache } = await import('./feedCache');
    
    // First load (should be fresh)
    const start1 = Date.now();
    const stories1 = await feedCache.getUserStories(targetUserId);
    const firstLoad = Date.now() - start1;
    
    // Second load (should be cached)
    const start2 = Date.now();
    const stories2 = await feedCache.getUserStories(targetUserId);
    const cachedLoad = Date.now() - start2;
    
    console.log(`📈 User stories load times:`);
    console.log(`   First load: ${firstLoad}ms (${stories1.length} stories)`);
    console.log(`   Cached load: ${cachedLoad}ms (${stories2.length} stories)`);
    if (cachedLoad > 0) {
      console.log(`   Speed improvement: ${Math.round((firstLoad / cachedLoad) * 100)}%`);
    }
    console.log(`   Cache hit: ${stories1.length === stories2.length ? '✅' : '❌'}`);
  }

  /**
   * Test notification caching performance
   */
  static async testNotificationCache(userId: string): Promise<void> {
    console.log(`\n🔔 Testing notification cache for user: ${userId}...`);
    
    const { notificationCache } = await import('./notificationCache');
    
    // First load (should be fresh)
    const start1 = Date.now();
    const result1 = await notificationCache.getNotificationsWithSync(userId);
    const firstLoad = Date.now() - start1;
    
    // Second load (should be cached)
    const start2 = Date.now();
    const result2 = await notificationCache.getNotificationsWithSync(userId);
    const cachedLoad = Date.now() - start2;
    
    console.log(`📈 Notification load times:`);
    console.log(`   First load: ${firstLoad}ms (${result1.notifications.length} notifications)`);
    console.log(`   Cached load: ${cachedLoad}ms (${result2.notifications.length} notifications)`);
    if (cachedLoad > 0) {
      console.log(`   Speed improvement: ${Math.round((firstLoad / cachedLoad) * 100)}%`);
    }
    console.log(`   Source: ${result1.source} → ${result2.source}`);
    console.log(`   Cache hit: ${result2.source === 'cache' ? '✅' : '❌'}`);
  }
}

// Helper to enable cache debugging in development
export const enableCacheDebug = () => {
  if (__DEV__) {
    // Add global function for easy debugging
    (global as any).printCacheStats = CacheDebugService.printCacheStats;
    (global as any).clearCaches = CacheDebugService.clearAllCaches;
    
    console.log('🔧 Cache debugging enabled:');
    console.log('   Run "printCacheStats()" to see cache statistics');
    console.log('   Run "clearCaches()" to clear all caches');
  }
};
