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
    <View className="flex-1 items-center justify-center bg-white px-6">
      <View className='w-full items-center'>
        <Image
          source={require('../../assets/images/s2icon.png')}
          style={{ width: 100, height: 100, marginBottom: 32 }}
        />

        {error ? (
          <View className="w-full mb-4 p-3 bg-red-500/10 rounded-xl">
            <Text className="text-red-500 text-ios-body text-center">{error}</Text>
          </View>
        ) : null}

        <TextInput
          placeholder='Email'
          placeholderTextColor="#8E8E93"
          className='bg-gray-100 p-4 rounded-xl border border-gray-200 w-full mb-3 text-ios-body'
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError('');
          }}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          secureTextEntry={true}
          placeholder='Password'
          placeholderTextColor="#8E8E93"
          className='bg-gray-100 p-4 rounded-xl border border-gray-200 w-full mb-4 text-ios-body'
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError('');
          }}
        />

        <View className='w-full'>
          <TouchableOpacity 
            className={`bg-red-500 h-button rounded-xl justify-center items-center ${isLoading ? 'opacity-disabled' : ''}`}
            onPress={handleSignIn}
            disabled={isLoading}
            activeOpacity={0.6}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className='text-white font-semibold text-ios-body'>Sign in</Text>
            )}
          </TouchableOpacity>

          <Link 
            href="/(auth)/signup" 
            className='text-center text-ios-body text-ios-blue mt-6'
          >
            Don't have an account yet? Sign up here
          </Link>
        </View>
      </View>
    </View>
  );
}