import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Hardcoded radius limit (in kilometers)
// 20000km = half Earth's circumference (covers entire globe)
export const LOCATION_RADIUS_KM = 20000;

// Cache duration for location (10 minutes)
const LOCATION_CACHE_TTL = 10 * 60 * 1000;

interface CachedLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

/**
 * Request location permissions from user
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('[Location] Permission denied');
      return false;
    }
    
    console.log('[Location] Permission granted');
    return true;
  } catch (error) {
    console.error('[Location] Error requesting permission:', error);
    return false;
  }
}

/**
 * Check if location permission is granted
 */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[Location] Error checking permission:', error);
    return false;
  }
}

/**
 * Get current location with caching
 * Returns cached location if less than 10 minutes old
 */
export async function getCurrentLocation(forceRefresh: boolean = false): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // Check cache first
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem('cached_location');
      if (cached) {
        const cachedLocation: CachedLocation = JSON.parse(cached);
        const age = Date.now() - cachedLocation.timestamp;
        
        if (age < LOCATION_CACHE_TTL) {
          console.log(`[Location] Using cached location (${Math.round(age / 1000)}s old)`);
          return {
            latitude: cachedLocation.latitude,
            longitude: cachedLocation.longitude
          };
        }
      }
    }
    
    // Get fresh location
    console.log('[Location] Fetching fresh location...');
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced // Balance of accuracy and speed
    });
    
    const { latitude, longitude } = location.coords;
    
    // Cache the location
    const cacheData: CachedLocation = {
      latitude,
      longitude,
      timestamp: Date.now()
    };
    await AsyncStorage.setItem('cached_location', JSON.stringify(cacheData));
    
    console.log(`[Location] Fresh location obtained: ${latitude}, ${longitude}`);
    return { latitude, longitude };
    
  } catch (error) {
    console.error('[Location] Error getting location:', error);
    return null;
  }
}

/**
 * Clear cached location
 */
export async function clearLocationCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem('cached_location');
    console.log('[Location] Cache cleared');
  } catch (error) {
    console.error('[Location] Error clearing cache:', error);
  }
}

/**
 * Open device settings for the app
 */
export async function openSettings(): Promise<void> {
  try {
    await Location.enableNetworkProviderAsync();
  } catch (error) {
    console.error('[Location] Error opening settings:', error);
  }
}
