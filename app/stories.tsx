import React from 'react';
import { View, Pressable, Dimensions, TouchableOpacity, Text, Animated } from 'react-native';
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
import { convertOverlayPosition, getFixedContainerDimensions } from '@/utils/mediaPositioning';
import { mediaCache } from '@/utils/mediaCache';
import { feedCache } from '@/utils/feedCache';

// Get fixed 9:16 container dimensions for consistent cross-device display
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FIXED_CONTAINER = getFixedContainerDimensions(SCREEN_WIDTH, SCREEN_HEIGHT);

type Story = {
  id: string;
  uri: string;
  type: 'video' | 'image' | 'picture';
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
    media_width?: number;
    media_height?: number;
    screen_width?: number;
    screen_height?: number;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  
  const modalRef = useRef<Modalize>(null);
  const videoRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const router = useRouter();
  const { user } = useAuth();

  const isContentLoading = isMediaLoading || isTextLoading || initialLoading;


  const renderTextOverlays = () => {
    console.log('Fixed Container Dimensions:', {
      width: FIXED_CONTAINER.width,
      height: FIXED_CONTAINER.height,
      aspectRatio: FIXED_CONTAINER.width / FIXED_CONTAINER.height
    });
    return stories[currentIndex]?.TextOverlay?.map((overlay, index) => {
      // Use fixed 9:16 container dimensions for consistent positioning
      const { left, top, fontSize } = convertOverlayPosition(
        overlay,
        FIXED_CONTAINER.width,
        FIXED_CONTAINER.height
      );

      return (
        <Animated.View
          key={index}
          style={[{
            position: 'absolute',
            left: left,
            top: top,
            minWidth: 100,
            maxWidth: '80%',
            transform: [
              { scale: overlay.scale },
              { rotate: `${overlay.rotation}rad` }
            ],
          }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text
              style={{
                color: 'white',
                fontSize: fontSize,
              }}
            >
              {overlay.text}
            </Text>
          </View>
        </Animated.View>
      );
    });
  };

  useEffect(() => {
    // Reset loading states when index changes
    setIsMediaLoading(true);
    setIsTextLoading(true);
    
    // Check file extension
    const fileExt = stories[currentIndex]?.uri.split('.').pop()?.toLowerCase();
    setMediaType(fileExt === 'mov' ? 'video' : 'image');
    
    // Text overlay data comes with story data, so it's ready once the story exists
    if (stories[currentIndex]) {
      setIsTextLoading(false);
    }
  }, [currentIndex, stories]);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      if (!user?.id) {
        console.log('[MyStories] No user ID available');
        setStories([]);
        return;
      }

      // Use feed cache for efficient own stories loading
      console.log(`[MyStories] Loading own stories for user: ${user.id}`);
      const cachedStories = await feedCache.getUserStories(user.id);
      
      if (cachedStories.length === 0) {
        console.log('[MyStories] No stories found for current user');
        setStories([]);
        return;
      }

      // Process with media cache for signed URLs
      const storiesWithUrls = await mediaCache.processMediaItems(
        cachedStories.map(story => ({ uri: story.uri, id: story.id })),
        'videos'
      );

      const processedStories = cachedStories.map((story, index) => ({
        ...story,
        signedUrl: storiesWithUrls[index]?.signedUrl,
      }));

      setStories(processedStories);
      console.log(`[MyStories] Loaded ${processedStories.length} own stories`);
    } catch (error) {
      console.error('[MyStories] Error loading own stories:', error);
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
    
    if (touchX < SCREEN_WIDTH * 0.3) {
      if (currentIndex > 0) {
        setIsMediaLoading(true);
      setIsTextLoading(true);
        setCurrentIndex(currentIndex - 1);
      } else {
        router.back();
      }
    } else if (touchX > SCREEN_WIDTH * 0.7) {
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
      console.log('[Stories] Attempting to delete story:', story.id);
      
      if (!story || !story.id) {
        throw new Error('Story not found or invalid story ID');
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('Video')
        .delete()
        .eq('id', story.id);

      if (deleteError) {
        console.error('[Stories] Database deletion failed:', deleteError);
        throw new Error(`Failed to delete from database: ${deleteError.message}`);
      }

      console.log('[Stories] Story deleted from database successfully');
      
      // Invalidate user stories cache since we deleted a story
      if (user?.id) {
        await feedCache.invalidateUserStories(user.id);
        console.log('[Stories] Invalidated user stories cache after deletion');
      }
      
      // Update local state
      const newStories = stories.filter((_, index) => index !== currentIndex);
      setStories(newStories);
      
      // Close modal and show toast first
      modalRef.current?.close();
      setShowDeleteConfirm(false);
      
      // Show only the global toast (remove duplicate local toast)
      Toast.show({ 
        type: 'success', 
        text1: 'Story Deleted',
        text2: 'Your story has been removed successfully'
      });
      
      // Handle navigation after toast (with delay)
      if (newStories.length === 0) {
        console.log('[Stories] No more stories, navigating back');
        // Delay navigation to allow toast to show
        setTimeout(() => {
          router.back();
        }, 1500); // Longer delay to ensure toast visibility
      } else if (currentIndex >= newStories.length) {
        console.log('[Stories] Adjusting current index after deletion');
        setCurrentIndex(newStories.length - 1);
      }
      
    } catch (error) {
      console.error('[Stories] Error deleting story:', error);
      modalRef.current?.close();
      setShowDeleteConfirm(false);
      
      // Force toast to show with longer visibility
      setTimeout(() => {
        Toast.show({ 
          type: 'error', 
          text1: 'Delete Failed',
          text2: error instanceof Error ? error.message : 'Unable to delete story. Please try again.',
          visibilityTime: 4000
        });
      }, 100);
    }
  };

  if (initialLoading || stories.length === 0) return <LoadingScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
      {/* Fixed 9:16 container for consistent cross-device display */}
      <View style={{ width: FIXED_CONTAINER.width, height: FIXED_CONTAINER.height, overflow: 'hidden', borderRadius: 20 }}>
      <Pressable onPress={handlePress} style={{ flex: 1 }}>
        {mediaType === 'video' ? (
          <>
            <Video
              ref={videoRef}
              source={{ uri: stories[currentIndex].signedUrl || '' }}
              style={{
                width: FIXED_CONTAINER.width,
                height: FIXED_CONTAINER.height,
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
                width: FIXED_CONTAINER.width,
                height: FIXED_CONTAINER.height,
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
              source={{ uri: stories[currentIndex].signedUrl || '' }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              onLoadStart={() => setIsMediaLoading(true)}
              onLoad={() => setIsMediaLoading(false)}
            />
            {!isContentLoading && renderTextOverlays()}
            {isContentLoading && (
              <View style={{
                position: 'absolute',
                width: FIXED_CONTAINER.width,
                height: FIXED_CONTAINER.height,
                zIndex: 1,
                backgroundColor: 'black'
              }}>
                <LoadingScreen />
              </View>
            )}
          </>
        )}

        {/* Progress bar */}
        <View className="absolute bottom-4 left-2 right-2 flex-row gap-1 z-10">
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
        <View className="absolute top-4 left-0 right-0 px-4 flex-row justify-between z-10">
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
      </View>

      <Portal>
        <Modalize
          ref={modalRef}
          modalHeight={180}
          modalStyle={{ backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
          handleStyle={{ backgroundColor: '#4a4a4a', width: 40, height: 4, borderRadius: 2 }}
          onClose={() => setShowDeleteConfirm(false)}
        >
          <View className="pt-4 pb-6">
            {!showDeleteConfirm ? (
              <TouchableOpacity
                className="flex-row items-center px-6 py-4 mx-4 mb-2 bg-gray-800/50 rounded-2xl active:bg-gray-700/60"
                onPress={() => setShowDeleteConfirm(true)}
              >
                <View className="w-8 h-8 bg-red-500/20 rounded-full items-center justify-center mr-4">
                  <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                </View>
                <Text className="text-white text-base font-medium">Delete Story</Text>
              </TouchableOpacity>
            ) : (
              <View className="px-6 py-3">
                <Text className="text-white text-lg mb-2 text-center font-semibold">
                  Delete Story?
                </Text>
                <Text className="text-gray-400 text-sm mb-6 text-center">
                  This action cannot be undone.
                </Text>
                
                <View className="flex-row justify-between gap-3">
                  <TouchableOpacity
                    className="flex-1 bg-gray-700/60 rounded-2xl py-4"
                    onPress={() => setShowDeleteConfirm(false)}
                  >
                    <Text className="text-gray-300 text-center text-base font-medium">
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    className="flex-1 bg-red-500/90 rounded-2xl py-4"
                    onPress={handleDelete}
                  >
                    <Text className="text-white text-center text-base font-semibold">
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </Modalize>
      </Portal>
    </View>
  );
}