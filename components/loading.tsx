import React from 'react';
import { View } from 'react-native';
import Header from './header';

const LoadingScreen = () => {
  return (
  
    <View className="flex flex-1 h-screen w-full bg-black justify-center items-center">
      
      <View className="flex flex-col items-center gap-4">
        <View className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </View>
    </View>
  );
};

export default LoadingScreen;