import { Tabs, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNotifications } from '@/providers/NotificationProvider';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { inboxCache } from '@/utils/inboxCache';

export default function TabLayout() {
  const [iconColor, setIconColor] = useState<'black' | 'white'>('black');
  const router = useRouter()
  const { unreadCount, setUnreadCount } = useNotifications()
  const { user } = useAuth()

  const [unreadMessages, setUnreadMessages] = useState(0);


  

  const getTotalUnreadMessages = async () => {
    if (!user) return 0;
  
    // Use inbox cache for efficient unread count
    try {
      const unreadCount = await inboxCache.getTotalUnreadCount(user.id);
      console.log(`[TabLayout] Got unread count from cache: ${unreadCount}`);
      return unreadCount;
    } catch (error) {
      console.error('[TabLayout] Error getting unread count:', error);
      return 0;
    }
  };

  const getTotalUnreadNotifications = async () => {
    if (!user) return 0;

    // First, get list of blocked users
    const { data: blockedUsers, error: blockError } = await supabase
      .from('UserBlock')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

    if (blockError) {
      console.error('Error fetching blocked users:', blockError);
      return 0;
    }

    // Create array of user IDs to exclude
    const excludeUserIds = blockedUsers?.reduce((acc: string[], block) => {
      if (block.blocker_id === user.id) acc.push(block.blocked_id);
      if (block.blocked_id === user.id) acc.push(block.blocker_id);
      return acc;
    }, []);

    // Get unread notifications excluding blocked users
    const { count, error } = await supabase
      .from('Notification')
      .select('*', { count: 'exact' })
      .eq('to_user', user.id)
      .eq('read', false)
      .not(excludeUserIds.length > 0 ? 'from_user' : 'id', 
           excludeUserIds.length > 0 ? 'in' : 'eq', 
           excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : user.id);

    if (error) {
      console.error('Error fetching notification count:', error);
      return 0;
    }

    console.log('getTotalUnreadNotifications returning count:', count);
    return count || 0;
  };

  // Set up subscription and initial fetch
  useEffect(() => {
    if (!user) return;

    // Initial fetch for both messages and notifications
    getTotalUnreadMessages().then(setUnreadMessages);
    getTotalUnreadNotifications().then(setUnreadCount);

    // Subscribe to all message changes
    const messageSubscription = supabase
      .channel('any_messages')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to inserts and updates
          schema: 'public',
          table: 'Message',
        },
        async () => {
          const newCount = await getTotalUnreadMessages();
          setUnreadMessages(newCount);
        }
      )
      .subscribe();

    // Subscribe to notification changes
    const notificationSubscription = supabase
      .channel('any_notifications')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to inserts, updates, and deletes
          schema: 'public',
          table: 'Notification',
        },
        async () => {
          // Add small delay to ensure database changes have propagated
          setTimeout(async () => {
            const newCount = await getTotalUnreadNotifications();
            setUnreadCount(newCount);
          }, 100);
        }
      )
      .subscribe();

    return () => {
      messageSubscription.unsubscribe();
      notificationSubscription.unsubscribe();
    };
  }, [user]);
  

  

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#000',
        headerShown: false,
        tabBarStyle: {
          paddingTop: 10, // Added padding to the top of the tab bar
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '',
          tabBarIcon: () => 
            <Ionicons name="home-outline" size={30} color="black" />
          
        }}
        listeners={{
          tabPress: (e) =>{
            e.preventDefault();
            router.push('/feed')
          }
        }}
      />
      <Tabs.Screen
  name="activity"
  options={{
    title: '',
    tabBarIcon: ({ focused }) => (
      <View>
        <Ionicons name={focused ? "heart" : "heart-outline"} size={30} color="black" />
        {unreadCount > 0 && (
          <View className="absolute -top-1 -right-2 bg-red-400 rounded-full min-w-[18px] h-[18px] items-center justify-center">
            <Text className="text-white text-xs font-bold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </View>
    )
  }}
/>
      <Tabs.Screen
        name="empty"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <View className="items-center justify-center w-7 h-7 border-2 border-black rounded-md">
              <Ionicons name="add" size={20} color="black" style={{ fontWeight: 'bold' }}/>
            </View>
          )          
        }}
        listeners={{
          tabPress: (e) =>{
            e.preventDefault();
            router.push('/camera')
          }
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <View>
              <Ionicons 
                name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} 
                size={30} 
                color="black" 
              />
              {unreadMessages > 0 && (
                <View className="absolute -top-1 -right-2 bg-red-400 rounded-full min-w-[18px] h-[18px] items-center justify-center">
                  <Text className="text-white text-xs font-bold">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </Text>
                </View>
              )}
            </View>
          )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => <Ionicons name={focused?"person":"person-outline"} size={30} color="black" />
        }}
      />
      
    
    </Tabs>
  );
}
