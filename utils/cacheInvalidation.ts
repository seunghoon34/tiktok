import { hybridCache } from './memoryCache';
import { cache } from './cache';
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
  
  // Invalidate from profileCache (used by mediaItem)
  await profileCache.invalidateProfile(userId);
  
  console.log(`[CacheInvalidation] Invalidated ${keysToInvalidate.length} cache keys + profileCache`);
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
  
  // Also clear any feed cache that might contain this user's posts
  const feedKeys = ['cache:feed_data', 'feed_cache'];
  await Promise.all(feedKeys.map(key => cache.delete(key)));
  
  console.log('[CacheInvalidation] Profile picture cache invalidated');
}

/**
 * Invalidate notification cache for a user
 */
export async function invalidateNotificationCache(userId: string): Promise<void> {
  console.log(`[CacheInvalidation] Invalidating notification cache for: ${userId}`);
  await hybridCache.delete(`notifications:${userId}`);
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
