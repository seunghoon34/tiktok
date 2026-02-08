import { supabase } from './supabase';
import { cache, CacheService } from './cache';

export interface CachedProfile {
  user_id: string;
  profilepicture: string | null; // This will be the processed public URL
  name: string;
  birthdate: string;
  aboutme: string;
  username: string;
  role: string | null; // User's vibe/role for colored ring
  processed_at: number; // When the profile picture URL was processed
}

export class ProfileCacheService {
  private static instance: ProfileCacheService;
  
  public static getInstance(): ProfileCacheService {
    if (!ProfileCacheService.instance) {
      ProfileCacheService.instance = new ProfileCacheService();
    }
    return ProfileCacheService.instance;
  }

  private constructor() {}

  /**
   * Get cached profile or fetch from database
   */
  async getProfile(userId: string): Promise<CachedProfile | null> {
    try {
      const cacheKey = `${CacheService.KEYS.PROFILES}:${userId}`;
      
      // Try to get from cache first
      const cached = await cache.get<CachedProfile>(cacheKey);
      if (cached) {
        console.log(`[ProfileCache] Using cached profile for user: ${userId}`);
        return cached;
      }

      // Not in cache, fetch from database
      console.log(`[ProfileCache] Fetching profile for user: ${userId}`);
      const profile = await this.fetchProfileFromDB(userId);
      
      if (profile) {
        // Cache the processed profile
        await cache.set(cacheKey, profile, CacheService.TTL.PROFILES);
        console.log(`[ProfileCache] Cached profile for user: ${userId}`);
      }
      
      return profile;
    } catch (error) {
      console.error(`[ProfileCache] Error getting profile for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Fetch profile from database and process profile picture URL
   */
  private async fetchProfileFromDB(userId: string): Promise<CachedProfile | null> {
    try {
      const { data, error } = await supabase
        .from('UserProfile')
        .select(`
          *,
          user:User (
            username
          )
        `)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        console.error(`[ProfileCache] Error fetching profile from DB for ${userId}:`, error);
        return null;
      }

      // Process profile picture URL if it exists
      let profilePictureUrl: string | null = null;
      if (data.profilepicture) {
        const { data: publicData, error: storageError } = supabase.storage
          .from('profile_images')
          .getPublicUrl(data.profilepicture);
        
        if (!storageError && publicData?.publicUrl) {
          // Add cache-busting timestamp to force image reload when profile picture changes
          // This ensures browsers don't serve stale cached images
          const cacheBuster = `?t=${Date.now()}`;
          profilePictureUrl = publicData.publicUrl + cacheBuster;
        }
      }

      const processedProfile: CachedProfile = {
        user_id: data.user_id,
        profilepicture: profilePictureUrl,
        name: data.name,
        birthdate: data.birthdate,
        aboutme: data.aboutme,
        username: data.user?.username || '',
        role: data.role || null,
        processed_at: Date.now()
      };

      return processedProfile;
    } catch (error) {
      console.error(`[ProfileCache] Exception fetching profile for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Invalidate cached profile (call when profile is updated)
   */
  async invalidateProfile(userId: string): Promise<void> {
    const cacheKey = `${CacheService.KEYS.PROFILES}:${userId}`;
    await cache.delete(cacheKey);
    console.log(`[ProfileCache] Invalidated cache for user: ${userId}`);
  }

  /**
   * Preload multiple profiles (useful for feed/chat lists)
   */
  async preloadProfiles(userIds: string[]): Promise<void> {
    console.log(`[ProfileCache] Preloading ${userIds.length} profiles...`);
    
    // Process in parallel but limit concurrency
    const batchSize = 5;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      await Promise.all(batch.map(userId => this.getProfile(userId)));
    }
    
    console.log(`[ProfileCache] Preloading completed`);
  }

  /**
   * Get multiple profiles at once
   */
  async getProfiles(userIds: string[]): Promise<Record<string, CachedProfile | null>> {
    const results: Record<string, CachedProfile | null> = {};
    
    // Process in parallel
    const promises = userIds.map(async (userId) => {
      const profile = await this.getProfile(userId);
      results[userId] = profile;
    });
    
    await Promise.all(promises);
    return results;
  }

  /**
   * Update profile in cache (call after profile update)
   */
  async updateCachedProfile(userId: string, updates: Partial<CachedProfile>): Promise<void> {
    const cacheKey = `${CacheService.KEYS.PROFILES}:${userId}`;
    const existing = await cache.get<CachedProfile>(cacheKey);
    
    if (existing) {
      const updated = { ...existing, ...updates, processed_at: Date.now() };
      await cache.set(cacheKey, updated, CacheService.TTL.PROFILES);
      console.log(`[ProfileCache] Updated cached profile for user: ${userId}`);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    cachedProfiles: number;
    cacheSize: number;
  }> {
    const allStats = await cache.getStats();
    return {
      cachedProfiles: allStats.entriesByType.profiles || 0,
      cacheSize: allStats.totalSize
    };
  }
}

// Export singleton instance
export const profileCache = ProfileCacheService.getInstance();
