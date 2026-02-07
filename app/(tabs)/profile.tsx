import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import "../../global.css";
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Modalize } from 'react-native-modalize';
import { Portal } from 'react-native-portalize';

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



 const router = useRouter()


 const getProfile = async () => {
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
          const imageUrl = `${data.publicUrl}?t=${Date.now()}`;
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
}, [profile]);

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
    icon: "trash-outline" as const,
    title: "Delete account",
    onPress: () => modalRef.current?.open(),
  }
 ];

 return (
   <SafeAreaView className="flex-1 bg-white">
     <View className="px-4 py-2 border-b border-gray-100">
       <View className="flex-row items-center justify-between">
         <View className="w-10" />
         <Text className="font-bold text-xl">Profile</Text>
         <TouchableOpacity 
           className="w-10" 
           onPress={signOut}
         >
           <Ionicons name="log-out-outline" size={24} color="#EF4444" />
         </TouchableOpacity>
       </View>
     </View>

     <ScrollView className="flex-1">
       <View className="items-center px-4 py-6">
       <View className="relative">
 {hasVideos ? (
   <TouchableOpacity onPress={() => router.push('/stories')}>
     <View className="p-0.5 rounded-full bg-red-400">
       <View className="p-0.5 bg-white rounded-full">
         <Image 
           source={{ uri: imageUrl ?? undefined }}
           className="h-24 w-24 rounded-full"
           onLoad={() => console.log('[ProfileScreen] Image component loaded successfully')}
           onError={(error) => {
             console.error('[ProfileScreen] Image component failed to load:', error.nativeEvent);
             console.error('[ProfileScreen] Failed image URL:', imageUrl);
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
           className="h-24 w-24 rounded-full"
           onLoad={() => console.log('[ProfileScreen] Image component loaded successfully (with stories)')}
           onError={(error) => {
             console.error('[ProfileScreen] Image component failed to load (with stories):', error.nativeEvent);
             console.error('[ProfileScreen] Failed image URL:', imageUrl);
           }}
         />
     ) : (
       <View className="h-24 w-24 rounded-full bg-gray-200 items-center justify-center">
         <Ionicons name="person" size={40} color="#9CA3AF" />
       </View>
     )}
   </View>
 )}
           
         </View>
         
         <Text className="text-xl font-bold mt-4">
           {user?.username}
         </Text>
         <Text className="text-gray-500">
           {profile?.name} <Text className="text-gray-500 mt-1">
           {profile?.birthdate ? 
             `${new Date().getFullYear() - new Date(profile.birthdate).getFullYear()}` 
             : ''}  
         </Text>
         </Text>
        
        
         
         <View className="w-full mt-4 px-4">
           <View className="flex-row justify-between items-center">
             <Text className="text-gray-600 font-medium mb-2">About Me</Text>
             <TouchableOpacity 
               onPress={() => router.push('/editprofile')}
               className="mb-2"
             >
               <Ionicons name="pencil" size={16} color="#3B82F6" />
             </TouchableOpacity>
           </View>
           <Text className="text-gray-600 text-center bg-gray-50 p-4 rounded-xl">
             {profile?.aboutme || "No description yet"}
           </Text>
         </View>
         
         
       </View>

      

       <View className="px-4 py-2">
         {menuItems.map((item, index) => (
           <TouchableOpacity
             key={index}
             className="flex-row items-center py-4 border-b border-gray-100"
             onPress={item.onPress}
           >
             <Ionicons name={item.icon} size={24} color="#4B5563" />
             <Text className="flex-1 ml-4 text-base">{item.title}</Text>
             <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
           </TouchableOpacity>
         ))}
       </View>
     </ScrollView>
     <View className="absolute bottom-0 w-full pb-4">
       <Text className="text-center text-gray-400">
         Version 1.0.0
       </Text>
     </View>
     <Portal>
  <Modalize
    ref={modalRef}
    modalHeight={200}
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
            onPress={()=> {console.log("delete account?")
              setModalView("confirmDelete")
            }}
          >
            <View className="w-8 h-8 bg-red-500/20 rounded-full items-center justify-center mr-4">
              <Ionicons name="person-remove-outline" size={18} color="#ef4444" />
            </View>
            <Text className="text-white text-base font-medium">Delete Account</Text>
          </TouchableOpacity>

          
        </>
      )  : modalView === 'confirmDelete' ? (
        <View className="px-4 py-3">
          <Text className="text-white text-lg mb-4">Are you sure you want to delete your account?</Text>
          <TouchableOpacity
            className="bg-red-500 rounded-lg py-3 mb-3"
            onPress={async () => {
              try {
                await deleteAccount();
                modalRef.current?.close();
              } catch (error) {
                console.error('Error deleting account:', error);
                modalRef.current?.close();

                // Handle error (show alert, etc)
              }
            }}          >
            <Text className="text-white text-center font-semibold text-lg">Delete Account</Text>
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
   </SafeAreaView>
 );
}