  import { Stack } from 'expo-router';
  import { useEffect, useState } from 'react';
  import * as SplashScreen from 'expo-splash-screen';
  import * as Font from 'expo-font';
  import 'react-native-reanimated';
  import { AuthProvider } from '@/providers/AuthProvider';
  import * as Notifications from 'expo-notifications';
  import { NotificationProvider } from '@/providers/NotificationProvider';
  import { Host, Portal } from 'react-native-portalize';
  import { GestureHandlerRootView } from 'react-native-gesture-handler';  // Add this import
  import { ProfileProvider } from '@/providers/ProfileProvider';
  import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
  import { View, Text, Dimensions, Animated } from 'react-native';
  import { Ionicons } from '@expo/vector-icons';

  // Prevent the splash screen from auto-hiding before asset loading is complete.
  SplashScreen.preventAutoHideAsync();

  // Suppress specific React warnings that are not actionable in React Native
  if (__DEV__) {
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = (...args) => {
      const message = args[0];
      if (typeof message === 'string' && 
          (message.includes('useInsertionEffect must not schedule updates') ||
           message.includes('Warning: useInsertionEffect'))) {
        return; // Suppress this specific warning
      }
      originalWarn(...args);
    };
    
    console.error = (...args) => {
      const message = args[0];
      if (typeof message === 'string' && 
          (message.includes('useInsertionEffect must not schedule updates') ||
           message.includes('Warning: useInsertionEffect'))) {
        return; // Suppress this specific error
      }
      originalError(...args);
    };
  }

  // Define modern, centered toast styles with enhanced animations
  const toastConfig = {
    success: (props: any) => (
      <Animated.View style={{
        backgroundColor: 'rgba(0, 0, 0, 0.8)', // iOS-style black semi-transparent
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderRadius: 16, // iOS-style rounded corners
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 150,
        maxWidth: 280,
        // iOS-style blur effect simulation with shadows
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
      }}>
        <Ionicons name="checkmark-circle" size={28} color="#4ADE80" style={{ marginBottom: 8 }} />
        <Text style={{
          color: 'white',
          fontSize: 16,
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: 4,
        }}>
          {props.text1}
        </Text>
        {props.text2 && (
          <Text style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: 13,
            textAlign: 'center',
            lineHeight: 18,
          }}>
            {props.text2}
          </Text>
        )}
      </Animated.View>
    ),
    error: (props: any) => (
      <Animated.View style={{
        backgroundColor: 'rgba(0, 0, 0, 0.8)', // Same iOS-style black background
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderRadius: 16, // iOS-style rounded corners
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 150,
        maxWidth: 280,
        // iOS-style blur effect simulation with shadows
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
      }}>
        <Ionicons name="close-circle" size={28} color="#EF4444" style={{ marginBottom: 8 }} />
        <Text style={{
          color: 'white',
          fontSize: 16,
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: 4,
        }}>
          {props.text1}
        </Text>
        {props.text2 && (
          <Text style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: 13,
            textAlign: 'center',
            lineHeight: 18,
          }}>
            {props.text2}
          </Text>
        )}
      </Animated.View>
    ),
    info: (props: any) => (
      <Animated.View style={{
        backgroundColor: 'rgba(0, 0, 0, 0.8)', // Same iOS-style black background
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderRadius: 16, // iOS-style rounded corners
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 150,
        maxWidth: 280,
        // iOS-style blur effect simulation with shadows
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
      }}>
        <Ionicons name="information-circle" size={28} color="#3B82F6" style={{ marginBottom: 8 }} />
        <Text style={{
          color: 'white',
          fontSize: 16,
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: 4,
        }}>
          {props.text1}
        </Text>
        {props.text2 && (
          <Text style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: 13,
            textAlign: 'center',
            lineHeight: 18,
          }}>
            {props.text2}
          </Text>
        )}
      </Animated.View>
    ),
  };

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,  
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });





  export default function RootLayout() {
    // Load fonts outside of component lifecycle to avoid warnings
    const [fontsLoaded, setFontsLoaded] = useState(false);
    
    useEffect(() => {
      let mounted = true;
      
      const loadFonts = async () => {
        try {
          await Font.loadAsync({
            SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
          });
          if (mounted) {
            setFontsLoaded(true);
          }
        } catch (error) {
          if (mounted) {
            console.warn('Font loading error:', error);
            setFontsLoaded(true); // Continue anyway
          }
        }
      };
      
      loadFonts();
      
      return () => {
        mounted = false;
      };
    }, []);
    
    if (!fontsLoaded) {
      return null;
    }

    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Host>
          <AuthProvider>
              <NotificationProvider>
                <Stack screenOptions={{ gestureEnabled: false}}>
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="feed" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right'}}/>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="user" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right'}}/>
                  <Stack.Screen name="camera" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right' }} />
                  <Stack.Screen name="chat/[id]" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right' }} />
                  <Stack.Screen name="createprofile" options={{ headerShown: true }} />
                  <Stack.Screen name="stories" options={{ headerShown: false }} />
                  <Stack.Screen name="userstories" options={{ headerShown: false }} />

                  <Stack.Screen name="blocked" options={{ headerShown: false }} />

                  <Stack.Screen name="editprofile" options={{ headerShown: false  }} />
                  <Stack.Screen name="+not-found" />
                </Stack>
              </NotificationProvider>
          </AuthProvider>
        </Host>
        <Toast 
          config={toastConfig} 
          position={'center' as any}
          visibilityTime={1500} // 1.5 seconds for better readability
          autoHide={true}
          topOffset={30}
          bottomOffset={40}
          swipeable={true} // Allow swipe to dismiss
        />
      </GestureHandlerRootView>
    );
  }