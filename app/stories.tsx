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

type Story = {
  id: string;
  uri: string;
  type: 'video' | 'image';
  signedUrl?: string;
  user_id: string;
  created_at: string;
  is_muted: boolean;
  expired_at: string
}

export default function Mystoryscreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mute, setMute] = useState(false);
  const modalRef = useRef<Modalize>(null);
  const [status, setStatus] = useState({});
  const videoRef = useRef(null);
  const [showMuteIcon, setShowMuteIcon] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const formatTimeDifference = (createdAt: string ) => {
    // Get current time in local timezone
    const now = new Date();
    
    // Parse created_at and convert to local timezone
    const created = new Date(createdAt + 'Z');
   
    
    const diffInMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
  
  
    if (diffInHours >= 3) {
      return '3h';
    } else if (diffInHours >= 1) {
      return `${diffInHours}h`;
    } else {
      return `${diffInMinutes}m`;
    }
  };


  
  const router = useRouter();
  const { user } = useAuth();
  const screenWidth = Dimensions.get('window').width;

  const [mediaType, setMediaType] = useState('');

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

useEffect(() => {
  // Check file extension
  const fileExt = stories[currentIndex]?.uri.split('.').pop()?.toLowerCase();
  setMediaType(fileExt === 'mov' ? 'video' : 'image');
}, [currentIndex, stories]);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const { data, error } = await supabase
        .from('Video')
        .select('*')
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
      setIsLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
    }
  };

  const handlePress = (event: any) => {
    const touchX = event.nativeEvent.locationX;
    
    if (touchX < screenWidth * 0.3) {
      if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else {
        router.back();
      }
    } else if (touchX > screenWidth * 0.7) {
      if (currentIndex < stories.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        router.back();
      }
    } else {
      if(stories[currentIndex].is_muted == false){
      setMute(!mute);
      showMuteIconWithFade();
      }

    }
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

  if (isLoading || stories.length === 0) return <LoadingScreen/>;

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
            onLoadStart={() => setIsLoading(true)}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && !status.isBuffering) {
                setIsLoading(false);
              }
            }}
          />
          {isLoading && (
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
          {showMuteIcon && (
            <Animated.View style={[{
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
        <>
        <Image
          source={{ uri: stories[currentIndex].signedUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
              
          />
          {isLoading && (
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

        {/* Progress bar - moved to bottom */}
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
          <Text className='text-lg font-extrabold text-white ml-2'> {formatTimeDifference(stories[currentIndex].created_at)}</Text>
          
          <TouchableOpacity onPress={() => modalRef.current?.open()}>
            <Ionicons name="ellipsis-vertical" size={30} color="white"/>
          </TouchableOpacity>
        </View>
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