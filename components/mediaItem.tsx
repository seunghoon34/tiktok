import { View, Text, Dimensions, Image, Pressable, Animated, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { useRef, useState } from 'react';
import { Video, ResizeMode } from 'expo-av';
import Ionicons from '@expo/vector-icons/Ionicons';

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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { user, likes, getLikes } = useAuth();

  const mediaStyle = {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    top: 0,
  };

  const likeVideo = async () => {
    const { data, error } = await supabase
      .from('Like')
      .insert({
        user_id: user.id,
        video_id: item.id,
        video_user_id: item.User.id 
      });

    if(!error) getLikes(user?.id)
  };

  const unLikeVideo = async () => {
    const { data , error } = await supabase
      .from('Like')
      .delete().eq('user_id', user?.id).eq('video_id', item.id)
      if(!error) getLikes(user?.id)

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

  return (
    <Pressable 
      onPress={() => {onMuteChange(); showMuteIconWithFade()}}
      style={mediaStyle}
    >
      {item.type === 'video' ? (
        <>
          <Video
            source={{ uri: item.signedUrl }}
            style={[mediaStyle, { position: 'absolute' }]}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={isVisible && isScreenFocused}
            isMuted={mute}
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
            <Ionicons name="add-circle-sharp" size={50} color="black" />
          </TouchableOpacity>
          <View>
            <TouchableOpacity onPress={() => router.push(`/user?user_id=${item.User.id}`)}>
              <Text className='text-2xl font-bold'>{item.User.username}</Text>
            </TouchableOpacity>
            <Text className='text-2xl'>{item.title}</Text>
          </View>
        </View>
        {likes.filter((like: any) => like.video_id === item.id).length > 0 ? (
            <TouchableOpacity onPress={unLikeVideo}>
                <Ionicons name="heart" size={50} color="red"/>
            </TouchableOpacity> 

        ):
        (
            <TouchableOpacity onPress={likeVideo}>
                <Ionicons name="heart-outline" size={50} color="red"/>
            </TouchableOpacity>  
        )}
       
      </View>
    </Pressable>
  );
};