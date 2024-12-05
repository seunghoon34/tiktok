import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

export default function TabLayout() {
  

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
          tabBarIcon: () => <Text>Home</Text>
        }}
      />
      
    
    </Tabs>
  );
}
