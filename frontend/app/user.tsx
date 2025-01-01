import { View, Text, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { useAuth } from '@/providers/AuthProvider'; 
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useEffect,  useRef, useState } from 'react';
import Header from '@/components/header';
import { Ionicons } from '@expo/vector-icons';
import { Modalize } from 'react-native-modalize';
import { Portal } from 'react-native-portalize';

export default function UserScreen() {
 const params = useLocalSearchParams();
 const [profile, setProfile] = useState(null);
 const router = useRouter();
 const modalRef = useRef<Modalize>(null);
 const [modalView, setModalView] = useState<'menu' | 'confirmBlock'>('menu');

 useEffect(() => {
  const getProfile = async () => {
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
 
    if (data) {
      const { data: urlData } = await supabase.storage
        .from('avatars')
        .createSignedUrl(data.profilepicture, 3600);
      if (urlData) {
        setProfile({...data, profilepicture: urlData.signedUrl});
      }
    }
  };
  getProfile();
 }, [params.user_id]);
 

 if (!profile) {
   return (
     <SafeAreaView className="flex-1 bg-white">
       <Header title="" color="black" goBack={true} />
       <Text>Loading...</Text>
     </SafeAreaView>
   );
 }

 const getAge = (birthdate) => {
   return new Date().getFullYear() - new Date(birthdate).getFullYear();
 };

 return (
   <SafeAreaView className="flex-1 bg-white">
     <View className="flex-row items-center justify-between w-full px-4 py-2">
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
     <View className='h-full bg-white'>
     <View className="h-96 w-full">
       {profile.profilepicture ? (
         <Image
           source={{ uri: profile.profilepicture }}
           className="w-full h-full"
         />
       ) : (
         <View className="w-full h-full bg-gray-300 items-center justify-center">
           <Text className="text-4xl text-gray-400">No Image</Text>
         </View>
       )}
     </View>

     <View className="p-4 mx-2 bg-white mt-5 shadow-sm  rounded-3xl">
      <View className="flex-row items-center gap-4 mb-4">
        <Text className="text-3xl font-bold flex-1">
          {profile.name}  <Text className='font-normal text-gray-600'>
            {getAge(profile.birthdate)}
          </Text>
        </Text>
      </View>
      </View>

       <View className="p-4 mx-2 bg-white mt-5 shadow-sm  rounded-3xl">
        <Text className='text-xl font-bold'>About Me</Text>
         <Text className="text-gray-600 text-lg">
           {profile.aboutme || "No description yet"}
         </Text>
       </View>

       
     </View>
     

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
         {modalView === 'menu' ? (
           <>
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
         ) : (
           <View className="px-4 py-3">
             <Text className="text-white text-lg mb-4">
               Are you sure you want to block {profile.user.username}?
             </Text>
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
 </SafeAreaView>
 );
}