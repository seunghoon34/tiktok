import { View, Text, TouchableOpacity } from 'react-native';
import "../../global.css";
import { useAuth } from '@/providers/AuthProvider';

export default function ProfileScreen() {
  const { signOut, user } = useAuth()
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className='text-black font-bold text-3xl'>Profile</Text>
      <Text className='text-black font-bold text-3xl'>{user.username}</Text>

      <TouchableOpacity className='bg-black px-4 py-2 rounded-lg' onPress={()=> signOut()}>
        <Text className=' text-white font-bold text-2xl text-center'>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}
