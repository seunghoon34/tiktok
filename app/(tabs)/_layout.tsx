import { Tabs, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNotifications } from '@/providers/NotificationProvider';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/providers/AuthProvider';
import * as Notifications from 'expo-notifications';
import { useColorScheme } from 'nativewind';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? 'white' : 'black';
  const router = useRouter()
  const { unreadCount, setUnreadCount } = useNotifications()
  const { user } = useAuth()

  const [unreadMessages, setUnreadMessages] = useState(0);


  

  const getTotalUnreadMessages = async () => {
    if (!user) return 0;
  
    // Get all chats where the user is either user1 or user2
    const { data: userChats } = await supabase
      .from('Chat')
      .select('id')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
  
    if (!userChats) return 0;
  
    // Get unread messages from these chats
    const { count } = await supabase
      .from('Message')
      .select('*', { count: 'exact' })
      .eq('read', false)
      .neq('sender_id', user.id)
      .in('chat_id', userChats.map(chat => chat.id));
  
    return count || 0;
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

    return count || 0;
  };

  // Initial fetch on mount
  useEffect(() => {
    if (!user) return;
    getTotalUnreadMessages().then(setUnreadMessages);
    getTotalUnreadNotifications().then(setUnreadCount);
  }, [user]);

  // Listen for incoming push notifications to update badge counts
  useEffect(() => {
    if (!user) return;

    const subscription = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data;
      if (data?.type === 'message') {
        const newCount = await getTotalUnreadMessages();
        setUnreadMessages(newCount);
      } else if (data?.type === 'shot' || data?.type === 'match') {
        const newCount = await getTotalUnreadNotifications();
        setUnreadCount(newCount);
      }
    });

    return () => subscription.remove();
  }, [user]);
  

  

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isDark ? '#FFFFFF' : '#000000',
        headerShown: false,
        tabBarStyle: {
          height: 70,
          paddingBottom: 20,
          paddingTop: 8,
          borderTopWidth: 0.5,
          borderTopColor: isDark ? '#38383A' : '#C6C6C8',
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '',
          tabBarIcon: ({ focused }) =>
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={28}
              color={iconColor}
            />
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
        <Ionicons name={focused ? "heart" : "heart-outline"} size={28} color={iconColor} />
        {unreadCount > 0 && (
          <View className="absolute -top-1 -right-2 bg-[#007C7B] rounded-full min-w-[18px] h-[18px] items-center justify-center">
            <Text className="text-white text-[11px] font-semibold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </View>
    )
  }}
  listeners={{
    tabPress: () => {
      getTotalUnreadNotifications().then(setUnreadCount);
    }
  }}
/>
      <Tabs.Screen
        name="empty"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <View className={`items-center justify-center w-[28px] h-[28px] border-[1.5px] rounded-md ${isDark ? 'border-white' : 'border-black'}`}>
              <Ionicons name="add" size={18} color={iconColor} />
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
                size={28}
                color={iconColor}
              />
              {unreadMessages > 0 && (
                <View className="absolute -top-1 -right-2 bg-[#007C7B] rounded-full min-w-[18px] h-[18px] items-center justify-center">
                  <Text className="text-white text-[11px] font-semibold">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </Text>
                </View>
              )}
            </View>
          )
        }}
        listeners={{
          focus: () => {
            getTotalUnreadMessages().then(setUnreadMessages);
          }
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => <Ionicons name={focused?"person":"person-outline"} size={28} color={iconColor} />
        }}
      />
      
    
    </Tabs>
  );
}
