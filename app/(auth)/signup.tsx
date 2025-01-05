import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import "../../global.css";
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Image } from 'react-native';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    return password.length >= 6; // Minimum 6 characters
  };

  const handleSignUp = async () => {
    try {
      setError('');
      
      // Validate inputs
      if (!email || !password) {
        setError('Please fill in all fields');
        return;
      }

      if (!validateEmail(email)) {
        setError('Please enter a valid email address');
        return;
      }

      if (!validatePassword(password)) {
        setError('Password must be at least 6 characters long');
        return;
      }

      setIsLoading(true);
      await signUp(email, password);
    } catch (error) {
      if (error.message?.includes('User')) {
        setError('Invalid email or password');
      } else if (error.message?.includes('password')) {
        setError('Password is too weak');
      } else {
        setError('An error occurred. Please try again.');
      }
      console.error('Signup error:', error);
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
            setError('');
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />

        <TextInput
          secureTextEntry={true}
          placeholder='Password'
          placeholderTextColor="#666"
          className='bg-white p-4 rounded-lg border border-gray-300 w-full mb-3'
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError('');
          }}
          textContentType="newPassword"
          autoComplete="password-new"
        />

        <View className='py-2 w-full'>
          <TouchableOpacity 
            className={`bg-red-500 px-4 py-2 rounded-lg ${isLoading ? 'opacity-50' : ''}`}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className='text-white font-bold text-2xl text-center'>Sign up</Text>
            )}
          </TouchableOpacity>

          <Link 
            href="/(auth)" 
            className='text-center py-6'
          >
            Already have an account? Log in here
          </Link>
        </View>
      </View>
    </View>
  );
}