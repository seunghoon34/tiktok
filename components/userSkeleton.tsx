import React, { useEffect } from 'react';
import { View, Animated, SafeAreaView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const SkeletonLoader = () => {
  const pulseAnim = new Animated.Value(0);

  useEffect(() => {
    const pulse = Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]);

    Animated.loop(pulse).start();
  }, []);

  const router = useRouter();

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView>
        <View className="flex-row items-center justify-between w-full px-4 py-3">
          <View className="w-10">
            <Ionicons name="chevron-back" size={32} color="black" onPress={() => router.back()} />
          </View>
          
          <View className="flex-1 items-center">
            <Animated.View className="w-32 h-8 rounded-lg bg-gray-300" style={{ opacity }} />
          </View>
          
          <View className="w-10">
            <View className="w-8 h-8 rounded-full bg-gray-300" />
          </View>
        </View>

        <View className="flex-1 bg-white">
          <View className="relative mx-4 mt-2">
            <Animated.View 
              className="aspect-[3/4] rounded-3xl bg-gray-300"
              style={{ opacity }}
            />
          </View>

          <View className="p-4 mx-4 mt-5 rounded-3xl">
            <Animated.View 
              className="w-24 h-6 mb-4 rounded-lg bg-gray-300"
              style={{ opacity }}
            />
            
            <View className="space-y-2">
              <Animated.View 
                className="w-full h-4 rounded-lg bg-gray-300"
                style={{ opacity }}
              />
              <Animated.View 
                className="w-3/4 h-4 rounded-lg bg-gray-300"
                style={{ opacity }}
              />
              <Animated.View 
                className="w-1/2 h-4 rounded-lg bg-gray-300"
                style={{ opacity }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SkeletonLoader;