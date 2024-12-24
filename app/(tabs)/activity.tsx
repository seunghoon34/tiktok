import { View, Text, FlatList, TouchableOpacity, Image, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import "../../global.css";
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { formatDate } from '@/utils/formatDate';
import { useFocusEffect } from '@react-navigation/native';
import { useNotifications } from '@/providers/NotificationProvider';

export default function ActivityScreen() {
  const [notifications, setNotifications] = useState([]);
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(true);
  const { setUnreadCount } = useNotifications();

  const markAsRead = async () => {
    try {
      const { error } = await supabase
        .from('Notification')
        .update({ read: true })
        .eq('to_user', user.id)
        .eq('read', false); // Only update unread notifications

      if (error) throw error;

      // Update local state to reflect changes
      setNotifications(prevNotifications =>
        prevNotifications.map(notif => ({ ...notif, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
      markAsRead(); // Automatically mark as read when screen comes into focus
    }, [user])
  );

  useEffect(() => {
    if (!user) return;

    fetchNotifications(); // Initial fetch
    
    // Set up interval
    const interval = setInterval(fetchNotifications, 10000);

    // Handle app state changes
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        fetchNotifications();
      }
    });

    // Cleanup
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [user]);

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

      const unreadNotifications = data.filter(notification => !notification.read).length;
      setUnreadCount(unreadNotifications);

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

  const getNotificationContent = (type, username) => {
    switch (type) {
      case 'SHOT':
        return isPremium 
        ? `${username} has shot their shot at you! 🎯`
        : `**** has shot their shot at you! 🎯`;
      case 'MATCH':
        return `You matched with ${username}! 🎉`;
      default:
        return 'New notification';
    }
  };

  const renderNotification = ({ item }) => (
    <TouchableOpacity 
      className={`p-4 border-b border-gray-100 ${!item.read ? 'bg-blue-50' : ''}`}
    >
      <View className="flex-row items-center">
        <View className="h-12 w-12 rounded-full bg-gray-200 items-center justify-center mr-3">
          <Ionicons name="person" size={24} color="#9CA3AF" />
        </View>
  
        <View className="flex-1">
          <View className="flex-row justify-between items-start">
            <Text className={`text-base flex-1 ${!item.read ? 'font-semibold' : ''}`}>
              {item.content}
            </Text>
            <Text className="text-gray-500 text-sm ml-2">
              {item.time}
            </Text>
          </View>
  
          {item.actionable && (
            <View className="flex-row mt-2">
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
                <></>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 py-2 border-gray-200">
        <View className="flex-row items-center justify-between">
          <Text className="font-bold" style={{fontSize:32}}>Activities</Text>
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