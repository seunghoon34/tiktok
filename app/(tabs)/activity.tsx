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
import { useRouter } from 'expo-router';

interface Notification {
  id: string;
  type: string;
  read: boolean;
  username: string;
  userId: string;
  time: string;
  actionable: boolean;
  content: string;
}

interface RawNotification {
  id: string;
  type: string;
  read: boolean;
  created_at: string;
  sender: {
    id: string;
    username: string;
  } | null;
}

export default function ActivityScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(true);
  const { setUnreadCount } = useNotifications();
  const router = useRouter();
  const [userProfiles, setUserProfiles] = useState<{[key: string]: string | null}>({});

  const markSingleAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('Notification')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notif => 
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
      
      // Note: unread count is now updated globally by NotificationProvider
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('Notification')
        .update({ read: true })
        .eq('to_user', user.id)
        .eq('read', false);

      if (error) throw error;

      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notif => ({ ...notif, read: true }))
      );
      // Note: unread count is now updated globally by NotificationProvider
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };
 

  useEffect(() => {
    if (!user) return;
  
    fetchNotifications(); // Initial fetch
  
    // Set up real-time subscription
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (insert, update, delete)
          schema: 'public',
          table: 'Notification',
          filter: `to_user=eq.${user.id}` // Only listen for notifications to this user
        },
        (payload) => {
          // Handle different events
          switch (payload.eventType) {
            case 'INSERT':
              fetchNotifications(); // Fetch all notifications when new one arrives
              break;
            case 'UPDATE':
              // Update the specific notification in state
              setNotifications(prev => prev.map(notif => 
                notif.id === payload.new.id ? {
                  ...notif,
                  read: payload.new.read
                } : notif
              ));
              break;
            case 'DELETE':
              // Remove the notification from state
              setNotifications(prev => 
                prev.filter(notif => notif.id !== payload.old.id)
              );
              break;
          }
        }
      )
      .subscribe();

      const appStateSubscription = AppState.addEventListener('change', nextAppState => {
        if (nextAppState === 'active') {
          fetchNotifications();
        }
      });
    
      // Cleanup
      return () => {
        subscription.unsubscribe();
        appStateSubscription.remove();
      };
    }, [user]);

  const findChatId = async (userId1: string, userId2: string) => {
    const { data, error } = await supabase
      .from('Chat')
      .select('id')
      .or(`and(user1_id.eq.${userId1},user2_id.eq.${userId2}),and(user1_id.eq.${userId2},user2_id.eq.${userId1})`);
    
    if (error || !data?.length) return null;
    return data[0].id;
  };

  const handleNotificationPress = async (item: Notification) => {
    // Mark as read first
    if (!item.read) {
      await markSingleAsRead(item.id);
    }

    // Then navigate based on type
    if (item.type === 'SHOT') {
      router.push(`/user?user_id=${item.userId}`);
    } else if (item.type === 'MATCH') {
      const chatId = await findChatId(user.id, item.userId);
      if (chatId) {
        router.push(`/chat/${chatId}`);
      }
    }
  };
  const fetchNotifications = async () => {
    try {
      // First, get list of blocked users
      const { data: blockedUsers, error: blockError } = await supabase
        .from('UserBlock')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

      if (blockError) throw blockError;

      // Create array of user IDs to exclude
      const excludeUserIds = blockedUsers?.reduce((acc: string[], block) => {
        if (block.blocker_id === user.id) acc.push(block.blocked_id);
        if (block.blocked_id === user.id) acc.push(block.blocker_id);
        return acc;
      }, []);

      // Get notifications excluding blocked users
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
        .not(excludeUserIds.length > 0 ? 'from_user' : 'id', 
             excludeUserIds.length > 0 ? 'in' : 'eq', 
             excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : user.id)
        .order('created_at', { ascending: false })


      if (error) throw error;

      // Note: unread count is now managed globally by NotificationProvider

      const formattedNotifications: Notification[] = (data as any[]).map((notification: any) => ({
        id: notification.id,
        type: notification.type,
        read: notification.read,
        username: notification.sender?.username || 'Unknown',
        userId: notification.sender?.id || '',
        time: formatDate(notification.created_at),
        actionable: notification.type === 'SHOT' || notification.type === 'MATCH',
        content: getNotificationContent(notification.type, notification.sender?.username || 'Unknown')
      }));

      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const getNotificationContent = (type: string, username: string) => {
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

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      className={`p-4 border-b border-gray-100 ${!item.read ? 'bg-blue-50' : ''}`}
      onPress={()=>handleNotificationPress(item)}
    >
      <View className="flex-row items-center">
        <View className="h-12 w-12 rounded-full bg-gray-200 items-center justify-center mr-3">
          {userProfiles[item.userId] ? (
            <Image 
              source={{ uri: userProfiles[item.userId] || undefined }}
              className="h-12 w-12 rounded-full"
            />
          ) : (
            <Ionicons name="person" size={24} color="#9CA3AF" />
          )}
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

  useEffect(() => {
    const fetchUserProfiles = async () => {
      const userIds = notifications.map(notification => notification.userId);
      // Remove duplicates
      const uniqueUserIds = [...new Set(userIds)];
      
      const profiles: {[key: string]: string | null} = {};
      
      await Promise.all(uniqueUserIds.map(async (userId) => {
        const { data } = await supabase
          .from('UserProfile')
          .select(`
            *,
            user:User (
              username
            )
          `)
          .eq('user_id', userId)
          .single();

        if (data) {
          const { data: publicData } = supabase.storage
            .from('profile_images')
            .getPublicUrl(data.profilepicture);
          profiles[userId] = publicData?.publicUrl ? `${publicData.publicUrl}?t=${Date.now()}` : null;
        }
      }));

      setUserProfiles(profiles);
    };

    if (notifications.length > 0) {
      fetchUserProfiles();
    }
  }, [notifications]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 py-2 border-gray-200">
        <View className="flex-row items-center justify-between">
          <Text className="font-bold" style={{fontSize:32}}>Activities</Text>
          {notifications.some(n => !n.read) && (
            <TouchableOpacity 
              onPress={markAllAsRead}
              
            >
              <Text className="text-red-400">Mark all as read</Text>
            </TouchableOpacity>
          )}
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