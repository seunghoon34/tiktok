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
import { hybridCache } from '@/utils/memoryCache';

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
      console.log('Starting markAllAsRead for user:', user.id);
      
      // First let's see what notifications exist for this user
      const { data: allNotifications } = await supabase
        .from('Notification')
        .select('id, to_user, read, type, created_at')
        .eq('to_user', user.id);
      
      console.log('All notifications for user:', allNotifications);
      
      // First check how many unread notifications exist
      const { count: beforeCount } = await supabase
        .from('Notification')
        .select('*', { count: 'exact' })
        .eq('to_user', user.id)
        .eq('read', false);
      
      console.log('Unread notifications before update:', beforeCount);

      // Let's also check what notifications would match our update criteria
      const { data: matchingNotifications } = await supabase
        .from('Notification')
        .select('id, to_user, read, type')
        .eq('to_user', user.id)
        .eq('read', false);
      
      console.log('Notifications that should be updated:', matchingNotifications);

      // Test if we can update a single notification first
      if (matchingNotifications && matchingNotifications.length > 0) {
        const { data: singleUpdateResult, error: singleError } = await supabase
          .from('Notification')
          .update({ read: true })
          .eq('id', matchingNotifications[0].id)
          .select();
        
        console.log('Single notification update test:', singleUpdateResult, singleError);
      }

      const { data, error } = await supabase
        .from('Notification')
        .update({ read: true })
        .eq('to_user', user.id)
        .eq('read', false)
        .select();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('Database update completed. Rows affected:', data?.length || 0);

      // Verify the update worked
      const { count: afterCount } = await supabase
        .from('Notification')
        .select('*', { count: 'exact' })
        .eq('to_user', user.id)
        .eq('read', false);
      
      console.log('Unread notifications after update:', afterCount);

      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notif => ({ ...notif, read: true }))
      );
      
      // Manually update the unread count after a small delay to ensure DB changes propagate
      setTimeout(() => {
        setUnreadCount(0);
      }, 50);
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
    const { data, error } = await supabase
      .from('Chat')
      .select('id')
      .or(`and(user1_id.eq.${userId1},user2_id.eq.${userId2}),and(user1_id.eq.${userId2},user2_id.eq.${userId1})`);
    
    if (error || !data?.length) return null;
    return data[0].id;
  };

  const handleNotificationPress = async (item: any) => {
    // Don't allow interaction with SHOT notifications if not premium
    if (item.type === 'SHOT' && !isPremium) {
      return; // Do nothing for free users on SHOT notifications
    }

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
      // Use notification cache for efficient loading
      console.log(`[Activity] Loading notifications for user: ${user.id}`);
      const result = await notificationCache.getNotificationsWithSync(user.id);
      
      console.log(`[Activity] Loaded ${result.notifications.length} notifications from ${result.source}`);
      if (result.hasNewNotifications) {
        console.log(`[Activity] Found ${result.newNotificationCount} new notifications`);
      }

      setNotifications(result.notifications);
    } catch (error) {
      console.error('[Activity] Error fetching notifications:', error);
    }
  };

  const getNotificationContent = (type: any, username: any) => {
    switch (type) {
      case 'SHOT':
        return isPremium 
        ? `${username || 'Someone'} has shot their shot at you! 🎯`
        : `Someone has shot their shot at you! 🎯`;
      case 'MATCH':
        return `You matched with ${username || 'someone'}! 🎉`;
      default:
        return 'New notification';
    }
  };

  const renderNotification = ({ item }: { item: any }) => {
    // For free users, disable interaction with SHOT notifications
    const isClickable = item.type === 'MATCH' || (item.type === 'SHOT' && isPremium);
    
    // Modify content based on premium status for SHOT notifications
    let displayContent = item.content;
    if (item.type === 'SHOT' && !isPremium) {
      displayContent = 'Someone sent you a shot! 📸';
    }
    
    return (
    <TouchableOpacity 
      className={`px-4 py-3 border-b border-gray-200 ${!item.read ? 'bg-ios-blue/5' : ''}`}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={isClickable ? 0.6 : 1}
      disabled={!isClickable}
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
              {item.time}
            </Text>
          </View>
  
          {item.actionable && (
            <View className="flex-row mt-2">
              {item.type === 'shot' ? (
                <View className="flex-row">
                  <TouchableOpacity className="bg-ios-green rounded-full p-2 mr-2" activeOpacity={0.6}>
                    <Ionicons name="checkmark" size={16} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity className="bg-red-500 rounded-full p-2" activeOpacity={0.6}>
                    <Ionicons name="close" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ) : (
                <></>
              )}
            </View>
          )}
        </View>
        {!item.read && (
          <View className="w-2 h-2 rounded-full bg-ios-blue ml-2" />
        )}
      </View>
    </TouchableOpacity>
  )};


  useEffect(() => {
    const fetchUserProfiles = async () => {
      const userIds = notifications.map(notification => notification.userId);
      // Remove duplicates
      const uniqueUserIds = [...new Set(userIds)];
      
      const profiles: Record<string, string | null> = {};
      
      await Promise.all(uniqueUserIds.map(async (userId) => {
        // Check cache first
        const cacheKey = `profile_pic:${userId}`;
        const cached = await hybridCache.get<string>(cacheKey);
        
        if (cached) {
          profiles[userId] = cached;
          return;
        }
        
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

        if (data && data.profilepicture) {
          const { data: publicData } = supabase.storage
            .from('profile_images')
            .getPublicUrl(data.profilepicture);
          
          const imageUrl = publicData?.publicUrl || null;
          profiles[userId] = imageUrl;
          
          // Cache for 6 hours
          if (imageUrl) {
            await hybridCache.set(cacheKey, imageUrl, 6 * 60 * 60 * 1000);
          }
        } else {
          profiles[userId] = null;
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

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        className="flex-1"
      />
    </SafeAreaView>
  );
}