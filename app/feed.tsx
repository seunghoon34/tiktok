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
  displayId: string
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
  
    const subscription = supabase
      .channel('public:UserBlock')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'UserBlock', 
          filter: `blocker_id=eq.${user.id},blocked_id=eq.${user.id}` }, 
        () => {
          setIsLoading(true)
          onRefresh()
          setIsLoading(false)
      })
      .subscribe();
  
    return () => {
      subscription.unsubscribe();
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

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    const visibleIndexes = viewableItems.map(item => item.index);
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

  const getSignedUrls = async (media: MediaItem[], loadMore = false) => {
    if (!media || media.length === 0) return;

    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUrls(
        media.map((item) => item.uri),
        60 * 60 * 24
      );

    const timestamp = Date.now();
    let mediaUrls = media?.map((item, index) => ({
      ...item,
      displayId: loadMore ? `${item.id}-${timestamp}-${index}` : item.id, // Use this for FlatList key
      id: item.id, // Keep original ID for database operations
      signedUrl: data?.find((signedUrl) => signedUrl.path === item.uri)?.signedUrl
    }));
    
    setVideos(prev => [...prev, ...mediaUrls]);
    console.log('Updated videos length:', videos.length + mediaUrls.length);
  };  

  const getVideos = async (loadMore = false) => {
    try {
      if (!loadMore) {
        setIsLoading(true);
      } else {
        setLoadingMore(true);
      }

      // First, get list of blocked users (both directions - users we blocked and users who blocked us)
      const { data: blockedUsers, error: blockError } = await supabase
        .from('UserBlock')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

      if (blockError) throw blockError;

      // Create array of user IDs to exclude (both blocked and blockers)
      const excludeUserIds = blockedUsers?.reduce((acc: string[], block) => {
        if (block.blocker_id === user.id) acc.push(block.blocked_id);
        if (block.blocked_id === user.id) acc.push(block.blocker_id);
        return acc;
      }, []);

      // Add current user's ID to exclude list (we already exclude this, but being explicit)
      excludeUserIds.push(user.id);

      // Get videos excluding blocked users
      const { data, error } = await supabase
  .from('Video')
  .select(`
    *,
    User(username, id),
    TextOverlay(
      text,
      position_x,
      position_y,
      scale,
      rotation,
      font_size,
      media_width,
      media_height,
      screen_width,
      screen_height
    )
  `)
  .not(excludeUserIds.length > 0 ? 'user_id' : 'id', 
       excludeUserIds.length > 0 ? 'in' : 'eq', 
       excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : user.id)
  .gt('expired_at', new Date().toISOString())
  .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const mediaWithTypes = data?.map(item => ({
        ...item,
        type: item.uri.toLowerCase().endsWith('.mov') ? 'video' : 'picture',
      }));

      await getSignedUrls(mediaWithTypes, loadMore);
      
    } catch (error) {
      console.error('Error fetching videos:', error);
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
          keyExtractor={(item) => item.displayId}          
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
          onEndReachedThresholdRelative={0.5}
        />
      )}
    </View>
  );
}