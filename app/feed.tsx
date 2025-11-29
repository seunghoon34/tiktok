import { View, FlatList, Dimensions, AppStateStatus, AppState, TouchableOpacity, RefreshControl,Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { useCallback, useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MediaItemComponent } from '@/components/mediaItem';
import SimpleSpinner from '@/components/simpleSpinner';
import Header from '@/components/header';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mediaCache } from '@/utils/mediaCache';
import { feedCache, CachedFeedItem } from '@/utils/feedCache';

interface MediaItem {
  uri: string;
  signedUrl: string;
  type: 'video' | 'picture';
  User: {
    username: string;
    id: string;
  };
  title: string;
  id: string;
  displayId: string;
  is_muted: boolean;
  expired_at: string;
  created_at: string;
  user_id?: string;
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

export default function HomeScreen() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [mute, setMute] = useState(false);
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const lastFocusTimeRef = useRef<number>(Date.now());
  const REFRESH_THRESHOLD = 1 * 60 * 1000;
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [videoIds, setVideoIds] = useState<Set<string>>(new Set());
  const [screenReady, setScreenReady] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
  
    // Subscribe to UserBlock changes where current user is the blocker
    const blockerSubscription = supabase
      .channel('userblock-blocker')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'UserBlock', 
          filter: `blocker_id=eq.${user.id}` }, 
        async (payload) => {
          console.log('UserBlock change detected (as blocker):', payload)
          await feedCache.invalidateFeed(user.id);
          setIsLoading(true)
          onRefresh()
          setIsLoading(false)
      })
      .subscribe();

    // Subscribe to UserBlock changes where current user is blocked
    const blockedSubscription = supabase
      .channel('userblock-blocked')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'UserBlock', 
          filter: `blocked_id=eq.${user.id}` }, 
        async (payload) => {
          console.log('UserBlock change detected (as blocked):', payload)
          await feedCache.invalidateFeed(user.id);
          setIsLoading(true)
          onRefresh()
          setIsLoading(false)
      })
      .subscribe();
  
    return () => {
      blockerSubscription.unsubscribe();
      blockedSubscription.unsubscribe();
    };
  }, [user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setVideos([]);
    getVideos(false).then(() => setRefreshing(false));
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 300,
  }).current;

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    const visibleIndexes = viewableItems.map((item: any) => item.index);
    setVisibleItems(visibleIndexes);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      const currentTime = Date.now();
      const timeSinceLastFocus = currentTime - lastFocusTimeRef.current;
      if (timeSinceLastFocus > REFRESH_THRESHOLD) {
        getVideos();
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      }
      return () => {
        lastFocusTimeRef.current = Date.now();
        setIsScreenFocused(false);
      };
    }, [])
  );

  useEffect(() => {
    getVideos();
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setIsScreenFocused(false);
      } else if (nextAppState === 'active') {
        setIsScreenFocused(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const getSignedUrls = async (media: CachedFeedItem[], loadMore = false) => {
    if (!media || media.length === 0) return;

    console.log(`[Feed] Processing ${media.length} media items for signed URLs`);
    
    // Use media cache for efficient URL generation
    const processedMedia = await mediaCache.processMediaItems(
      media.map(item => ({ uri: item.uri, id: item.id, type: item.type })),
      'videos'
    );

    const timestamp = Date.now();
    let mediaUrls = processedMedia?.map((item, index) => ({
      ...media[index], // Keep all original properties
      displayId: loadMore ? `${item.id}-${timestamp}-${index}` : item.id, // Use this for FlatList key
      id: item.id, // Keep original ID for database operations
      signedUrl: item.signedUrl || '',
      is_muted: media[index].is_muted ?? false,
      expired_at: media[index].expired_at ?? '',
      created_at: media[index].created_at ?? '',
    })) as MediaItem[];
    
    setVideos(prev => [...prev, ...mediaUrls]);
    console.log(`[Feed] Updated videos length: ${videos.length + mediaUrls.length}`);
  };  

  const getVideos = async (loadMore = false) => {
    try {
      if (!loadMore) {
        setIsLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Use feed cache for smart loading
      const feedResult = await feedCache.getFeedWithSync(user.id, loadMore);
      
      console.log(`[Feed] Loaded ${feedResult.items.length} items from ${feedResult.source}`);
      if (feedResult.hasNewItems) {
        console.log(`[Feed] Found ${feedResult.newItemCount} new items`);
      }

      // Process with media cache for signed URLs
      await getSignedUrls(feedResult.items, loadMore);
      
    } catch (error) {
      console.error('[Feed] Error fetching videos:', error);
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  };

  const renderMediaItem = ({ item, index }: { item: MediaItem; index: number }) => {
    const isVisible = visibleItems.includes(index);
    return (
      <MediaItemComponent
        item={item}
        isVisible={isVisible}
        isScreenFocused={isScreenFocused}
        mute={mute}
        onMuteChange={() => setMute(!mute)}
      />
    );
  };

  // Get safe screen dimensions with validation
  const screenDimensions = Dimensions.get('window');
  const SCREEN_HEIGHT = screenDimensions.height || 800; // Fallback for iPad issue
  const SCREEN_WIDTH = screenDimensions.width || 600;
  
  // Debug logging for dimensions
  console.log('[Feed] Screen Dimensions:', {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    original: screenDimensions
  });

  // Wait for valid screen dimensions before rendering feed
  useEffect(() => {
    const checkDimensions = () => {
      const dims = Dimensions.get('window');
      if (dims.width > 0 && dims.height > 0) {
        setScreenReady(true);
        console.log('[Feed] Screen ready:', dims);
      } else {
        console.log('[Feed] Waiting for valid dimensions...', dims);
        setTimeout(checkDimensions, 100);
      }
    };
    checkDimensions();
  }, []);

  const handleLoadMore = () => {
    console.log("Loading more videos...");
    if (isLoading || loadingMore) return;
    getVideos(true);
  };

  return (
    <View className="flex-1 bg-black">
      {
        !screenReady ? (
          <SafeAreaView className="flex-1 bg-black">
            <Header title="" color="white" goBack={true}/>
            <View className="flex-1 items-center justify-center">
              <SimpleSpinner size={60} />
              <Text className="text-white mt-4 text-lg">Initializing screen...</Text>
            </View>
          </SafeAreaView>
        ) : isLoading ? (
          <SafeAreaView className="flex-1 bg-black">
            <Header title="" color="white" goBack={true}/>
            <View className="flex-1 items-center justify-center">
              <SimpleSpinner size={60} />
              <Text className="text-white mt-4 text-lg">Loading feed...</Text>
            </View>
          </SafeAreaView>
        ) :
      videos.length === 0? (
        
        <SafeAreaView className="flex-1">
  <Header title="" color="white" goBack={true}/>
  <View className="flex-1 items-center justify-center">
    <Text className='text-white'>No shots at the moment</Text>
  </View>
</SafeAreaView>
) : (
        <FlatList
          ref={flatListRef}
          data={videos}
          renderItem={renderMediaItem}
          keyExtractor={(item) => item.displayId || item.id}          
          pagingEnabled={true}
          snapToAlignment="center"
          decelerationRate="fast"
          disableIntervalMomentum={true}
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_HEIGHT}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 0 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={2}
          windowSize={3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
              title="Pull to refresh"
              titleColor="#fff"
              progressViewOffset={40}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}