import { View, Text, TouchableOpacity, ScrollView, Image, Alert, Linking } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import "../../global.css";
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Modalize } from 'react-native-modalize';
import { Portal } from 'react-native-portalize';
import { hybridCache } from '@/utils/memoryCache';

type ModalView = 'menu' | 'confirmDelete';

interface UserProfile {
  user_id: string;
  profilepicture: string | null;
  name: string;
  birthdate: string | null;
  aboutme: string | null;
}

export default function ProfileScreen() {
 const { signOut, user, deleteAccount } = useAuth();
 const [profile, setProfile] = useState<UserProfile | null>(null);
 const [imageUrl, setImageUrl] = useState<string | null>(null);
 const [hasVideos, setHasVideos] = useState(false);
 const modalRef = useRef<Modalize>(null);
 const [modalView, setModalView] = useState<ModalView>('menu');
 const [imageLoadFailed, setImageLoadFailed] = useState(false);
 const imageErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);



 const router = useRouter()


 const getProfile = async () => {
  // Check cache first
  const cacheKey = `profile:${user?.id}`;
      const cached = await hybridCache.get<UserProfile>(cacheKey);
  
  if (cached) {
    console.log('[ProfileScreen] Using cached profile');
    setProfile(cached);
    return;
  }
  
  try {
    console.log('[ProfileScreen] Fetching profile for user:', user?.id);
    const { data, error } = await supabase
      .from('UserProfile')
      .select('*')
      .eq('user_id', user?.id)
      .single();
    
    if (error) {
      console.error('[ProfileScreen] Error fetching profile:', error);
      return;
    }
    
    if (data) {
      console.log('[ProfileScreen] Profile data received:', { ...data, profilepicture: data.profilepicture ? 'exists' : 'null' });
      
      // Cache for 6 hours
      await hybridCache.set(cacheKey, data, 6 * 60 * 60 * 1000);
      setProfile(data);
    } else {
      console.log('[ProfileScreen] No profile data returned');
    }
  } catch (error) {
    console.error('[ProfileScreen] Exception in getProfile:', error);
  }
};

const checkUserVideos = async () => {
  const { data, error } = await supabase
    .from('Video')
    .select('id')
    .eq('user_id', user?.id)
    .gt('expired_at', new Date().toISOString())
    .limit(1);
  
  setHasVideos(data ? data.length > 0 : false);
};

