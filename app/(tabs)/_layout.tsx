import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function TabLayout() {
  const [iconColor, setIconColor] = useState<'black' | 'white'>('black');
  const router = useRouter()
  

  

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#000',
        headerShown: false,
        
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: () => 
            <Ionicons name="add-circle-sharp" size={24} color="black" />
          
        }}
        listeners={{
          tabPress: (e) =>{
            e.preventDefault();
            router.push('/feed')
          }
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ focused }) => <Ionicons name={focused?"people":"people-outline"} size={24} color="black" />
        }}
      />
      <Tabs.Screen
        name="empty"
        options={{
          title: '',
          tabBarIcon: () => 
          <View style={{ position: 'absolute', top: -24, left: '50%', transform: [{ translateX: -37.5 }], width: 75, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add-circle-sharp" size={75} color="black" />
          </View>
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
          title: 'Inbox',
          tabBarIcon: ({ focused }) => <Ionicons name={focused?"chatbox-ellipses":"chatbox-ellipses-outline"} size={24} color="black" />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <Ionicons name={focused?"person":"person-outline"} size={24} color="black" />
        }}
      />
      
    
    </Tabs>
  );
}
