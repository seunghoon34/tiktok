import { View, Text, Dimensions, Image, Pressable, Animated, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { useRef, useState, useEffect } from 'react';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import Ionicons from '@expo/vector-icons/Ionicons';
import { handleVideoLike } from '@/utils/videoMatching';
import SimpleSpinner from '@/components/simpleSpinner';
import React from 'react';
import { Modalize } from 'react-native-modalize';
import { Portal } from 'react-native-portalize';
import { reportContent, blockUser } from '@/utils/userModeration';
import Toast from 'react-native-toast-message';
import { convertOverlayPosition, getFixedContainerDimensions } from '@/utils/mediaPositioning';
import { profileCache } from '@/utils/profileCache';
import { ROLE_COLORS } from '@/constants/profileOptions';

// Get fixed 9:16 container dimensions for consistent cross-device display
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FIXED_CONTAINER = getFixedContainerDimensions(SCREEN_WIDTH, SCREEN_HEIGHT);

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
    is_muted: boolean;
    expired_at: string;
    created_at: string;
    TextOverlay?: Array<{  // Add this
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
  };
  isVisible: boolean;
  isScreenFocused: boolean;
  mute: boolean;
  onMuteChange: () => void;
}

type ReportReason = 'INAPPROPRIATE_CONTENT' | 'HARASSMENT' | 'SPAM' | 'FAKE_PROFILE' | 'OTHER';
type ModalView = 'menu' | 'confirmReport' | 'confirmBlock' | 'reportReasons' | 'confirmReportReason';
type ReportType = 'USER' | 'CONTENT';