useFocusEffect(
  useCallback(() => {
    getProfile();
    checkUserVideos();
  }, [])
);

 useEffect(() => {
  const getAvatarUrl = async () => {
    try {
      if (profile?.profilepicture) {
        console.log('[ProfileScreen] Getting avatar URL for:', profile.profilepicture);
        const { data } = supabase.storage
          .from('profile_images')
          .getPublicUrl(profile.profilepicture);

        if (data?.publicUrl) {
          const imageUrl = data.publicUrl; // Remove dynamic timestamp
          console.log('[ProfileScreen] Setting image URL:', imageUrl);
          setImageUrl(imageUrl);
        } else {
          console.log('[ProfileScreen] No public URL returned from storage');
        }
      } else {
        console.log('[ProfileScreen] No profile picture path available');
        setImageUrl(null);
      }
    } catch (error) {
      console.error('[ProfileScreen] Exception in getAvatarUrl:', error);
    }
  };
  getAvatarUrl();

  // Cleanup timeout on unmount
  return () => {
    if (imageErrorTimeoutRef.current) {
      clearTimeout(imageErrorTimeoutRef.current);
    }
  };
}, [profile?.profilepicture]);

 useFocusEffect(
  useCallback(() => {
    getProfile();
  }, [])
);
 

 const menuItems = [
   {
     icon: "person-outline" as const,
     title: "Edit Profile",
     onPress: () => router.push('/editprofile'),
     color: 'black'
   },
   {
    icon: "ban-outline" as const,
    title: "Blocked users",
    onPress: () => router.push('/blocked'),
  },
  {
    icon: "mail-outline" as const,
    title: "Contact Support",
    onPress: () => Linking.openURL('mailto:s2.shootyourshot@gmail.com'),
  },
  {
    icon: "trash-outline" as const,
    title: "Delete account",
    onPress: () => modalRef.current?.open(),
  }
 ];

 return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 pt-2 pb-3 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View className="w-10" />
          <Text className="text-ios-title2">Profile</Text>
          <TouchableOpacity 
            className="w-10 items-end" 
            onPress={() => Alert.alert('Log Out', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: signOut },
            ])}
            activeOpacity={0.6}
          >
            <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </View>

     <ScrollView className="flex-1">
       <View className="items-center px-4 py-6">
      <View className="relative">
{hasVideos ? (
  <TouchableOpacity onPress={() => router.push('/stories')} activeOpacity={0.6}>
      <View className="p-0.5 rounded-full bg-red-500">
      <View className="p-0.5 bg-white rounded-full">
        <Image
          source={{ uri: imageUrl ?? undefined }}
          className="h-avatar-xl w-avatar-xl rounded-full"
          onLoad={() => {
            setImageLoadFailed(false);
            if (imageErrorTimeoutRef.current) {
              clearTimeout(imageErrorTimeoutRef.current);
              imageErrorTimeoutRef.current = null;
            }
          }}
          onError={(error) => {
            if (!imageUrl) return;
            setImageLoadFailed(true);
            // Only log if image is still failed after 3 seconds (meaning it didn't auto-retry successfully)
            imageErrorTimeoutRef.current = setTimeout(() => {
              if (__DEV__) {
                console.error('[ProfileScreen] Image permanently failed to load:', error.nativeEvent);
                console.error('[ProfileScreen] Failed image URL:', imageUrl);
              }
            }, 3000);
          }}
        />
      </View>
    </View>
  </TouchableOpacity>
) : (
  <View>
    {profile?.profilepicture ? (
               <Image
          source={{ uri: imageUrl ?? undefined }}
          className="h-avatar-xl w-avatar-xl rounded-full"
          onLoad={() => {
            setImageLoadFailed(false);
            if (imageErrorTimeoutRef.current) {
              clearTimeout(imageErrorTimeoutRef.current);
              imageErrorTimeoutRef.current = null;
            }
          }}
          onError={(error) => {
            if (!imageUrl) return;
            setImageLoadFailed(true);
            // Only log if image is still failed after 3 seconds (meaning it didn't auto-retry successfully)
            imageErrorTimeoutRef.current = setTimeout(() => {
              if (__DEV__) {
                console.error('[ProfileScreen] Image permanently failed to load:', error.nativeEvent);
                console.error('[ProfileScreen] Failed image URL:', imageUrl);
              }
            }, 3000);
          }}
        />
    ) : (
      <View className="h-avatar-xl w-avatar-xl rounded-full bg-gray-200 items-center justify-center">
        <Ionicons name="person" size={40} color="#8E8E93" />
      </View>
    )}
  </View>
)}
          
        </View>
        
        <Text className="text-ios-title2 mt-4">
          {user?.username}
        </Text>
        <Text className="text-ios-body text-gray-600">
          {profile?.name} <Text className="text-ios-body text-gray-600">
          {profile?.birthdate ? 
            `${new Date().getFullYear() - new Date(profile.birthdate).getFullYear()}` 
            : ''}  
        </Text>
        </Text>
       
       
        
        <View className="w-full mt-6 px-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-ios-headline text-gray-900">About Me</Text>
            <TouchableOpacity 
              onPress={() => router.push('/editprofile')}
              activeOpacity={0.6}
            >
              <Ionicons name="pencil" size={16} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <View className="bg-gray-100 p-4 rounded-xl">
            <Text className="text-ios-body text-gray-900 text-center">
              {profile?.aboutme || "No description yet"}
            </Text>
          </View>
        </View>
         
         
       </View>

      

      <View className="px-4 py-2">
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            className="flex-row items-center py-4 border-b border-gray-200"
            onPress={item.onPress}
            activeOpacity={0.6}
          >
            <Ionicons name={item.icon} size={24} color="#636366" />
            <Text className="flex-1 ml-3 text-ios-body text-gray-900">{item.title}</Text>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
    <View className="absolute bottom-0 w-full pb-4">
      <Text className="text-center text-ios-footnote text-gray-500">
        Version 1.0.0
      </Text>
    </View>
     <Portal>
  <Modalize
    ref={modalRef}
    adjustToContentHeight
    modalStyle={{
      backgroundColor: 'transparent',
      elevation: 0,
      shadowOpacity: 0,
    }}
    overlayStyle={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
    closeOnOverlayTap
    handlePosition="inside"
    handleStyle={{ display: 'none' }}
    onClose={() => setModalView('menu')}
  >
    <View className="px-3 pb-8">
      {modalView === 'menu' ? (
        <>
          <View className="bg-white/95 rounded-2xl overflow-hidden mb-2">
            <TouchableOpacity
              className="py-4 active:bg-gray-100"
              onPress={() => setModalView("confirmDelete")}
            >
              <Text className="text-red-500 text-center text-lg">Delete Account</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-white/95 rounded-2xl overflow-hidden">
            <TouchableOpacity
              className="py-4 active:bg-gray-100"
              onPress={() => modalRef.current?.close()}
            >
              <Text className="text-blue-500 text-center text-lg font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : modalView === 'confirmDelete' ? (
        <>
          <View className="bg-white/95 rounded-2xl overflow-hidden mb-2">
            <View className="py-4 px-6">
              <Text className="text-gray-900 text-center text-base font-semibold mb-1">Delete Account</Text>
              <Text className="text-gray-500 text-center text-sm">
                This action cannot be undone. All your data will be permanently deleted.
              </Text>
            </View>
            <View className="h-px bg-gray-200" />
            <TouchableOpacity
              className="py-4 active:bg-gray-100"
              onPress={async () => {
                try {
                  await deleteAccount();
                  modalRef.current?.close();
                } catch (error) {
                  console.error('Error deleting account:', error);
                  modalRef.current?.close();
                }
              }}
            >
              <Text className="text-red-500 text-center text-lg font-semibold">Delete Account</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-white/95 rounded-2xl overflow-hidden">
            <TouchableOpacity
              className="py-4 active:bg-gray-100"
              onPress={() => setModalView('menu')}
            >
              <Text className="text-blue-500 text-center text-lg font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </View>
  </Modalize>
</Portal>
   </SafeAreaView>
 );
}