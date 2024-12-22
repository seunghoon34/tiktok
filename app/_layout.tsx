import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { AuthProvider } from '@/providers/AuthProvider';
import * as Notifications from 'expo-notifications';
import { NotificationProvider } from '@/providers/NotificationProvider';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  useEffect(() => {
    const prepare = async () => {
      if (loaded) {
        try {
          // Don't hide splash screen here - let AuthProvider handle it
          // await SplashScreen.hideAsync();
        } catch (error) {
          console.error('Error preparing app:', error);
        }
      }
    };

    prepare();
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <Stack screenOptions={{ gestureEnabled: false}}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="feed" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right'}}/>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="user" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right'}}/>
          <Stack.Screen name="camera" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right' }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </NotificationProvider>
    </AuthProvider>
  );
}