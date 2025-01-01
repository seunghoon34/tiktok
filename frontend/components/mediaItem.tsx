import { View, Text, Dimensions, Image, Pressable, Animated, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { useRef, useState, useEffect } from 'react';
import { Video, ResizeMode } from 'expo-av';
import Ionicons from '@expo/vector-icons/Ionicons';
import { handleVideoLike } from '@/utils/videoMatching';
import LoadingScreen from '@/components/loading';
import React from 'react';
import { Modalize } from 'react-native-modalize';
import { Portal } from 'react-native-portalize';

interface MediaItemProps {
  item: {
    uri: string;
    signedUrl: string;
    type: 'video' | 'picture';
    User: {
      username: string;
      id: string;
    };
    title: string;
    id: string;
  };
  isVisible: boolean;
  isScreenFocused: boolean;
  mute: boolean;
  onMuteChange: () => void;
}

export const MediaItemComponent = ({ item, isVisible, isScreenFocused, mute, onMuteChange }: MediaItemProps) => {
  const [showMuteIcon, setShowMuteIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { user, likes, getLikes } = useAuth();
  const modalRef = useRef<Modalize>(null);
  const lastTap = useRef<number>(0);
  const DOUBLE_TAP_DELAY = 300; // milliseconds
  const [showHeart, setShowHeart] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const [modalView, setModalView] = useState<'menu' | 'confirmReport' | 'confirmBlock'>('menu');
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const getUserProfile = async () => {
      const { data, error } = await supabase
        .from('UserProfile')
        .select(`
          *,
          user:User (
            username
          )
        `)
        .eq('user_id', item.User.id)
        .single();

      if (data) {
        const { data: urlData } = await supabase.storage
          .from('avatars')
          .createSignedUrl(data.profilepicture, 3600);
        if (urlData) {
          setUserProfile({...data, profilepicture: urlData.signedUrl});
        }
      }
    };
    getUserProfile();
  }, [item.User.id]);

  const handleAction = (action: 'report' | 'block') => {
    if (action === 'report') {
      setModalView('confirmReport');
    } else if (action === 'block') {
      setModalView('confirmBlock');
    }
  };

  const mediaStyle = {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    top: 0,
  };

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  const likeVideo = async () => {
    if (likes.filter((like: any) => like.video_id === item.id).length === 0) {
      showHeartAnimation()

    try {
      const newLike = {
        video_id: item.id,
        user_id: user.id
      };

      getLikes(user?.id, [newLike]); // You'll need to modify getLikes to accept optional immediate likes
      const result = await handleVideoLike(
        user.id,
        item.id,
        item.User.id
      );
  
      if (result.status === 'matched') {
        console.log("Match: ",result.users[0],'and ', result.users[1]);
      }
      
  
      
    } catch (error) {
      getLikes(user?.id);
      console.error('Error liking video:', error);    }
    }
  };

  const unLikeVideo = async () => {
    try{
    const filteredLikes = likes.filter((like: any) => like.video_id !== item.id);
    getLikes(user?.id, filteredLikes);
    const { data, error } = await supabase
      .from('Like')
      .delete()
      .eq('user_id', user?.id)
      .eq('video_id', item.id);
    if (error) throw(error)
    } catch(error) {
      getLikes(user?.id);
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

  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = DOUBLE_TAP_DELAY;
    
    if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
      // Double tap detected
      lastTap.current = 0;
      handleLikeWithAnimation();
    } else {
      // Single tap
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current === now) {
          // If it wasn't a double tap, handle mute
          onMuteChange();
          showMuteIconWithFade();
        }
      }, DOUBLE_PRESS_DELAY);
    }
  };

  const showHeartAnimation = () => {
    setShowHeart(true);
    
    // Reset animation values
    heartScale.setValue(0);
    heartOpacity.setValue(1);
  
    // Animate the heart
    Animated.parallel([
      Animated.sequence([
        // Spring animation to scale up
        Animated.spring(heartScale, {
          toValue: 1,
          speed: 15,
          useNativeDriver: true,
        }),
        // Slight bounce effect
        Animated.timing(heartScale, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
        // Spring back to full size
        Animated.spring(heartScale, {
          toValue: 1,
          speed: 15,
          useNativeDriver: true,
        }),
      ]),
      // Fade out animation
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(heartOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setShowHeart(false);
    });
  };

  const handleLikeWithAnimation = async () => {
    const isLiked = likes.filter((like: any) => like.video_id === item.id).length > 0;
    setTimeout(() => {
      showHeartAnimation();
    }, 200);
    if (!isLiked) {
      try {
        const newLike = {
          video_id: item.id,
          user_id: user.id
        };

        getLikes(user?.id, [newLike]);
        const result = await handleVideoLike(
          user.id,
          item.id,
          item.User.id
        );
    
        if (result.status === 'matched') {
          console.log("Match: ", result.users[0], 'and ', result.users[1]);
        }
      } catch (error) {
        getLikes(user?.id);
        console.error('Error liking video:', error);
      }
    }
    
    // Show animation regardless of whether we liked or not
    
  };

  return (
    <Pressable 
      onPress={handlePress}
      style={mediaStyle}
    >
      <View style={{
  position: 'absolute',
  top: 60,
  left: 0,
  right: 0,
  paddingHorizontal: 20,
  flexDirection: 'row',
  justifyContent: 'space-between',
  zIndex: 999,
}}>
  <TouchableOpacity onPress={() => router.back()}>
    <Ionicons name='chevron-back' size={40} color="white"/>
  </TouchableOpacity>
  
  <TouchableOpacity 
    onPress={() => modalRef.current?.open()}
  >
    <Ionicons name="ellipsis-vertical" size={30} color="white"/>
  </TouchableOpacity>
</View>
    
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
      
      {item.type === 'video' ? (
        <>
          <Video
            source={{ uri: item.signedUrl }}
            style={[mediaStyle, { position: 'absolute' }]}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={isVisible && isScreenFocused}
            isMuted={mute}
            onLoadStart={handleLoadStart}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && !status.isBuffering) {
                handleLoadEnd();
              }
            }}
          />
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
        <Image
          source={{ uri: item.signedUrl }}
          style={mediaStyle}
          resizeMode="cover"
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
        />
      )}
      
      <View style={{
        position: 'absolute',
        bottom: 50,
        left: 10,
        padding: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '95%'
      }}>
        <View style={{flexDirection: 'row'}}>
          <TouchableOpacity onPress={() => router.push(`/user?user_id=${item.User.id}`)}>
            {userProfile?.profilepicture ? (
              <Image 
                source={{ uri: userProfile.profilepicture }}
                className="w-[50px] h-[50px] rounded-full"
              />
            ) : (
              <Ionicons 
                name="person-circle-outline" 
                size={50} 
                color="white" 
              />
            )}
          </TouchableOpacity>
          <View className='mt-2 ml-2'>
            <TouchableOpacity onPress={() => router.push(`/user?user_id=${item.User.id}`)}>
              <Text className='text-2xl font-bold text-white'>{item.User.username}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {likes.filter((like: any) => like.video_id === item.id).length > 0 ? (
          <TouchableOpacity onPress={async () => {
            await unLikeVideo();
            await getLikes(user?.id); // Force refresh likes after unlike
          }}
        >
            <Ionicons name="heart" size={40} color="#ff5757"/>
          </TouchableOpacity> 
        ) : (
          <TouchableOpacity onPress={likeVideo}>
            <Ionicons name="heart-outline" size={40} color="white"/>
          </TouchableOpacity>  
        )}
        
        
      </View>
      {showHeart && (
  <Animated.View
    style={[{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [
        { translateX: -40 },
        { translateY: -40 },
        { scale: heartScale }
      ],
      zIndex: 11,
    }, {
      opacity: heartOpacity
    }]}
  >
    <Ionicons name="heart" size={80} color="#ff5757" />
  </Animated.View>
)}
      <Portal>
  <Modalize
    ref={modalRef}
    adjustToContentHeight
    modalStyle={{
      backgroundColor: '#1f1f1f',
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    }}
    closeOnOverlayTap
    handleStyle={{ backgroundColor: '#636363', width: 40 }}
    onClose={() => setModalView('menu')}  // Reset view when modal closes
  >
    <View className="py-2 pb-10">
      {modalView === 'menu' ? (
        <>
          <TouchableOpacity
            className="flex-row items-center px-4 py-3 active:bg-gray-800"
            onPress={() => handleAction('report')}
          >
            <Ionicons name="flag-outline" size={24} color="red" className="mr-3" />
            <Text className="text-red-600 text-[16px]">Report Content</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-4 py-3 active:bg-gray-800"
            onPress={() => handleAction('block')}
          >
            <Ionicons name="ban-outline" size={24} color="red" className="mr-3" />
            <Text className="text-red-600 text-[16px]">Block {item.User.username}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-4 py-3 active:bg-gray-800"
            onPress={() => modalRef.current?.close()}
          >
            <Ionicons name="close-outline" size={24} color="white" className="mr-3" />
            <Text className="text-white text-[16px]">Cancel</Text>
          </TouchableOpacity>
        </>
      ) : modalView === 'confirmReport' ? (
        <View className="px-4 py-3">
          <Text className="text-white text-lg mb-4">Are you sure you want to report this content?</Text>
          <TouchableOpacity
            className="bg-red-500 rounded-lg py-3 mb-3"
            onPress={() => {
              // Handle report submission here
              modalRef.current?.close();
              setModalView('menu');
            }}
          >
            <Text className="text-white text-center font-semibold text-lg">Report Content</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-gray-600 rounded-lg py-3"
            onPress={() => setModalView('menu')}
          >
            <Text className="text-white text-center text-lg">Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="px-4 py-3">
          <Text className="text-white text-lg mb-4">Are you sure you want to block {item.User.username}?</Text>
          <TouchableOpacity
            className="bg-red-500 rounded-lg py-3 mb-3"
            onPress={() => {
              // Handle block user logic here
              modalRef.current?.close();
              setModalView('menu');
            }}
          >
            <Text className="text-white text-center font-semibold text-lg">Block User</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-gray-600 rounded-lg py-3"
            onPress={() => setModalView('menu')}
          >
            <Text className="text-white text-center text-lg">Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  </Modalize>
</Portal>
    </Pressable>
  );
};