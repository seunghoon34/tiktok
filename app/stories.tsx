import React from 'react';
import { View, Pressable, Dimensions, TouchableOpacity, Text, Animated, Platform, PixelRatio } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Video, ResizeMode } from 'expo-av';
import { Image } from 'react-native';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/providers/AuthProvider';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Modalize } from 'react-native-modalize';
import { Portal } from 'react-native-portalize';
import Toast from 'react-native-toast-message';
import LoadingScreen from '@/components/loading';

type Story = {
  id: string;
  uri: string;
  type: 'video' | 'image';
  signedUrl?: string;
  user_id: string;
  created_at: string;
  is_muted: boolean;
  expired_at: string;
  TextOverlay?: Array<{
    text: string;
    position_x: number;
    position_y: number;
    scale: number;
    rotation: number;
    font_size: number;
  }>;
}

export default function Mystoryscreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stories, setStories] = useState<Story[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [isTextLoading, setIsTextLoading] = useState(true);
  const [mute, setMute] = useState(false);
  const [mediaType, setMediaType] = useState('');
  const [showMuteIcon, setShowMuteIcon] = useState(false);
  
  const modalRef = useRef<Modalize>(null);
  const videoRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const router = useRouter();
  const { user } = useAuth();
  const screenWidth = Dimensions.get('window').width;

  const isContentLoading = isMediaLoading || isTextLoading || initialLoading;
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

  const BASE_SCREEN_WIDTH = 393;
const BASE_SCREEN_HEIGHT = 852;

// Scale factors
const widthScaleFactor = SCREEN_WIDTH / BASE_SCREEN_WIDTH;
const heightScaleFactor = SCREEN_HEIGHT / BASE_SCREEN_HEIGHT;
const scaleFactor = Math.min(widthScaleFactor, heightScaleFactor);

// Normalize font size based on screen size
const normalizeFont = (size: number) => { 
  const scale = scaleFactor;
  const newSize = size * scale;
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};


  const renderTextOverlays = () => {
    console.log('Screen Dimensions:', {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      aspectRatio: SCREEN_WIDTH / SCREEN_HEIGHT
    });
    return stories[currentIndex]?.TextOverlay?.map((overlay, index) => (
      <Animated.View
        key={index}
        style={[{
          position: 'absolute',
          left: (overlay.position_x / 100) * SCREEN_WIDTH,
          top: (overlay.position_y / 100) * SCREEN_HEIGHT,
          minWidth: 100,
          maxWidth: '80%',
          transform: [
            { scale: overlay.scale / scaleFactor }, // Adjust back for device scale
            { rotate: `${overlay.rotation}rad` }
          ],
        }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Text
            style={{
              color: 'white',
              fontSize: normalizeFont((overlay.font_size / 100) * BASE_SCREEN_HEIGHT),
            }}
          >
            {overlay.text}
          </Text>
        </View>
      </Animated.View>
    ));
  };

  useEffect(() => {
    // Reset loading states when index changes
    setIsMediaLoading(true);
    setIsTextLoading(true);
    
    // Check file extension
    const fileExt = stories[currentIndex]?.uri.split('.').pop()?.toLowerCase();
    setMediaType(fileExt === 'mov' ? 'video' : 'image');
    
    // Set text loading to false once we have the data
    if (stories[currentIndex]?.TextOverlay !== undefined) {
      setIsTextLoading(false);
    }
  }, [currentIndex, stories]);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const { data, error } = await supabase
        .from('Video')
        .select(`
          *,
          TextOverlay (
            text,
            position_x,
            position_y,
            scale,
            rotation,
            font_size
          )
        `)
        .eq('user_id', user?.id)
        .gt('expired_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const storiesWithUrls = await Promise.all(
        data.map(async (story) => {
          const { data: signedUrl } = await supabase.storage
            .from('videos')
            .createSignedUrl(story.uri, 3600);

          return {
            ...story,
            signedUrl: signedUrl?.signedUrl,
          };
        })
      );

      setStories(storiesWithUrls);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const showMuteIconWithFade = () => {
    setShowMuteIcon(true);
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1000),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowMuteIcon(false));
  };

  const handlePress = (event: any) => {
    const touchX = event.nativeEvent.locationX;
    
    if (touchX < screenWidth * 0.3) {
      if (currentIndex > 0) {
        setIsMediaLoading(true);
      setIsTextLoading(true);
        setCurrentIndex(currentIndex - 1);
      } else {
        router.back();
      }
    } else if (touchX > screenWidth * 0.7) {
      setIsMediaLoading(true);
      setIsTextLoading(true);
      if (currentIndex < stories.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        router.back();
      }
    } else {
      if (stories[currentIndex].is_muted === false && stories[currentIndex].type === 'video') {
        setMute(!mute);
        showMuteIconWithFade();
      }
    }
  };

  const formatTimeDifference = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt + 'Z');
    const diffInMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);

    if (diffInHours >= 3) return '3h';
    if (diffInHours >= 1) return `${diffInHours}h`;
    return `${diffInMinutes}m`;
  };

  const handleDelete = async () => {
    try {
      const story = stories[currentIndex];
      await supabase.from('Video').delete().eq('id', story.id);

      const newStories = stories.filter((_, index) => index !== currentIndex);
      setStories(newStories);
      
      if (newStories.length === 0) {
        router.back();
      } else if (currentIndex >= newStories.length) {
        setCurrentIndex(newStories.length - 1);
      }

      modalRef.current?.close();
      Toast.show({ type: 'success', text1: 'Story deleted' });
    } catch (error) {
      console.error('Error:', error);
      Toast.show({ type: 'error', text1: 'Failed to delete' });
    }
  };

  if (initialLoading || stories.length === 0) return <LoadingScreen />;

  return (
    <View className="flex-1 bg-black">
      <Pressable onPress={handlePress} className="flex-1">
        {mediaType === 'video' ? (
          <>
            <Video
              ref={videoRef}
              source={{ uri: stories[currentIndex].signedUrl }}
              style={{
                width: Dimensions.get('window').width,
                height: Dimensions.get('window').height,
                position: 'absolute',
                top: 0
              }}
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay={true}
              isMuted={stories[currentIndex].is_muted || mute}
              onLoadStart={() => setIsMediaLoading(true)}
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded && !status.isBuffering) {
                  setIsMediaLoading(false);
                }
              }}
            />
            {!isContentLoading && renderTextOverlays()}
            {isContentLoading && (
              <View style={{
                position: 'absolute',
                width: Dimensions.get('window').width,
                height: Dimensions.get('window').height,
                zIndex: 1,
                backgroundColor: 'black'
              }}>
                <LoadingScreen />
              </View>
            )}
          </>
        ) : (
          <>
            <Image
              source={{ uri: stories[currentIndex].signedUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              onLoadStart={() => setIsMediaLoading(true)}
              onLoad={() => setIsMediaLoading(false)}
            />
            {!isContentLoading && renderTextOverlays()}
            {isContentLoading && (
              <View style={{
                position: 'absolute',
                width: Dimensions.get('window').width,
                height: Dimensions.get('window').height,
                zIndex: 1,
                backgroundColor: 'black'
              }}>
                <LoadingScreen />
              </View>
            )}
          </>
        )}

        {/* Progress bar */}
        <View className="absolute bottom-12 left-2 right-2 flex-row gap-1 z-10">
          {stories.map((_, index) => (
            <View
              key={index}
              className={`flex-1 h-0.5 ${
                index === currentIndex ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </View>

        {/* Top buttons */}
        <View className="absolute top-14 left-0 right-0 px-5 flex-row justify-between z-10">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={30} color="white"/>
          </TouchableOpacity>
          <Text className="text-lg font-extrabold text-white ml-2">
            {formatTimeDifference(stories[currentIndex].created_at)}
          </Text>
          <TouchableOpacity onPress={() => modalRef.current?.open()}>
            <Ionicons name="ellipsis-vertical" size={30} color="white"/>
          </TouchableOpacity>
        </View>

        {/* Mute icon */}
        {showMuteIcon && (
          <Animated.View 
            style={[{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: [
                { translateX: -25 },
                { translateY: -25 },
              ],
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 50,
              padding: 15,
              zIndex: 10,
            }, {
              opacity: fadeAnim
            }]}
          >
            <Ionicons 
              name={mute ? 'volume-mute' : 'volume-high'} 
              size={25} 
              color="white"
            />
          </Animated.View>
        )}
      </Pressable>

      <Portal>
        <Modalize
          ref={modalRef}
          adjustToContentHeight
          modalStyle={{ backgroundColor: '#1f1f1f', borderTopLeftRadius: 12 }}
          handleStyle={{ backgroundColor: '#636363', width: 40 }}
        >
          <View className="py-2 pb-10">
            <TouchableOpacity
              className="flex-row items-center px-4 py-3"
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={24} color="red" />
              <View className="ml-3">
                <Text className="text-red-500 text-base">Delete Story</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Modalize>
      </Portal>
      <Toast />
    </View>
  );
}