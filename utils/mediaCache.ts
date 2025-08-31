import { supabase } from './supabase';
import { cache, CacheService } from './cache';

export interface CachedMediaUrl {
  uri: string;           // Original file path
  signedUrl: string;     // Generated signed URL
  expires_at: number;    // When the signed URL expires (timestamp)
  cached_at: number;     // When we cached it
  bucket: string;        // Storage bucket name
}

export interface MediaItem {
  uri: string;
  id: string;
  type?: 'video' | 'picture';
  signedUrl?: string;
}

export class MediaCacheService {
  private static instance: MediaCacheService;
  
  public static getInstance(): MediaCacheService {
    if (!MediaCacheService.instance) {
      MediaCacheService.instance = new MediaCacheService();
    }
    return MediaCacheService.instance;
  }

  private constructor() {}

  private getMediaKey(bucket: string, uri: string): string {
    return `${CacheService.KEYS.MEDIA_URLS}:${bucket}:${uri}`;
  }

  /**
   * Get signed URL from cache or generate fresh one
   */
  async getSignedUrl(bucket: string, uri: string, expiresInSeconds: number = 24 * 60 * 60): Promise<string | null> {
    try {
      const cacheKey = this.getMediaKey(bucket, uri);
      
      // Try to get from cache first
      const cached = await cache.get<CachedMediaUrl>(cacheKey);
      if (cached) {
        // Check if signed URL is still valid (with 1 hour buffer)
        const now = Date.now();
        const oneHourBuffer = 60 * 60 * 1000;
        
        if (cached.expires_at > (now + oneHourBuffer)) {
          console.log(`[MediaCache] Using cached signed URL for: ${uri}`);
          return cached.signedUrl;
        } else {
          console.log(`[MediaCache] Cached URL expired for: ${uri}`);
          await cache.delete(cacheKey);
        }
      }

      // Generate fresh signed URL
      console.log(`[MediaCache] Generating fresh signed URL for: ${uri}`);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(uri, expiresInSeconds);

      if (error || !data?.signedUrl) {
        console.error(`[MediaCache] Error generating signed URL for ${uri}:`, error);
        return null;
      }

      // Cache the new signed URL
      const cachedMedia: CachedMediaUrl = {
        uri,
        signedUrl: data.signedUrl,
        expires_at: Date.now() + (expiresInSeconds * 1000),
        cached_at: Date.now(),
        bucket
      };

      await cache.set(cacheKey, cachedMedia, CacheService.TTL.MEDIA_URLS);
      console.log(`[MediaCache] Cached signed URL for: ${uri}`);
      
      return data.signedUrl;
    } catch (error) {
      console.error(`[MediaCache] Exception getting signed URL for ${uri}:`, error);
      return null;
    }
  }

  /**
   * Get multiple signed URLs efficiently (batch processing)
   */
  async getSignedUrls(bucket: string, uris: string[], expiresInSeconds: number = 24 * 60 * 60): Promise<Record<string, string | null>> {
    try {
      console.log(`[MediaCache] Processing ${uris.length} URLs for batch signing`);
      
      const results: Record<string, string | null> = {};
      const uncachedUris: string[] = [];
      
      // Check cache for each URI
      for (const uri of uris) {
        const cacheKey = this.getMediaKey(bucket, uri);
        const cached = await cache.get<CachedMediaUrl>(cacheKey);
        
        if (cached) {
          const now = Date.now();
          const oneHourBuffer = 60 * 60 * 1000;
          
          if (cached.expires_at > (now + oneHourBuffer)) {
            results[uri] = cached.signedUrl;
          } else {
            uncachedUris.push(uri);
            await cache.delete(cacheKey);
          }
        } else {
          uncachedUris.push(uri);
        }
      }

      console.log(`[MediaCache] Found ${Object.keys(results).length} cached URLs, generating ${uncachedUris.length} fresh URLs`);

      // Generate fresh URLs for uncached items
      if (uncachedUris.length > 0) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(uncachedUris, expiresInSeconds);

        if (error) {
          console.error('[MediaCache] Error generating batch signed URLs:', error);
        } else if (data) {
          // Cache the new URLs and add to results
          for (const signedUrlData of data) {
            if (signedUrlData.signedUrl) {
              const uri = signedUrlData.path;
              results[uri] = signedUrlData.signedUrl;

              // Cache the new signed URL
              const cachedMedia: CachedMediaUrl = {
                uri,
                signedUrl: signedUrlData.signedUrl,
                expires_at: Date.now() + (expiresInSeconds * 1000),
                cached_at: Date.now(),
                bucket
              };

              const cacheKey = this.getMediaKey(bucket, uri);
              await cache.set(cacheKey, cachedMedia, CacheService.TTL.MEDIA_URLS);
            }
          }
        }
      }

      // Fill in any failed URLs with null
      for (const uri of uris) {
        if (!(uri in results)) {
          results[uri] = null;
        }
      }

      console.log(`[MediaCache] Batch processing complete: ${Object.keys(results).length} URLs processed`);
      return results;
    } catch (error) {
      console.error('[MediaCache] Exception in batch signed URL generation:', error);
      
      // Return null for all URIs on error
      const results: Record<string, string | null> = {};
      for (const uri of uris) {
        results[uri] = null;
      }
      return results;
    }
  }

  /**
   * Process media items and add signed URLs
   */
  async processMediaItems(mediaItems: MediaItem[], bucket: string = 'videos'): Promise<MediaItem[]> {
    try {
      const uris = mediaItems.map(item => item.uri);
      const signedUrls = await this.getSignedUrls(bucket, uris);
      
      return mediaItems.map(item => ({
        ...item,
        signedUrl: signedUrls[item.uri] || undefined
      }));
    } catch (error) {
      console.error('[MediaCache] Error processing media items:', error);
      return mediaItems; // Return original items on error
    }
  }

  /**
   * Preload signed URLs for upcoming content
   */
  async preloadUrls(bucket: string, uris: string[], expiresInSeconds: number = 24 * 60 * 60): Promise<void> {
    try {
      console.log(`[MediaCache] Preloading ${uris.length} URLs...`);
      await this.getSignedUrls(bucket, uris, expiresInSeconds);
      console.log(`[MediaCache] Preloading completed`);
    } catch (error) {
      console.error('[MediaCache] Error preloading URLs:', error);
    }
  }

  /**
   * Clear expired URLs from cache
   */
  async clearExpiredUrls(): Promise<void> {
    try {
      // This will be handled by the general cache cleanup
      // since we use TTL for media URLs
      console.log('[MediaCache] Expired URLs will be cleared by general cache cleanup');
    } catch (error) {
      console.error('[MediaCache] Error clearing expired URLs:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    cachedUrls: number;
    cacheSize: number;
  }> {
    try {
      const allStats = await cache.getStats();
      return {
        cachedUrls: allStats.entriesByType.media_urls || 0,
        cacheSize: allStats.totalSize
      };
    } catch (error) {
      console.error('[MediaCache] Error getting stats:', error);
      return { cachedUrls: 0, cacheSize: 0 };
    }
  }

  /**
   * Clear specific URL from cache
   */
  async clearUrl(bucket: string, uri: string): Promise<void> {
    try {
      const cacheKey = this.getMediaKey(bucket, uri);
      await cache.delete(cacheKey);
      console.log(`[MediaCache] Cleared cache for: ${uri}`);
    } catch (error) {
      console.error(`[MediaCache] Error clearing URL ${uri}:`, error);
    }
  }
}

// Export singleton instance
export const mediaCache = MediaCacheService.getInstance();