export const MediaItemComponent = ({ item, isVisible, isScreenFocused, mute, onMuteChange }: MediaItemProps) => {
  const videoRef = useRef<Video>(null);
  const [showMuteIcon, setShowMuteIcon] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true); // Track individual video loading
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { user, likes, getLikes } = useAuth();
  const modalRef = useRef<Modalize>(null);
  const lastTap = useRef<number>(0);
  const DOUBLE_TAP_DELAY = 300; // milliseconds
  const [showHeart, setShowHeart] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const [modalView, setModalView] = useState<ModalView>('menu');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [reportType, setReportType] = useState<ReportType>('CONTENT');
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);


  

  const renderTextOverlays = () => {
    return item.TextOverlay?.map((overlay, index) => {
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


  const formatTimeDifference = (createdAt: string ) => {
    // Get current time in local timezone
    const now = new Date();
    
    // Parse created_at and convert to local timezone
    const created = new Date(createdAt + 'Z');
    
    // Log times for debugging
    
    const diffInMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
  
  
    if (diffInHours >= 24) {
      return '24h';
    } else if (diffInHours >= 1) {
      return `${diffInHours}h`;
    } else {
      return `${diffInMinutes}m`;
    }
  };

  useEffect(() => {
    const getUserProfile = async () => {
      try {
        console.log('[MediaItem] Loading profile for user:', item.User.id);
        const cachedProfile = await profileCache.getProfile(item.User.id);
        
        if (cachedProfile) {
          console.log('[MediaItem] Profile loaded (cached or fresh):', {
            userId: cachedProfile.user_id,
            hasRole: !!cachedProfile.role,
            role: cachedProfile.role,
            hasProfilePic: !!cachedProfile.profilepicture
          });
          setUserProfile(cachedProfile);
        } else {
          console.log('[MediaItem] No profile data available for user:', item.User.id);
        }
      } catch (error) {
        console.error('[MediaItem] Exception in getUserProfile:', error);
      }
    };
    getUserProfile();
  }, [item.User.id]);

  const handleAction = (action: 'reportContent' | 'reportUser' | 'block') => {
    if (action === 'reportContent') {
      setReportType('CONTENT');
      setModalView('reportReasons');
    } else if (action === 'reportUser') {
      setReportType('USER');
      setModalView('reportReasons');
    } else if (action === 'block') {
      setModalView('confirmBlock');
    }
  };

  // Use fixed 9:16 container for consistent cross-device display
  const mediaStyle = {
    width: FIXED_CONTAINER.width,
    height: FIXED_CONTAINER.height,
    backgroundColor: 'black',
    borderRadius: 20,
    overflow: 'hidden' as const,
  };

  const handleLoadStart = () => {
    setIsVideoLoading(true);
  };

  const handleLoadEnd = () => {
    setIsVideoLoading(false);
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
  
      if (result?.status === 'matched' && result.users) {
        console.log("Match: ", result.users[0], 'and ', result.users[1]);
      }
  
      
    } catch (error) {
      getLikes(user?.id);
      console.error('Error liking video:', error);
    }
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
          if (!item.is_muted) {
            onMuteChange();
            showMuteIconWithFade();
          }
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
    
        if (result?.status === 'matched' && result.users) {
          console.log("Match: ", result.users[0], 'and ', result.users[1]);
        }
      } catch (error) {
        getLikes(user?.id);
        console.error('Error liking video:', error);
      }
    }
    
    // Show animation regardless of whether we liked or not
    
  };

  const handleReasonSelect = (reason: ReportReason) => {
    setSelectedReason(reason);
    setModalView('confirmReportReason');
  };

  const submitReport = async () => {
    if (!selectedReason) return;
    
    try {
      const result = await reportContent(
        user.id,
        item.User.id,
        reportType,
        reportType === 'CONTENT' ? item.id : item.User.id,
        selectedReason
      );
      
      if (result.status === 'success') {
        modalRef.current?.close();
        setModalView('menu');
        setSelectedReason(null);
        Toast.show({
          type: 'success',
          text1: 'Report Submitted',
          text2: 'Thank you for helping keep our community safe',
        });
      }
    } catch (error) {
      console.error('Error reporting:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit report. Please try again.',
      });
    }
  };

  // Get the ring color based on user's role
  const getRingColor = () => {
    console.log('[MediaItem] getRingColor called:', {
      hasUserProfile: !!userProfile,
      role: userProfile?.role,
      hasRoleColors: !!(userProfile?.role && ROLE_COLORS[userProfile.role]),
      color: userProfile?.role && ROLE_COLORS[userProfile.role] ? ROLE_COLORS[userProfile.role].ring : 'transparent'
    });
    
    if (userProfile?.role && ROLE_COLORS[userProfile.role]) {
      return ROLE_COLORS[userProfile.role].ring;
    }
    return 'transparent'; // No ring if no role set
  };

  return (
    <View style={{ 
      width: SCREEN_WIDTH, 
      height: SCREEN_HEIGHT, 
      backgroundColor: 'black',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
    <Pressable 
      onPress={handlePress}
      style={mediaStyle}
    >
      <View style={{
  position: 'absolute',
  top: 16,
  left: 0,
  right: 0,
  paddingHorizontal: 16,
  flexDirection: 'row',
  justifyContent: 'space-between',
  zIndex: 999,
}}>
  <TouchableOpacity onPress={() => router.back()}>
    <Ionicons name='chevron-back' size={40} color="white"/>
  </TouchableOpacity>
  <Text className='text-lg font-extrabold text-white ml-2'>
        {formatTimeDifference(item.created_at)}
      </Text>
  <TouchableOpacity 
    onPress={() => modalRef.current?.open()}
  >
    <Ionicons name="ellipsis-vertical" size={30} color="white"/>
  </TouchableOpacity>
</View>
    
      {isVideoLoading && (
        <View style={{
          position: 'absolute',
          width: FIXED_CONTAINER.width,
          height: FIXED_CONTAINER.height,
          zIndex: 1,
          backgroundColor: 'black',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {/* Simple loading indicator instead of full LoadingScreen component */}
          <SimpleSpinner size={50} />
        </View>
      )}
      
      {item.type === 'video' ? (
        <>
          <Video
            ref={videoRef}
            source={{ uri: item.signedUrl }}
            style={[mediaStyle, { position: 'absolute' }]}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isVisible && isScreenFocused}
            isMuted={item.is_muted || mute}
            onLoadStart={handleLoadStart}
            onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
              if (status.isLoaded) {
                if (!status.isBuffering) {
                  setIsVideoLoading(false);
                }
                if (status.didJustFinish) {
                  videoRef.current?.replayAsync();
                }
              }
            }}
          />
          {!isVideoLoading && renderTextOverlays()}
          {showMuteIcon && !item.is_muted && (
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
          source={{ uri: item.signedUrl }}
          style={mediaStyle}
          resizeMode="cover"
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
        />
        {!isVideoLoading && renderTextOverlays()}
        </>
      )}
      
      <View style={{
        position: 'absolute',
        bottom: 16,
        left: 10,
        padding: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '95%'
      }}>
        <View style={{flexDirection: 'row'}}>
          <TouchableOpacity onPress={() => router.push(`/user?user_id=${item.User.id}`)}>
            {(() => {
              const ringColor = getRingColor();
              const hasRing = ringColor !== 'transparent';
              
              return (
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  borderWidth: hasRing ? 3 : 0,
                  borderColor: ringColor,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: 'transparent',
                }}>
                  {userProfile?.profilepicture ? (
                    <Image 
                      source={{ uri: userProfile.profilepicture }}
                      style={{
                        width: hasRing ? 48 : 50,
                        height: hasRing ? 48 : 50,
                        borderRadius: hasRing ? 24 : 25,
                      }}
                    />
                  ) : (
                    <Ionicons 
                      name="person-circle-outline" 
                      size={hasRing ? 48 : 50} 
                      color="white" 
                    />
                  )}
                </View>
              );
            })()}
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
            <Ionicons name="heart" size={40} color="#FF6B6B"/>
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
    <Ionicons name="heart" size={80} color="#FF6B6B" />
  </Animated.View>
)}
      <Portal>
  <Modalize
    ref={modalRef}
    modalHeight={360}
    modalStyle={{
      backgroundColor: '#1a1a1a',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    }}
    closeOnOverlayTap
    handleStyle={{ backgroundColor: '#4a4a4a', width: 40, height: 4, borderRadius: 2 }}
    onClose={() => setModalView('menu')}  // Reset view when modal closes
  >
    <View className="pt-4 pb-6">
      {modalView === 'menu' ? (
        <>
          <TouchableOpacity
            className="flex-row items-center px-6 py-4 mx-4 mb-2 bg-gray-800/50 rounded-2xl active:bg-gray-700/60"
            onPress={() => handleAction('reportContent')}
          >
            <View className="w-8 h-8 bg-red-500/20 rounded-full items-center justify-center mr-4">
              <Ionicons name="flag-outline" size={18} color="#FF6B6B" />
            </View>
            <Text className="text-white text-base font-medium">Report Content</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-6 py-4 mx-4 mb-2 bg-gray-800/50 rounded-2xl active:bg-gray-700/60"
            onPress={() => handleAction('reportUser')}
          >
            <View className="w-8 h-8 bg-red-500/20 rounded-full items-center justify-center mr-4">
              <Ionicons name="person-remove-outline" size={18} color="#FF6B6B" />
            </View>
            <Text className="text-white text-base font-medium">Report User</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-6 py-4 mx-4 mb-2 bg-gray-800/50 rounded-2xl active:bg-gray-700/60"
            onPress={() => handleAction('block')}
          >
            <View className="w-8 h-8 bg-red-500/20 rounded-full items-center justify-center mr-4">
              <Ionicons name="ban-outline" size={18} color="#FF6B6B" />
            </View>
            <Text className="text-white text-base font-medium">Block {item.User.username}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-6 py-4 mx-4 mb-2 bg-gray-700/50 rounded-2xl active:bg-gray-600/60"
            onPress={() => modalRef.current?.close()}
          >
            <View className="w-8 h-8 bg-gray-500/20 rounded-full items-center justify-center mr-4">
              <Ionicons name="close-outline" size={18} color="#9ca3af" />
            </View>
            <Text className="text-gray-300 text-base font-medium">Cancel</Text>
          </TouchableOpacity>
        </>
      ) : modalView === 'reportReasons' ? (
        <View className="px-4 py-3">
          <Text className="text-white text-lg mb-4">
            Why are you reporting this {reportType === 'CONTENT' ? 'content' : 'user'}?
          </Text>
          
          {(['INAPPROPRIATE_CONTENT', 'HARASSMENT', 'SPAM', 'FAKE_PROFILE', 'OTHER'] as ReportReason[]).map((reason) => (
            <TouchableOpacity
              key={reason}
              className="active:bg-gray-800 rounded-lg py-3 mb-3"
              onPress={() => handleReasonSelect(reason)}
            >
              <Text className="text-white text-center text-lg">
                {reason.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
              </Text>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            className="active:bg-gray-800 rounded-lg py-3"
            onPress={() => setModalView('menu')}
          >
            <Text className="text-white text-center text-lg">Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : modalView === 'confirmReportReason' ? (
        <View className="px-4 py-3">
          <Text className="text-white text-lg mb-4">
            Are you sure you want to report this {reportType === 'CONTENT' ? 'content' : 'user'} for{' '}
            {selectedReason?.toLowerCase().replace(/_/g, ' ')}?
          </Text>
          
          <TouchableOpacity
            className="bg-red-500 rounded-xl py-3 mb-3"
            onPress={submitReport}
          >
            <Text className="text-white text-center font-semibold text-lg">Submit Report</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className="bg-gray-600 rounded-lg py-3"
            onPress={() => setModalView('reportReasons')}
          >
            <Text className="text-white text-center text-lg">Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : modalView === 'confirmBlock' ? (
        <View className="px-4 py-3">
          <Text className="text-white text-lg mb-4">Are you sure you want to block {item.User.username}?</Text>
          <TouchableOpacity
            className="bg-red-500 rounded-xl py-3 mb-3"
            onPress={async () => {
              try {
                const result = await blockUser(user.id, item.User.id);
                if (result.status === 'success') {
                  modalRef.current?.close();
                  setModalView('menu');
                  Toast.show({
                    type: 'success',
                    text1: 'User Blocked',
                    text2: `You have blocked ${item.User.username}`,
                  });
                } else if (result.status === 'already_blocked') {
                  modalRef.current?.close();
                  setModalView('menu');
                  Toast.show({
                    type: 'info',
                    text1: 'Already Blocked',
                    text2: `${item.User.username} is already blocked`,
                  });
                }
              } catch (error) {
                console.error('Error blocking user:', error);
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: 'Failed to block user. Please try again.',
                });
              }
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
      ) : null}
    </View>
  </Modalize>
</Portal>
    </Pressable>
    </View>
  );

  
};

const styles = StyleSheet.create({
  overlayText: {
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
    zIndex: 2,
  },
  topBar: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 999,
  },
  timeText: {
    fontSize: 18,
    fontWeight: '800',
    color: 'white',
    marginLeft: 8,
  },
  loadingContainer: {
    position: 'absolute',
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    zIndex: 1,
    backgroundColor: 'black',
  },
  muteIconContainer: {
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
  }
});