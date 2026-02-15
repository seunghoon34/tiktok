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
import { useThemePreference } from '@/providers/ThemeProvider';
import { useColorScheme } from 'nativewind';

type ModalView = 'menu' | 'confirmDelete';
type ThemeOption = 'system' | 'light' | 'dark';

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
 const { themePreference, setThemePreference } = useThemePreference();
 const { colorScheme } = useColorScheme();
 const isDark = colorScheme === 'dark';

 const router = useRouter()

 const themeOptions: { value: ThemeOption; label: string }[] = [
   { value: 'system', label: 'System' },
   { value: 'light', label: 'Light' },
   { value: 'dark', label: 'Dark' },
 ];

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
          const imageUrl = data.publicUrl;
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
   },
   {
    icon: "ban-outline" as const,
    title: "Blocked users",
    onPress: () => router.push('/blocked'),
  },
  {
    icon: "mail-outline" as const,
    title: "Contact Support",
    onPress: async () => {
      const url = 'mailto:s2.shootyourshot@gmail.com';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('No Mail App', 'Please email s2.shootyourshot@gmail.com for support.');
      }
    },
  },
  {
    icon: "trash-outline" as const,
    title: "Delete account",
    onPress: () => modalRef.current?.open(),
  }
 ];

 return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center justify-between">
          <View className="w-10" />
          <Text className="text-ios-title2 dark:text-white">Profile</Text>
          <TouchableOpacity
            className="w-10 items-end"
            onPress={() => Alert.alert('Log Out', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: signOut },
            ])}
            activeOpacity={0.6}
          >
            <Ionicons name="log-out-outline" size={24} color="#007C7B" />
          </TouchableOpacity>
        </View>
      </View>

     <ScrollView className="flex-1">
       <View className="items-center px-4 py-6">
      <View className="relative">
{hasVideos ? (
  <TouchableOpacity onPress={() => router.push('/stories')} activeOpacity={0.6}>
      <View className="p-0.5 rounded-full bg-[#007C7B]">
      <View className="p-0.5 bg-white dark:bg-black rounded-full">
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
            imageErrorTimeoutRef.current = setTimeout(() => {
              if (__DEV__) {
                console.error('[ProfileScreen] Image permanently failed to load:', error.nativeEvent);
                console.error('[ProfileScreen] Failed image URL:', imageUrl);
              }
            }, 3000);
          }}
        />
    ) : (
      <View className="h-avatar-xl w-avatar-xl rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center">
        <Ionicons name="person" size={40} color="#8E8E93" />
      </View>
    )}
  </View>
)}

        </View>

        <Text className="text-ios-title2 mt-4 dark:text-white">
          {user?.username}
        </Text>
        <Text className="text-ios-body text-gray-600 dark:text-gray-400">
          {profile?.name} <Text className="text-ios-body text-gray-600 dark:text-gray-400">
          {profile?.birthdate ?
            `${new Date().getFullYear() - new Date(profile.birthdate).getFullYear()}`
            : ''}
        </Text>
        </Text>



        <View className="w-full mt-6 px-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-ios-headline text-gray-900 dark:text-gray-100">About Me</Text>
            <TouchableOpacity
              onPress={() => router.push('/editprofile')}
              activeOpacity={0.6}
            >
              <Ionicons name="pencil" size={16} color={isDark ? '#0A84FF' : '#007AFF'} />
            </TouchableOpacity>
          </View>
          <View className="bg-gray-100 dark:bg-[#1C1C1E] p-4 rounded-xl">
            <Text className="text-ios-body text-gray-900 dark:text-gray-100 text-center">
              {profile?.aboutme || "No description yet"}
            </Text>
          </View>
        </View>


       </View>

      {/* Appearance Section */}
      <View className="px-4 py-2">
        <Text className="text-ios-footnote text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">Appearance</Text>
        <View className="flex-row bg-gray-200 dark:bg-[#1C1C1E] rounded-lg p-1">
          {themeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              className={`flex-1 py-2 rounded-md items-center ${
                themePreference === option.value
                  ? 'bg-white dark:bg-[#2C2C2E]'
                  : ''
              }`}
              style={themePreference === option.value ? {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.15,
                shadowRadius: 2,
                elevation: 2,
              } : undefined}
              onPress={() => setThemePreference(option.value)}
              activeOpacity={0.6}
            >
              <Text className={`text-ios-subhead ${
                themePreference === option.value
                  ? 'font-semibold text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View className="px-4 py-2">
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            className="flex-row items-center py-4"
            onPress={item.onPress}
            activeOpacity={0.6}
          >
            <Ionicons name={item.icon} size={24} color={isDark ? '#8E8E93' : '#636366'} />
            <Text className="flex-1 ml-3 text-ios-body text-gray-900 dark:text-gray-100">{item.title}</Text>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#48484A' : '#C7C7CC'} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
    <View className="absolute bottom-0 w-full pb-4">
      <Text className="text-center text-ios-footnote text-gray-500 dark:text-gray-400">
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
          <View className="bg-white/95 dark:bg-[#2C2C2E]/95 rounded-2xl overflow-hidden mb-2">
            <TouchableOpacity
              className="py-4 active:bg-gray-100 dark:active:bg-gray-800"
              onPress={() => setModalView("confirmDelete")}
            >
              <Text className="text-red-500 text-center text-lg">Delete Account</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-white/95 dark:bg-[#2C2C2E]/95 rounded-2xl overflow-hidden">
            <TouchableOpacity
              className="py-4 active:bg-gray-100 dark:active:bg-gray-800"
              onPress={() => modalRef.current?.close()}
            >
              <Text className="text-blue-500 text-center text-lg font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : modalView === 'confirmDelete' ? (
        <>
          <View className="bg-white/95 dark:bg-[#2C2C2E]/95 rounded-2xl overflow-hidden mb-2">
            <View className="py-4 px-6">
              <Text className="text-gray-900 dark:text-gray-100 text-center text-base font-semibold mb-1">Delete Account</Text>
              <Text className="text-gray-500 dark:text-gray-400 text-center text-sm">
                This action cannot be undone. All your data will be permanently deleted.
              </Text>
            </View>
            <View className="h-px bg-gray-200 dark:bg-gray-700" />
            <TouchableOpacity
              className="py-4 active:bg-gray-100 dark:active:bg-gray-800"
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
          <View className="bg-white/95 dark:bg-[#2C2C2E]/95 rounded-2xl overflow-hidden">
            <TouchableOpacity
              className="py-4 active:bg-gray-100 dark:active:bg-gray-800"
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
