import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import "../../global.css";
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { formatDate } from '@/utils/formatDate';

export default function ActivityScreen() {
  const [notifications, setNotifications] = useState([]);
  const { user } = useAuth();

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('Notification')
        .select(`
          id,
          type,
          read,
          created_at,
          sender:from_user (id, username)
        `)
        .eq('to_user', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to match our component's expectations
      const formattedNotifications = data.map(notification => ({
        id: notification.id,
        type: notification.type,
        read: notification.read,
        username: notification.sender.username,
        time: formatDate(notification.created_at),
        actionable: notification.type === 'SHOT' || notification.type === 'MATCH',
        content: getNotificationContent(notification.type, notification.sender.username)
      }));

      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Format the notification content based on type
  const getNotificationContent = (type, username) => {
    switch (type) {
      case 'SHOT':
        return `${username} has shot their shot at you! 🎯`;
      case 'MATCH':
        return `You matched with ${username}! 🎉`;
      default:
        return 'New notification';
    }
  };

  // Format the time (you can reuse your existing formatDate function here)

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('Notification')
        .update({ read: true })
        .eq('to_user', user.id);

      if (error) throw error;

      // Update local state to reflect changes
      setNotifications(prevNotifications =>
        prevNotifications.map(notif => ({ ...notif, read: true }))
      );
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

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
    <View className="px-4 py-2 border-b border-gray-200">
      <View className="flex-row items-center justify-between">
        <Text className="font-bold" style={{fontSize:32}}>Activity</Text>
        <TouchableOpacity onPress={markAllAsRead}>
          <Text className="text-blue-500">Mark all as read</Text>
        </TouchableOpacity>
      </View>
    </View>

    <FlatList
      data={notifications}
      renderItem={renderNotification}
      keyExtractor={item => item.id}
      className="flex-1"
    />
  </SafeAreaView>
);
}