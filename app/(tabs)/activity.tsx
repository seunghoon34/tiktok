import { View, Text, FlatList, TouchableOpacity, Image, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import "../../global.css";
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { formatDate } from '@/utils/formatDate';
import { useFocusEffect } from '@react-navigation/native';
import { notificationCache } from '@/utils/notificationCache';
import { useNotifications } from '@/providers/NotificationProvider';
import { useRouter } from 'expo-router';
import { profileCache } from '@/utils/profileCache';

export default function ActivityScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false); // Set to false for free users
  const { setUnreadCount } = useNotifications();
  const router = useRouter();
  const [userProfiles, setUserProfiles] = useState<Record<string, string | null>>({});

  const markSingleAsRead = async (notificationId: string) => {
    try {
      // Use notification cache for efficient update
      await notificationCache.markNotificationAsRead(user.id, notificationId);

      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notif => 
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
      
      // Note: unread count is now updated automatically via real-time subscription in tab layout
    } catch (error) {
      console.error('[Activity] Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      console.log('[Activity] Marking all notifications as read for user:', user.id);
      
      // Update in database - only update currently unread notifications
      const { error } = await supabase
        .from('Notification')
        .update({ read: true })
        .eq('to_user', user.id)
        .eq('read', false);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );

      // Invalidate and refetch to ensure cache is correct
      await notificationCache.markAllNotificationsAsRead(user.id);
      console.log('[Activity] All notifications marked as read');
      
    } catch (error) {
      console.error('[Activity] Error marking all as read:', error);
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
              // Add new notification to cache and refresh
              notificationCache.addNotificationToCache(user.id, payload.new);
              fetchNotifications(); // Refresh to get the formatted notification
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
              // Remove the notification from state and invalidate cache
              setNotifications(prev => 
                prev.filter(notif => notif.id !== payload.old.id)
              );
              notificationCache.invalidateNotifications(user.id);
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
    // Parallelize block check and chat find
    const [blockResult, chatResult] = await Promise.all([
      supabase
        .from('UserBlock')
        .select('id')
        .or(`and(blocker_id.eq.${userId1},blocked_id.eq.${userId2}),and(blocker_id.eq.${userId2},blocked_id.eq.${userId1})`),
      supabase
        .from('Chat')
        .select('id')
        .or(`and(user1_id.eq.${userId1},user2_id.eq.${userId2}),and(user1_id.eq.${userId2},user2_id.eq.${userId1})`)
    ]);

    const { data: blockData } = blockResult;
    const { data: chatData, error: chatError } = chatResult;

    // If there's a block, don't return chat ID
    if (blockData && blockData.length > 0) {
      console.log('[Activity] Cannot access chat - user is blocked');
      return null;
    }

    if (chatError || !chatData?.length) return null;
    return chatData[0].id;
  };

  const handleNotificationPress = async (item: any) => {
    // Mark as read first
    if (!item.read) {
      await markSingleAsRead(item.id);
    }

    // Then navigate based on type
    if (item.type === 'SHOT') {
      router.push('/feed');
    } else if (item.type === 'MATCH') {
      const chatId = await findChatId(user.id, item.userId);
      if (chatId) {
        router.push(`/chat/${chatId}`);
      }
    }
  };
  const fetchNotifications = async () => {
    try {
      // Invalidate old cached data so it re-processes with fixed logic
      await notificationCache.invalidateNotifications(user.id);

      // Parallelize notifications and blocked users fetch
      console.log(`[Activity] Loading notifications for user: ${user.id}`);
      const [result, blockedResult] = await Promise.all([
        notificationCache.getNotificationsWithSync(user.id),
        supabase
          .from('UserBlock')
          .select('blocker_id, blocked_id')
          .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)
      ]);

      console.log(`[Activity] Loaded ${result.notifications.length} notifications from ${result.source}`);
      if (result.hasNewNotifications) {
        console.log(`[Activity] Found ${result.newNotificationCount} new notifications`);
      }

      // Filter out notifications from blocked users
      const { data: blockedUsers } = blockedResult;
      const blockedUserIds = new Set(
        blockedUsers?.reduce((acc: string[], block) => {
          if (block.blocker_id === user.id) acc.push(block.blocked_id);
          if (block.blocked_id === user.id) acc.push(block.blocker_id);
          return acc;
        }, []) || []
      );

      const filteredNotifications = result.notifications.filter(
        notif => !blockedUserIds.has(notif.userId)
      );

      console.log(`[Activity] Filtered out ${result.notifications.length - filteredNotifications.length} notifications from blocked users`);

      // Parallelize profile fetching for filtered notifications
      const userIds = filteredNotifications.map(notification => notification.userId);
      const uniqueUserIds = [...new Set(userIds)];

      const profiles: Record<string, string | null> = {};
      await Promise.all(uniqueUserIds.map(async (userId) => {
        const profile = await profileCache.getProfile(userId);
        profiles[userId] = profile?.profilepicture || null;
      }));

      setUserProfiles(profiles);
      setNotifications(filteredNotifications);
    } catch (error) {
      console.error('[Activity] Error fetching notifications:', error);
    }
  };

  const getNotificationContent = (type: any, username: any) => {
    switch (type) {
      case 'SHOT':
        return isPremium
        ? `${username || 'Someone'} fired a shot your way! 💘`
        : `A shot was fired your way! 💘`;
      case 'MATCH':
        return `You matched with ${username || 'someone'}! 🎉`;
      default:
        return 'New notification';
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const now = new Date();
    // Supabase stores timestamps in UTC without timezone suffix
    // Append 'Z' to ensure JavaScript parses it as UTC
    const utcDateString = dateString.endsWith('Z') || dateString.includes('+') ? dateString : dateString + 'Z';
    const date = new Date(utcDateString);
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${diffInDays}d ago`;
  };

  const renderNotification = ({ item }: { item: any }) => {
    // All notifications are clickable (removed disabled state for matches)
    const isClickable = true;
    
    // Get the username - handle sender being array or object
    const sender = Array.isArray(item.sender) ? item.sender[0] : item.sender;
    const username = item.username || sender?.username || 'Someone';
    
    // Build display content based on type
    let displayContent = '';
    if (item.type === 'SHOT') {
      displayContent = isPremium
        ? `${username} fired a shot your way! 💘`
        : `A shot was fired your way! 💘`;
    } else if (item.type === 'MATCH') {
      displayContent = `You matched with ${username}! 💕`;
    } else {
      displayContent = item.content || `${username} sent you a notification`;
    }
    
    return (
    <TouchableOpacity 
      className={`px-4 py-3 border-b border-gray-200 ${!item.read ? 'bg-ios-blue/5' : ''}`}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.6}
    >
      <View className="flex-row items-center">
        <View className="h-avatar-md w-avatar-md rounded-full bg-gray-200 items-center justify-center mr-3">
          {(isPremium || item.type === 'MATCH') && userProfiles[item.userId] ? (
            <Image 
              source={{ uri: userProfiles[item.userId]! }}
              className="h-avatar-md w-avatar-md rounded-full"
            />
          ) : (
            <Ionicons name="person" size={24} color="#8E8E93" />
          )}
        </View>
  
        <View className="flex-1">
          <View className="flex-row justify-between items-start">
            <Text className={`text-ios-body flex-1 ${!item.read ? 'font-semibold text-black' : 'text-gray-900'}`}>
              {displayContent}
            </Text>
            <Text className="text-ios-caption1 text-gray-500 ml-2">
              {formatTimeAgo(item.created_at)}
            </Text>
          </View>
        </View>
        {!item.read && (
          <View className="w-2 h-2 rounded-full bg-ios-blue ml-2" />
        )}
      </View>
    </TouchableOpacity>
  )};



  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-ios-large-title">Activities</Text>
          {notifications.some(n => !n.read) && (
            <TouchableOpacity 
              onPress={markAllAsRead}
              activeOpacity={0.6}
            >
              <Text className="text-red-500 text-ios-body">Mark all as read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="items-center">
            <Ionicons name="heart-outline" size={80} color="#E5E7EB" />
            <Text className="text-2xl font-bold text-gray-800 mt-6 text-center">
              No Activity Yet
            </Text>
            <Text className="text-base text-gray-500 mt-3 text-center leading-6">
              When someone likes your posts or you get a match, you'll see it here
            </Text>
            <View className="mt-8 space-y-3">
              <View className="bg-red-50 px-6 py-3 rounded-xl flex-row items-center">
                <Text className="text-2xl mr-3">💖</Text>
                <Text className="text-sm text-gray-700 flex-1">
                  <Text className="font-semibold">Likes</Text> - Someone shot their shot!
                </Text>
              </View>
              <View className="bg-purple-50 px-6 py-3 rounded-xl flex-row items-center">
                <Text className="text-2xl mr-3">✨</Text>
                <Text className="text-sm text-gray-700 flex-1">
                  <Text className="font-semibold">Matches</Text> - It's a match!
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          className="flex-1"
        />
      )}
    </SafeAreaView>
  );
}