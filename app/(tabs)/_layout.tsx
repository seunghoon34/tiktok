import { Tabs, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNotifications } from '@/providers/NotificationProvider';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/providers/AuthProvider';

export default function TabLayout() {
  const [iconColor, setIconColor] = useState<'black' | 'white'>('black');
  const router = useRouter()
  const { unreadCount, setUnreadCount } = useNotifications()
  const { user } = useAuth()

  const [unreadMessages, setUnreadMessages] = useState(0);


  

  const getTotalUnreadMessages = async () => {
    if (!user) return 0;
    const { count } = await supabase
      .from('Message')
      .select('*', { count: 'exact' })
      .eq('read', false)
      .neq('sender_id', user.id);
    return count || 0;
  };

  // Set up subscription and initial fetch
  useEffect(() => {
    if (!user) return;

    // Initial fetch
    getTotalUnreadMessages().then(setUnreadMessages);

    // Subscribe to all message changes
    const subscription = supabase
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

    return () => {
      subscription.unsubscribe();
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
            <Ionicons name="film-outline" size={30} color="black" />
          
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
          <View className="absolute -top-1 -right-2 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center">
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
                <View className="absolute -top-1 -right-2 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center">
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
