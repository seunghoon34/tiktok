  import { Stack } from 'expo-router';
  import { useEffect, useState } from 'react';
  import * as SplashScreen from 'expo-splash-screen';
  import * as Font from 'expo-font';
  import 'react-native-reanimated';
  import { AuthProvider } from '@/providers/AuthProvider';
  import { NotificationProvider } from '@/providers/NotificationProvider';
  import { Host, Portal } from 'react-native-portalize';
  import { GestureHandlerRootView } from 'react-native-gesture-handler';  // Add this import
  import { ProfileProvider } from '@/providers/ProfileProvider';
  import { ThemeProvider } from '@/providers/ThemeProvider';
  import Toast from 'react-native-toast-message';
  import { View, Text } from 'react-native';
  import { Ionicons } from '@expo/vector-icons';
  import { cache } from '@/utils/cache';
  import { enableCacheDebug } from '@/utils/cacheDebug';

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

  const HudToast = ({ icon, iconColor, text1, text2 }: { icon: string; iconColor: string; text1: string; text2?: string }) => (
    <View style={{
      backgroundColor: 'rgba(60, 60, 60, 0.92)',
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingVertical: 20,
      minWidth: 140,
      maxWidth: 220,
    }}>
      <Ionicons name={icon as any} size={36} color={iconColor} style={{ marginBottom: 10 }} />
      <Text style={{
        color: 'white',
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
      }}>
        {text1}
      </Text>
      {text2 ? (
        <Text style={{
          color: 'rgba(255, 255, 255, 0.65)',
          fontSize: 13,
          textAlign: 'center',
          marginTop: 3,
        }}>
          {text2}
        </Text>
      ) : null}
    </View>
  );

  const toastConfig = {
    success: (props: any) => <HudToast icon="checkmark" iconColor="white" text1={props.text1} text2={props.text2} />,
    error: (props: any) => <HudToast icon="close" iconColor="white" text1={props.text1} text2={props.text2} />,
    info: (props: any) => <HudToast icon="information" iconColor="white" text1={props.text1} text2={props.text2} />,
  };

  // Notification handler is configured in utils/notifications.ts
  // (suppresses alerts when user is already in the active chat)





  export default function RootLayout() {
    // Load fonts outside of component lifecycle to avoid warnings
    const [fontsLoaded, setFontsLoaded] = useState(false);
    
    useEffect(() => {
      let mounted = true;
      
      const initializeApp = async () => {
        try {
          // Initialize cache system and perform daily cleanup
          await cache.performDailyCleanup();
          console.log('[App] Cache system initialized');
          
          // Enable cache debugging in development
          enableCacheDebug();
          
          // Load fonts
          await Font.loadAsync({
            SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
          });
          
          if (mounted) {
            setFontsLoaded(true);
          }
        } catch (error) {
          if (mounted) {
            console.warn('App initialization error:', error);
            setFontsLoaded(true); // Continue anyway
          }
        }
      };
      
      initializeApp();
      
      return () => {
        mounted = false;
      };
    }, []);
    
    if (!fontsLoaded) {
      return null;
    }

    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
        <Host>
          <AuthProvider>
              <NotificationProvider>
                <Stack screenOptions={{ gestureEnabled: false}}>
                  <Stack.Screen name="(auth)" options={{ headerShown: false, gestureEnabled: false }} />
                  <Stack.Screen name="feed" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right'}}/>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
                  <Stack.Screen name="user" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right'}}/>
                  <Stack.Screen name="camera" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right' }} />
                  <Stack.Screen name="locationpermission" options={{ headerShown: false, gestureEnabled: false, presentation: 'modal' }} />
                  <Stack.Screen name="chat/[id]" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right' }} />
                  <Stack.Screen name="createprofile" options={{ headerShown: false, gestureEnabled: false }} />
                  <Stack.Screen name="stories" options={{ headerShown: false }} />
                  <Stack.Screen name="userstories" options={{ headerShown: false }} />

                  <Stack.Screen name="blocked" options={{ headerShown: false }} />

                  <Stack.Screen name="editprofile" options={{ headerShown: false  }} />
                  <Stack.Screen name="+not-found" />
                </Stack>
              </NotificationProvider>
          </AuthProvider>
        </Host>
        </ThemeProvider>
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