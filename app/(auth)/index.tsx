import { View, Text, TouchableOpacity } from 'react-native';
import "../../global.css";
import { Link, useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className='text-white font-bold text-3xl'>Login Page</Text>
      <TouchableOpacity className='bg-black px-4 py-2 rounded-lg' onPress={()=> router.push('/(tabs)')}>
        <Text className=' text-white font-bold text-3xl'>Login</Text>
      </TouchableOpacity>
      <TouchableOpacity className='bg-black px-4 py-2 rounded-lg' onPress={()=> router.push('/(auth)/signup')}>
        <Text className=' text-white font-bold text-3xl'>Signup</Text>
      </TouchableOpacity>
     

    </View>
  );
}
