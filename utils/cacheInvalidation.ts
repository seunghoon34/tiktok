import { hybridCache } from './memoryCache';
import { cache, CacheService } from './cache';
import { profileCache } from './profileCache';

/**
 * Utility functions to invalidate user-related caches
 * Use these when user data changes (profile updates, picture changes, etc.)
 */

/**
 * Invalidate all caches for a specific user
 * Call this after profile updates, picture changes, etc.
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  console.log(`[CacheInvalidation] Invalidating all caches for user: ${userId}`);
  
  const keysToInvalidate = [
    `profile:${userId}`,           // Full profile data (hybridCache)
    `profile_pic:${userId}`,       // Profile picture URL (hybridCache)
    `notifications:${userId}`,     // User notifications (hybridCache)
    `cache:profiles:${userId}`,    // ProfileCache key
  ];

  // Invalidate from hybrid cache (memory + disk)
  await Promise.all(keysToInvalidate.map(key => hybridCache.delete(key)));
  
  // Invalidate from profileCache (used by mediaItem, inbox, chat, etc.)
  await profileCache.invalidateProfile(userId);
  
  // Force clear the cache entry from the underlying cache service too
  await cache.delete(`cache:profiles:${userId}`);
  
  console.log(`[CacheInvalidation] Invalidated ${keysToInvalidate.length} cache keys + profileCache + underlying cache`);
}

/**
 * Invalidate profile picture cache across all systems
 * Use this specifically after profile picture updates
 */
export async function invalidateProfilePictureCache(userId: string): Promise<void> {
  console.log(`[CacheInvalidation] Invalidating profile picture cache for: ${userId}`);

  // Invalidate profile data caches
  await hybridCache.delete(`profile:${userId}`);
  await hybridCache.delete(`profile_pic:${userId}`);
  await profileCache.invalidateProfile(userId);

  // Force clear from underlying cache service
  await cache.delete(`cache:profiles:${userId}`);

  // Also clear feed cache for this user
  await cache.delete(`${CacheService.KEYS.FEED_DATA}:${userId}`);

  console.log('[CacheInvalidation] Profile picture cache invalidated completely');
}

/**
 * Invalidate notification cache for a user
 */
export async function invalidateNotificationCache(userId: string): Promise<void> {
  console.log(`[CacheInvalidation] Invalidating notification cache for: ${userId}`);
  await hybridCache.delete(`notifications:${userId}`);
}

/**
 * Invalidate blocked users cache
 * Call this after blocking or unblocking a user
 */
export async function invalidateBlockedUsersCache(userId: string): Promise<void> {
  console.log(`[CacheInvalidation] Invalidating blocked users cache for: ${userId}`);
  await cache.delete(`${CacheService.KEYS.USER_METADATA}:blocked:${userId}`);

  // Also clear feed cache since blocked users affect feed content
  await cache.delete(`${CacheService.KEYS.FEED_DATA}:${userId}`);
  console.log('[CacheInvalidation] Blocked users and feed cache invalidated');
}

/**
 * Invalidate feed cache for a user
 * Call this when new posts are created or feed should be refreshed
 */
export async function invalidateFeedCache(userId: string): Promise<void> {
  console.log(`[CacheInvalidation] Invalidating feed cache for: ${userId}`);
  await cache.delete(`${CacheService.KEYS.FEED_DATA}:${userId}`);
}

/**
 * Invalidate location cache
 * Call this to force fresh location fetch
 */
export async function invalidateLocationCache(): Promise<void> {
  console.log(`[CacheInvalidation] Invalidating location cache`);
  const { clearLocationCache } = await import('./location');
  await clearLocationCache();
}

/**
 * Clear all user caches (use on logout)
 */
export async function clearAllUserCaches(): Promise<void> {
  console.log('[CacheInvalidation] Clearing all user caches');
  await hybridCache.clearAll();
  await cache.clearAll();
  console.log('[CacheInvalidation] All caches cleared');
}

/**
 * Warm up caches for better performance
 * Call this after login or app startup
 */
export async function warmUpUserCache(userId: string): Promise<void> {
  console.log(`[CacheInvalidation] Warming up cache for user: ${userId}`);
  // Keys will be populated on first access
  // This is just a placeholder for future implementation
}
