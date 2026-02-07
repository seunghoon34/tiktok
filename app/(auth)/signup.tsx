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
          textContentType="emailAddress"
          autoComplete="email"
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
          textContentType="newPassword"
          autoComplete="password-new"
        />

        <View className='w-full'>
          <TouchableOpacity 
            className={`bg-red-500 h-button rounded-xl justify-center items-center ${isLoading ? 'opacity-disabled' : ''}`}
            onPress={handleSignUp}
            disabled={isLoading}
            activeOpacity={0.6}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className='text-white font-semibold text-ios-body'>Sign up</Text>
            )}
          </TouchableOpacity>

          <Link 
            href="/(auth)" 
            className='text-center text-ios-body text-ios-blue mt-6'
          >
            Already have an account? Log in here
          </Link>
        </View>
      </View>
    </View>
  );
}