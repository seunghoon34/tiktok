import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import "../../global.css";
import { Link, useRouter } from 'expo-router';
import { useState, useContext } from 'react';
import { AuthContext, useAuth } from '@/providers/AuthProvider';
import { Image } from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      await signIn(email, password);
    } catch (error:any) {
      // Handle different error cases
      if (error.message?.includes('Invalid login')) {
        setError('Invalid email or password');
      }
       else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <View className='w-full p-4 items-center'>
        <Image
          source={require('../../assets/images/s2icon.png')}
          style={{ width: 100, height: 100, marginBottom: 20 }}
        />

        {error ? (
          <View className="w-full mb-4 p-3 bg-red-100 rounded-lg">
            <Text className="text-red-500 text-center">{error}</Text>
          </View>
        ) : null}

        <TextInput
          placeholder='Email'
          placeholderTextColor="#666"
          className='bg-white p-4 rounded-lg border border-gray-300 w-full mb-3'
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError(''); // Clear error when user types
          }}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          secureTextEntry={true}
          placeholder='Password'
          placeholderTextColor="#666"
          className='bg-white p-4 rounded-lg border border-gray-300 w-full mb-3'
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError(''); // Clear error when user types
          }}
        />

        <View className='py-2 w-full'>
          <TouchableOpacity 
            className={`bg-red-500 px-4 py-2 rounded-lg ${isLoading ? 'opacity-50' : ''}`}
            onPress={handleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className='text-white font-bold text-2xl text-center'>Sign in</Text>
            )}
          </TouchableOpacity>

          <Link 
            href="/(auth)/signup" 
            className='text-center py-6'
          >
            Don't have an account yet? Sign up here
          </Link>
        </View>
      </View>
    </View>
  );
}