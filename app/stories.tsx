import React from 'react';
import { View, Pressable, Dimensions, TouchableOpacity, Text } from 'react-native';
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
}

export default function Mystoryscreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mute, setMute] = useState(false);
  const modalRef = useRef<Modalize>(null);
  const [status, setStatus] = useState({});
  const videoRef = useRef(null);
  
  const router = useRouter();
  const { user } = useAuth();
  const screenWidth = Dimensions.get('window').width;

  const [mediaType, setMediaType] = useState('');

useEffect(() => {
  // Check file extension
  const fileExt = stories[currentIndex]?.uri.split('.').pop()?.toLowerCase();
  setMediaType(fileExt === 'mp4' ? 'video' : 'image');
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
      setMute(!mute);
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
            isMuted={mute}
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
        </>
      ) : (
        <Image
          source={{ uri: stories[currentIndex].signedUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
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