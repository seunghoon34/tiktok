import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import "../../global.css";

export default function NotificationsScreen() {
 const [notifications] = useState([
   {
     id: '1',
     type: 'shot',
     content: 'Sarah has shot their shot at you! 🎯',
     time: '2 minutes ago',
     read: false,
     actionable: true,
     username: 'Sarah'
   },
   {
     id: '2', 
     type: 'match',
     content: 'You matched with Michael! 🎉',
     time: '1 hour ago',
     read: true,
     actionable: true,
     username: 'Michael'
   },
   {
     id: '3',
     type: 'shot',
     content: 'Alex has shot their shot at you! 🎯',
     time: '3 hours ago',
     read: true,
     actionable: true,
     username: 'Alex'
   },
   {
     id: '4',
     type: 'match',
     content: 'You matched with Emma! 🎉', 
     time: 'Yesterday',
     read: true,
     actionable: false,
     username: 'Emma'
   },
   {
     id: '5',
     type: 'profile',
     content: 'Someone viewed your profile 👀',
     time: 'Yesterday',
     read: true,
     actionable: false,
     username: 'Anonymous'
   },
   {
    id: '6',
    type: 'shot',
    content: '**** has shot their shot at you! 🎯',
    time: 'Yesterday',
    read: true,
    actionable: false,
    username: 'Anonymous'
  }
 ]);

 const renderNotification = ({ item }) => (
   <TouchableOpacity 
     className={`p-4 border-b border-gray-100 ${!item.read ? 'bg-blue-50' : ''}`}
   >
     <View className="flex-row items-center">
       {/* Profile Picture Placeholder */}
       <View className="h-12 w-12 rounded-full bg-gray-200 items-center justify-center mr-3">
         <Ionicons name="person" size={24} color="#9CA3AF" />
       </View>

       <View className="flex-1 flex-row items-center justify-between">
         <View className="flex-1">
           <Text className={`text-base mb-1 ${!item.read ? 'font-semibold' : ''}`}>
             {item.content}
           </Text>
           <Text className="text-gray-500 text-sm">
             {item.time}
           </Text>
         </View>
         
         {item.actionable && (
           <View className="ml-4">
             {item.type === 'shot' ? (
               <View className="flex-row">
                 <TouchableOpacity className="bg-green-500 rounded-full p-2 mr-2">
                   <Ionicons name="checkmark" size={16} color="white" />
                 </TouchableOpacity>
                 <TouchableOpacity className="bg-red-500 rounded-full p-2">
                   <Ionicons name="close" size={16} color="white" />
                 </TouchableOpacity>
               </View>
             ) : (
               <TouchableOpacity className="bg-blue-500 rounded-full px-4 py-1">
                 <Text className="text-white font-medium">Message</Text>
               </TouchableOpacity>
             )}
           </View>
         )}
       </View>
     </View>
   </TouchableOpacity>
 );

 return (
   <SafeAreaView className="flex-1 bg-white">
     {/* Header */}
     <View className="px-4 py-2 border-b border-gray-200">
       <View className="flex-row items-center justify-between">
         <Text className="font-bold" style={{fontSize:32}}>Notifications</Text>
         <TouchableOpacity>
           <Text className="text-blue-500">Mark all as read</Text>
         </TouchableOpacity>
       </View>
     </View>

     {/* Notifications List */}
     <FlatList
       data={notifications}
       renderItem={renderNotification}
       keyExtractor={item => item.id}
       className="flex-1"
     />
   </SafeAreaView>
 );
}