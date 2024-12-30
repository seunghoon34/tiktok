import { View, Text, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { useAuth } from '@/providers/AuthProvider'; 
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useEffect, useState } from 'react';
import Header from '@/components/header';

export default function UserScreen() {
 const params = useLocalSearchParams();
 const [profile, setProfile] = useState(null);
 const router = useRouter();

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
     <Header title={profile.user.username} color="black" goBack={true} />
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
     
   </SafeAreaView>
 );
}