import { View, Text } from 'react-native';
import "../../global.css";
import { Link } from 'expo-router';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className='text-black font-bold text-3xl'>Home123</Text>
      <Link href="/(auth)" className='text-white'>Login</Link>
    </View>
  );
}
