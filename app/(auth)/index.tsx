import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import "../../global.css";
import { Link, useRouter } from 'expo-router';
import { useState, useContext } from 'react';
import { AuthContext, useAuth } from '@/providers/AuthProvider';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signIn } = useAuth()
 

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <View className='w-full p-4'>
        <Text className='text-black font-bold text-3xl text-center py-2 mb-2'>Log in</Text>
      <TextInput
        placeholder='Email'
        className='bg-white p-4 rounded-lg border border-gray-300 w-full mb-3'
        value= {email}
        onChangeText={setEmail}
      />
      <TextInput
      secureTextEntry={true}
        placeholder='Password'
        className='bg-white p-4 rounded-lg border border-gray-300 w-full mb-3'
        value= {password}
        onChangeText={setPassword}
      />
      <View className='py-2'>
      <TouchableOpacity className='bg-black px-4 py-2 rounded-lg' onPress={()=>signIn(email,password)}>
        <Text className=' text-white font-bold text-2xl text-center'>Login</Text>
      </TouchableOpacity>
      <Link href={"/(auth)/signup"} className='text-center py-6'>Dont have an account yet? Sign up here</Link>
      </View>
      </View>
      
     

    </View>
  );
}
