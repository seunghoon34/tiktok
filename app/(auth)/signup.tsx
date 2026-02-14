import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard, TouchableWithoutFeedback } from 'react-native';
import "../../global.css";
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    return password.length >= 6; // Minimum 6 characters
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);

    try {
      await signInWithGoogle();
    } catch (error: any) {
      setError('Google sign in failed. Please try again.');
      console.error('Google sign in error:', error);
    } finally {
      setIsGoogleLoading(false);
    }
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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 items-center justify-center bg-white dark:bg-black px-6">
        <View className='w-full items-center'>
          <Image
            source={require('../../assets/images/logo-transparent.png')}
            style={{ width: 100, height: 100, marginBottom: 32 }}
          />

        {error ? (
          <View className="w-full mb-4 p-3 bg-red-500/10 rounded-xl">
            <Text className="text-red-500 text-ios-body text-center">{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          className={`w-full bg-white dark:bg-[#1C1C1E] border-2 border-gray-300 dark:border-gray-600 h-button rounded-xl flex-row justify-center items-center mb-4 ${(isGoogleLoading || !ageConfirmed) ? 'opacity-disabled' : ''}`}
          onPress={handleGoogleSignIn}
          disabled={isGoogleLoading || isLoading || !ageConfirmed}
          activeOpacity={0.6}
        >
          {isGoogleLoading ? (
            <ActivityIndicator color="#EA4335" />
          ) : (
            <>
              <Text className="text-2xl mr-2 dark:text-white">G</Text>
              <Text className="text-gray-700 dark:text-gray-300 font-semibold text-ios-body">Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <View className="w-full flex-row items-center mb-4">
          <View className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
          <Text className="mx-4 text-gray-500 dark:text-gray-400 text-ios-body">or</Text>
          <View className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
        </View>

        <TextInput
          placeholder='Email'
          placeholderTextColor="#8E8E93"
          className='bg-gray-100 dark:bg-[#1C1C1E] p-4 rounded-xl border border-gray-200 dark:border-gray-700 w-full mb-3 text-ios-body dark:text-white'
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
          className='bg-gray-100 dark:bg-[#1C1C1E] p-4 rounded-xl border border-gray-200 dark:border-gray-700 w-full mb-4 text-ios-body dark:text-white'
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
            className={`bg-red-500 h-button rounded-xl justify-center items-center ${(isLoading || !ageConfirmed) ? 'opacity-disabled' : ''}`}
            onPress={handleSignUp}
            disabled={isLoading || !ageConfirmed}
            activeOpacity={0.6}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className='text-white font-semibold text-ios-body'>Sign up</Text>
            )}
          </TouchableOpacity>

          <View className="w-full mt-4">
            <TouchableOpacity
              className="flex-row items-start"
              onPress={() => setAgeConfirmed(!ageConfirmed)}
              activeOpacity={0.6}
            >
              <Ionicons
                name={ageConfirmed ? 'checkbox' : 'square-outline'}
                size={22}
                color={ageConfirmed ? '#FF6B6B' : '#9CA3AF'}
                style={{ marginTop: 1 }}
              />
              <Text className="ml-2 text-gray-600 dark:text-gray-400 text-sm flex-1 leading-5">
                I confirm I am 18 years or older and agree to the{' '}
                <Text className="text-blue-500" onPress={() => WebBrowser.openBrowserAsync('https://s2-delta-tan.vercel.app/terms', { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })}>
                  Terms of Service
                </Text>{' '}
                and{' '}
                <Text className="text-blue-500" onPress={() => WebBrowser.openBrowserAsync('https://s2-delta-tan.vercel.app/privacy', { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })}>
                  Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          <Link
            href="/(auth)"
            className='text-center text-ios-body text-ios-blue mt-6'
          >
            Already have an account? Log in here
          </Link>
        </View>
      </View>
    </View>
    </TouchableWithoutFeedback>
  );
}