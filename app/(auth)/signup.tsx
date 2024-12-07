import { View, Text } from 'react-native';
import "../../global.css";
import { Link } from 'expo-router';

export default function CameraScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-black">
      <Text className='text-white font-bold text-3xl'>Sign up</Text>
      <Link href="/(auth)" className='text-white'>Login</Link>

    </View>
  );
}
