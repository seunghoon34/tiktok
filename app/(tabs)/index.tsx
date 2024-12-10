import { View, Text, Dimensions, FlatList, Image, Pressable, Animated, AppStateStatus, AppState, TouchableOpacity, RefreshControl } from 'react-native';
import "../../global.css";
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Video, ResizeMode } from 'expo-av';
import Ionicons from '@expo/vector-icons/Ionicons';

// Add type for media item
interface MediaItem {
  uri: string;
  signedUrl: string;
  type: 'video' | 'picture';  // Add a type field to distinguish between media types
  User: {
    username: string;
    id: string
  };
  title: string;
}

export default function HomeScreen() {
  const { signOut, user } = useAuth();
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const videoRef = useRef<Video>(null);
  const [mute, setMute] = useState(false)
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const lastFocusTimeRef = useRef<number>(Date.now());
  const REFRESH_THRESHOLD = 1 * 60 * 1000;
  const router = useRouter()

  const [refreshing, setRefreshing] = useState(false);

// Add refresh handler
const onRefresh = useCallback(() => {
  setRefreshing(true);
  getVideos().then(() => setRefreshing(false));
}, []);
  


  
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 300,
  }).current;

  const onViewableItemsChanged = useCallback(({ changed, viewableItems }) => {
    const visibleIndexes = viewableItems.map(item => item.index);
    setVisibleItems(visibleIndexes);
  }, [])

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
        // This runs when screen loses focus
        lastFocusTimeRef.current = Date.now();
        setIsScreenFocused(false);
      };
    }, [])
  );

  useEffect(() => {
    getVideos()
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
    
    // Add type checking based on file extension
    const mediaWithTypes = data?.map(item => ({
      ...item,
      type: item.uri.toLowerCase().endsWith('.mov') ? 'video' : 'picture',
      
    }));
    
    getSignedUrls(mediaWithTypes);
  };

  const [showMuteIcon, setShowMuteIcon] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Function to handle icon animation
  const showMuteIconWithFade = () => {
    setShowMuteIcon(true);
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1000), // Show icon for 1 second
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowMuteIcon(false));
  };

  const renderMediaItem = ({ item, index }: { item: MediaItem; index: number }) => {
    const mediaStyle = {
      width: Dimensions.get('window').width,
      height: Dimensions.get('window').height,
      flex: 1,
      top: 0,

    };

    const isVisible = visibleItems.includes(index);
    const shouldPlayVideo = isVisible && isScreenFocused;

  
    return (
      <Pressable 
        onPress={() => {setMute(!mute); showMuteIconWithFade()}}
        style={mediaStyle}
      >
        <>

        {item.type === 'video' ? (
          <>
          <Video
            source={{ uri: item.signedUrl }}
            style={[mediaStyle, { position: 'absolute' }]}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={shouldPlayVideo}
            isMuted={mute}
          />
          {showMuteIcon && (
              <Animated.View style={[{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: [
                  { translateX: -25 }, // Half of icon size
                  { translateY: -25 }, // Half of icon size
                  
                ],
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 50,
                padding: 15,
                zIndex: 10,
              }, {
                opacity: fadeAnim
              }]}>
                <Ionicons 
                  name={mute ? 'volume-mute' : 'volume-high'} 
                  size={25} 
                  color="white"
                />
              </Animated.View>
            )}
          </>
        ) : (
          <Image
            source={{ uri: item.signedUrl }}
            style={mediaStyle}
            resizeMode="cover"
          />
        )}
        </>
        <View style={{
          position: 'absolute',
          bottom: 50,
          left: 10,
          padding: 10,  // Optional: adds some space from the edges
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '95%'
        }}
     
        >
          <View style={{flexDirection: 'row'}}>
            <TouchableOpacity onPress={() => router.push(`/user?user_id=${item.User.id}`)}>
          <Ionicons name="add-circle-sharp" size={50} color="black" />
          </TouchableOpacity>
          <View>
          <Text className='text-2xl font-bold'>{item.User.username}</Text>
          <Text className='text-2xl'>{item.title}</Text>
          </View>
          </View>
          <TouchableOpacity>
          <Ionicons name="heart-outline" size={50} color="red"/>
          </TouchableOpacity>
        </View>
       
      </Pressable>
    );
  };

  return (
    <View className="flex-1  bg-black">
      <FlatList
      ref={flatListRef}
  data={videos}
  renderItem={renderMediaItem}
  keyExtractor={(item) => item.uri}
  pagingEnabled={true}  // Enable snap scrolling
  snapToAlignment="center"
  decelerationRate="fast"
  disableIntervalMomentum={true}
  showsVerticalScrollIndicator={false}
  snapToInterval={Dimensions.get('window').height} // Snap to full height
  viewabilityConfig={viewabilityConfig}
  onViewableItemsChanged={onViewableItemsChanged}
  style={{ flex: 1, }}
  contentContainerStyle={{ flexGrow: 1, paddingBottom: 0, paddingTop: 0}} // Ensure no paddingmargin: 0,  // Ensure no margin }}
  removeClippedSubviews={true} // Add this for better performance
  maxToRenderPerBatch={2} // Limit number of items rendered at once
  windowSize={3} // Reduce window size for better performance
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="#fff"  // Color of the loading spinner
      title="Pull to refresh"  // Only shown on iOS
      titleColor="#fff"
      progressViewOffset={40}  // Adjust this value to position the refresh indicator
    />
  }
  
  
/>

    </View>
  );
}