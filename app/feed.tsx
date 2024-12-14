import { View, FlatList, Dimensions, AppStateStatus, AppState, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { useCallback, useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MediaItemComponent } from '@/components/mediaItem';
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getVideos().then(() => setRefreshing(false));
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

  const getSignedUrls = async (media: MediaItem[]) => {
    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUrls(
        media.map((item) => item.uri),
        60 * 60 * 24
      );

    let mediaUrls = media?.map((item) => {
      item.signedUrl = data?.find((signedUrl) => signedUrl.path === item.uri)?.signedUrl;
      return item;
    });
    setVideos(mediaUrls);
  };

  const getVideos = async () => {
    const { data, error } = await supabase
      .from('Video')
      .select('*, User(username, id)')
      .order('created_at', { ascending: false });
    
    const mediaWithTypes = data?.map(item => ({
      ...item,
      type: item.uri.toLowerCase().endsWith('.mov') ? 'video' : 'picture',
    }));
    
    getSignedUrls(mediaWithTypes);
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

  return (
    <View className="flex-1 bg-black">
      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={renderMediaItem}
        keyExtractor={(item) => item.uri}
        pagingEnabled={true}
        snapToAlignment="center"
        decelerationRate="fast"
        disableIntervalMomentum={true}
        showsVerticalScrollIndicator={false}
        snapToInterval={Dimensions.get('window').height}
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
      />
      <View style={{
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 999,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name='chevron-back' size={40} color="white"/>
        </TouchableOpacity>
      </View>
    </View>
  );
}