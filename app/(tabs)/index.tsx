import { View, Text } from 'react-native';
import "../../global.css";
import { Link } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';

export default function HomeScreen() {
  const { signOut, user} = useAuth()
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className='text-black font-bold text-3xl'>Home123</Text>
      <Text className='text-black'>{JSON.stringify(user)}</Text>
    </View>
  );
}
