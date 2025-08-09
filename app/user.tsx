import { View, Text, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { useAuth } from '@/providers/AuthProvider'; 
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useEffect,  useRef, useState } from 'react';
import Header from '@/components/header';
import { Ionicons } from '@expo/vector-icons';
import { Modalize } from 'react-native-modalize';
import { Portal } from 'react-native-portalize';
import { reportContent, blockUser } from '@/utils/userModeration';
import Toast from 'react-native-toast-message';
import { FlatList } from 'react-native-reanimated/lib/typescript/Animated';
import { ScrollView } from 'react-native-gesture-handler';
import SkeletonLoader from '@/components/userSkeleton';

export default function UserScreen() {
 const params = useLocalSearchParams();
 const [profile, setProfile] = useState(null);
 const router = useRouter();
 const modalRef = useRef<Modalize>(null);
 const [modalView, setModalView] = useState<'menu' | 'confirmBlock' | 'reportReasons' | 'confirmReportReason'>('menu');
 const [selectedReason, setSelectedReason] = useState<'INAPPROPRIATE_CONTENT' | 'HARASSMENT' | 'SPAM' | 'FAKE_PROFILE' | 'OTHER' | null>(null);
 const { user } = useAuth();

 useEffect(() => {
  const getProfile = async () => {
    try {
      console.log('[UserScreen] Fetching profile for user_id:', params.user_id);
      const { data, error } = await supabase
        .from('UserProfile')
        .select(`
          *,
          user:User (
            username
          )
        `)
        .eq('user_id', params.user_id)
        .single();
 
      if (error) {
        console.error('[UserScreen] Error fetching profile:', error);
        return;
      }
 
      if (data) {
        console.log('[UserScreen] Profile data received:', { ...data, profilepicture: data.profilepicture ? 'exists' : 'null' });
        
        if (data.profilepicture) {
          console.log('[UserScreen] Getting public URL for:', data.profilepicture);
          const { data: publicData, error: storageError } = supabase.storage
            .from('profile_images')
            .getPublicUrl(data.profilepicture);
          
          if (storageError) {
            console.error('[UserScreen] Error getting public URL:', storageError);
          }
          
          if (publicData?.publicUrl) {
            const imageUrl = `${publicData.publicUrl}?t=${Date.now()}`;
            console.log('[UserScreen] Setting image URL:', imageUrl);
            
            // Test if the image actually loads (web only)
            if (typeof window !== 'undefined' && window.Image) {
              const testImage = new window.Image();
              testImage.onload = () => {
                console.log('[UserScreen] ✅ Image loaded successfully');
              };
              testImage.onerror = (error: any) => {
                console.error('[UserScreen] ❌ Failed to load image:', error);
                console.error('[UserScreen] Image URL that failed:', imageUrl);
              };
              testImage.src = imageUrl;
            }
            
            setProfile({...data, profilepicture: imageUrl});
          } else {
            console.log('[UserScreen] No public URL returned from storage');
            setProfile({...data, profilepicture: null});
          }
        } else {
          console.log('[UserScreen] No profile picture path in data');
          setProfile({...data, profilepicture: null});
        }
      } else {
        console.log('[UserScreen] No profile data returned');
      }
    } catch (error) {
      console.error('[UserScreen] Exception in getProfile:', error);
    }
  };
  getProfile();
 }, [params.user_id]);
 

 if (!profile) {
  return <SkeletonLoader />;
 }

 const getAge = (birthdate) => {
   return new Date().getFullYear() - new Date(birthdate).getFullYear();
 };

 const handleReasonSelect = (reason: 'INAPPROPRIATE_CONTENT' | 'HARASSMENT' | 'SPAM' | 'FAKE_PROFILE' | 'OTHER') => {
  setSelectedReason(reason);
  setModalView('confirmReportReason');
};

 return (
   <SafeAreaView className="flex-1 bg-white">
    <ScrollView>
    <View className="flex-row items-center justify-between w-full px-4 py-3">
      <View className="w-10">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={32} color="black"/>
        </TouchableOpacity>
      </View>
      
      <View className="flex-1 items-center">
        <Text className="font-bold text-2xl" style={{color: "black"}}>
          {profile.user.username}
        </Text>
      </View>
      <View className="w-10">
        <TouchableOpacity onPress={() => modalRef.current?.open()}>
          <Ionicons name="ellipsis-vertical" size={32} color="black"/>
        </TouchableOpacity>
      </View>
     </View>

     <View className='flex-1 bg-white'>
       <View className="relative mx-4 mt-2">
         <View className="aspect-[3/4] rounded-3xl overflow-hidden">
           {profile.profilepicture ? (
                        <Image
             source={{ uri: profile.profilepicture }}
             className="w-full h-full"
             onLoad={() => console.log('[UserScreen] Image component loaded successfully')}
             onError={(error) => {
               console.error('[UserScreen] Image component failed to load:', error.nativeEvent);
               console.error('[UserScreen] Failed image URL:', profile.profilepicture);
             }}
           />
           ) : (
             <View className="w-full h-full bg-gray-300 items-center justify-center">
               <Text className="text-4xl text-gray-400">No Image</Text>
             </View>
           )}
           
           {/* Name and age overlay */}
           <View className="absolute bottom-3 left-2 right-4 p-4 rounded-2xl">
             <Text className="text-3xl font-bold text-white">
               {profile.name},{' '}
               <Text className='font-normal text-gray-200'>
                 {getAge(profile.birthdate)}
               </Text>
             </Text>
           </View>
         </View>
       </View>

       <View className="p-4 mx-4 bg-white mt-5 shadow-sm rounded-3xl">
         <Text className='text-xl font-bold'>About Me</Text>
         <Text className="text-gray-600 text-lg">
           {profile.aboutme || "No description yet"}
         </Text>
       </View>
     </View>
     </ScrollView>
     

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
       onClose={() => setModalView('menu')}
     >
       <View className="py-2 pb-10">
         {modalView === 'menu' && (
           <>
             <TouchableOpacity
               className="flex-row items-center px-4 py-3 active:bg-gray-800"
               onPress={() => setModalView('reportReasons')}
             >
               <Ionicons name="person-remove-outline" size={24} color="red" className="mr-3" />
               <Text className="text-red-600 text-[16px]">Report {profile.user.username}</Text>
             </TouchableOpacity>

             <TouchableOpacity
               className="flex-row items-center px-4 py-3 active:bg-gray-800"
               onPress={() => setModalView('confirmBlock')}
             >
               <Ionicons name="ban-outline" size={24} color="red" className="mr-3" />
               <Text className="text-red-600 text-[16px]">Block {profile.user.username}</Text>
             </TouchableOpacity>

             <TouchableOpacity
               className="flex-row items-center px-4 py-3 active:bg-gray-800"
               onPress={() => modalRef.current?.close()}
             >
               <Ionicons name="close-outline" size={24} color="white" className="mr-3" />
               <Text className="text-white text-[16px]">Cancel</Text>
             </TouchableOpacity>
           </>
         )}

         {modalView === 'reportReasons' && (
           <View className="px-4 py-3">
             <Text className="text-white text-lg mb-4">
               Why are you reporting this user?
             </Text>
             
             {(['INAPPROPRIATE_CONTENT', 'HARASSMENT', 'SPAM', 'FAKE_PROFILE', 'OTHER'] as const).map((reason) => (
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
         )}

         {modalView === 'confirmReportReason' && (
           <View className="px-4 py-3">
             <Text className="text-white text-lg mb-4">
               Are you sure you want to report {profile.user.username} for{' '}
               {selectedReason?.toLowerCase().replace(/_/g, ' ')}?
             </Text>
             
             <TouchableOpacity
               className="bg-red-500 rounded-lg py-3 mb-3"
               onPress={async () => {
                 if (!selectedReason) return;
                 try {
                   const result = await reportContent(
                     user.id,
                     params.user_id,
                     'USER',
                     params.user_id,
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
               }}
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
         )}

         {modalView === 'confirmBlock' && (
           <View className="px-4 py-3">
             <Text className="text-white text-lg mb-4">
               Are you sure you want to block {profile.user.username}?
             </Text>
             <TouchableOpacity
               className="bg-red-500 rounded-lg py-3 mb-3"
               onPress={async () => {
                 try {
                   const result = await blockUser(user.id, params.user_id);
                   if (result.status === 'success' || result.status === 'already_blocked') {
                     modalRef.current?.close();
                     setModalView('menu');
                     Toast.show({
                       type: 'success',
                       text1: 'User Blocked',
                       text2: `You have blocked ${profile.user.username}`,
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
         )}
       </View>
     </Modalize>
   </Portal>
   <Toast />
 </SafeAreaView>
 );
}