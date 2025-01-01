import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import "../../global.css";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';

export default function ProfileScreen() {
 const { signOut, user } = useAuth();
 const [profile, setProfile] = useState(null);
 const [imageUrl, setImageUrl] = useState(null);


 const getProfile = async () => {
  const { data, error } = await supabase
    .from('UserProfile')
    .select('*')
    .eq('user_id', user?.id)
    .single();
  
  if (data) setProfile(data);
};

useFocusEffect(
  useCallback(() => {
    getProfile();
  }, [])
);

 useEffect(() => {
  const getSignedUrl = async () => {
    if (profile?.profilepicture) {
      const { data, error } = await supabase.storage
        .from('avatars')
        .createSignedUrl(profile.profilepicture, 60 * 60); // 1 hour expiry
      if (data) setImageUrl(data.signedUrl);
    }
  };
  getSignedUrl();
 }, [profile]);

 useFocusEffect(
  useCallback(() => {
    getProfile();
  }, [])
);
 

 const menuItems = [
   {
     icon: "person-outline",
     title: "Edit Profile",
     onPress: () => router.push('/editprofile'),
   },
   {
     icon: "notifications-outline",
     title: "Notifications",
     onPress: () => router.push('/notifications'),
   },
   {
     icon: "lock-closed-outline",
     title: "Privacy",
     onPress: () => router.push('/privacy'),
   },
   {
     icon: "help-circle-outline",
     title: "Help & Support",
     onPress: () => router.push('/support'),
   },
   {
     icon: "settings-outline",
     title: "Settings",
     onPress: () => router.push('/settings'),
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
           {profile?.profilepicture ? (
             <Image 
               source={{ uri: imageUrl }}
               className="h-24 w-24 rounded-full"
             />
           ) : (
             <View className="h-24 w-24 rounded-full bg-gray-200 items-center justify-center">
               <Ionicons name="person" size={40} color="#9CA3AF" />
             </View>
           )}
           <TouchableOpacity 
             className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-2"
             onPress={() => router.push('/editprofile')}
           >
             <Ionicons name="camera" size={16} color="white" />
           </TouchableOpacity>
         </View>
         
         <Text className="text-xl font-bold mt-4">
           {user?.email?.split('@')[0]}
         </Text>
         <Text className="text-gray-500">
           {profile?.name}
         </Text>
         <Text className="text-gray-500 mt-1">
           {profile?.birthdate ? 
             `${new Date().getFullYear() - new Date(profile.birthdate).getFullYear()} years old` 
             : ''}
         </Text>
         <Text className="text-gray-500">
           {user?.email}
         </Text>
         
         <View className="w-full mt-4 px-4">
           <View className="flex-row justify-between items-center">
             <Text className="text-gray-600 font-medium mb-2">About</Text>
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
         
         <View className='flex-row gap-3'>
           <TouchableOpacity 
             className="mt-4 px-6 py-2 bg-blue-500 rounded-full"
             onPress={() => router.push('/editprofile')}
           >
             <Text className="text-white font-medium">Edit Profile</Text>
           </TouchableOpacity>
           <TouchableOpacity 
             className="mt-4 px-6 py-2 bg-blue-500 rounded-full"
             onPress={() => router.push('/createprofile')}
           >
             <Text className="text-white font-medium">Create Profile</Text>
           </TouchableOpacity>
         </View>
       </View>

       <View className="flex-row justify-around py-4 border-y border-gray-100">
         <View className="items-center">
           <Text className="font-bold text-lg">0</Text>
           <Text className="text-gray-500">Friends</Text>
         </View>
         <View className="items-center">
           <Text className="font-bold text-lg">0</Text>
           <Text className="text-gray-500">Photos</Text>
         </View>
         <View className="items-center">
           <Text className="font-bold text-lg">0</Text>
           <Text className="text-gray-500">Posts</Text>
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

       <Text className="text-center text-gray-400 py-4">
         Version 1.0.0
       </Text>
     </ScrollView>
   </SafeAreaView>
 );
}