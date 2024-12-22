import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNotifications } from '@/providers/NotificationProvider';

export default function TabLayout() {
  const [iconColor, setIconColor] = useState<'black' | 'white'>('black');
  const router = useRouter()
  const { unreadCount, setUnreadCount } = useNotifications()
  

  

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
          tabBarIcon: ({ focused }) => <Ionicons name={focused?"chatbubble-ellipses":"chatbubble-ellipses-outline"} size={30} color="black" />
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
