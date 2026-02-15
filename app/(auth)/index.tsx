import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard, TouchableWithoutFeedback, Platform } from 'react-native';
import "../../global.css";
import { Link } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();

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

  const handleAppleSignIn = async () => {
    setError('');
    setIsAppleLoading(true);

    try {
      await signInWithApple();
    } catch (error: any) {
      setError('Apple sign in failed. Please try again.');
      console.error('Apple sign in error:', error);
    } finally {
      setIsAppleLoading(false);
    }
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

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 items-center justify-center bg-white dark:bg-black px-6">
        <View className='w-full items-center'>
          <Image
            source={require('../../assets/images/logo-transparent.png')}
            style={{ width: 100, height: 100, marginBottom: 32 }}
            contentFit="contain"
            transition={200}
          />

        {error ? (
          <View className="w-full mb-4 p-3 bg-red-500/10 rounded-xl">
            <Text className="text-red-500 text-ios-body text-center">{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          className={`w-full bg-white dark:bg-[#1C1C1E] border-2 border-gray-300 dark:border-gray-600 h-button rounded-xl flex-row justify-center items-center mb-3 ${isGoogleLoading ? 'opacity-disabled' : ''}`}
          onPress={handleGoogleSignIn}
          disabled={isGoogleLoading || isLoading || isAppleLoading}
          activeOpacity={0.6}
        >
          {isGoogleLoading ? (
            <ActivityIndicator color="#007C7B" />
          ) : (
            <>
              <Text className="text-2xl mr-2 dark:text-white">G</Text>
              <Text className="text-gray-700 dark:text-gray-300 font-semibold text-ios-body">Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            className={`w-full bg-black dark:bg-white h-button rounded-xl flex-row justify-center items-center mb-4 ${isAppleLoading ? 'opacity-disabled' : ''}`}
            onPress={handleAppleSignIn}
            disabled={isAppleLoading || isLoading || isGoogleLoading}
            activeOpacity={0.6}
          >
            {isAppleLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={20} color={Platform.OS === 'ios' ? 'white' : 'black'} className="mr-2 dark:text-black" />
                <Text className="text-white dark:text-black font-semibold text-ios-body">Continue with Apple</Text>
              </>
            )}
          </TouchableOpacity>
        )}

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
        />

        <View className='w-full'>
          <TouchableOpacity
            className={`bg-[#007C7B] h-button rounded-xl justify-center items-center ${isLoading ? 'opacity-disabled' : ''}`}
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
    </TouchableWithoutFeedback>
  );
}