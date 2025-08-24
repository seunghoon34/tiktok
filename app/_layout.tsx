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
    success: (props) => (
      <Animated.View style={{
        backgroundColor: 'rgba(34, 197, 94, 0.95)', // Modern green with transparency
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 20, // More rounded for modern look
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 200,
        maxWidth: Dimensions.get('window').width - 60, // More margin
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 }, // Deeper shadow
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)', // Subtle border
      }}>
        <Ionicons name="checkmark-circle" size={26} color="white" style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={{
            color: 'white',
            fontSize: 16,
            fontWeight: '700', // Bolder text
            textAlign: 'center',
            letterSpacing: 0.3, // Better spacing
          }}>
            {props.text1}
          </Text>
          {props.text2 && (
            <Text style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: 14,
              marginTop: 4,
              textAlign: 'center',
              letterSpacing: 0.2,
            }}>
              {props.text2}
            </Text>
          )}
        </View>
      </Animated.View>
    ),
    error: (props) => (
      <Animated.View style={{
        backgroundColor: 'rgba(239, 68, 68, 0.95)', // Modern red with transparency
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 20, // More rounded for modern look
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 200,
        maxWidth: Dimensions.get('window').width - 60, // More margin
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 }, // Deeper shadow
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)', // Subtle border
      }}>
        <Ionicons name="close-circle" size={26} color="white" style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={{
            color: 'white',
            fontSize: 16,
            fontWeight: '700', // Bolder text
            textAlign: 'center',
            letterSpacing: 0.3, // Better spacing
          }}>
            {props.text1}
          </Text>
          {props.text2 && (
            <Text style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: 14,
              marginTop: 4,
              textAlign: 'center',
              letterSpacing: 0.2,
            }}>
              {props.text2}
            </Text>
          )}
        </View>
      </Animated.View>
    ),
    info: (props) => (
      <Animated.View style={{
        backgroundColor: 'rgba(59, 130, 246, 0.95)', // Modern blue with transparency
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 20, // More rounded for modern look
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 200,
        maxWidth: Dimensions.get('window').width - 60, // More margin
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 }, // Deeper shadow
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)', // Subtle border
      }}>
        <Ionicons name="information-circle" size={26} color="white" style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={{
            color: 'white',
            fontSize: 16,
            fontWeight: '700', // Bolder text
            textAlign: 'center',
            letterSpacing: 0.3, // Better spacing
          }}>
            {props.text1}
          </Text>
          {props.text2 && (
            <Text style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: 14,
              marginTop: 4,
              textAlign: 'center',
              letterSpacing: 0.2,
            }}>
              {props.text2}
            </Text>
          )}
        </View>
      </Animated.View>
    ),
  };

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,  
      shouldSetBadge: false,
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
          position='center'
          visibilityTime={3500} // Slightly longer for better readability
          autoHide={true}
          topOffset={30}
          bottomOffset={40}
          swipeable={true} // Allow swipe to dismiss
        />
      </GestureHandlerRootView>
    );
  }