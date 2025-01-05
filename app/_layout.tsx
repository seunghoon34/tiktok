  import { useFonts } from 'expo-font';
  import { Stack } from 'expo-router';
  import { useEffect } from 'react';
  import * as SplashScreen from 'expo-splash-screen';
  import 'react-native-reanimated';
  import { AuthProvider } from '@/providers/AuthProvider';
  import * as Notifications from 'expo-notifications';
  import { NotificationProvider } from '@/providers/NotificationProvider';
  import { Host, Portal } from 'react-native-portalize';
  import { GestureHandlerRootView } from 'react-native-gesture-handler';  // Add this import
  import { ProfileProvider } from '@/providers/ProfileProvider';
  import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
  import { View } from 'react-native';

  // Prevent the splash screen from auto-hiding before asset loading is complete.
  SplashScreen.preventAutoHideAsync();

  // Define custom toast styles
  const toastConfig = {
    /*
      Overwrite 'success' type,
      by modifying the existing `BaseToast` component
    */
    success: (props) => (
      <BaseToast
        {...props}
        style={{ borderLeftColor: 'pink', backgroundColor: '#FEF3F2' }}
        contentContainerStyle={{ paddingHorizontal: 15, backgroundColor: '#FEF3F2' }}
        text1Style={{
          fontSize: 15,
          fontWeight: '400'
        }}
      />
    ),
    /*
      Overwrite 'error' type,
      by modifying the existing `ErrorToast` component
    */
    error: (props) => (
      <ErrorToast
        {...props}
        text1Style={{
          fontSize: 17
        }}
        text2Style={{
          fontSize: 15
        }}
      />
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
    const [loaded] = useFonts({
      SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
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
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Host>
          <AuthProvider>
            <ProfileProvider>
              <NotificationProvider>
                <Stack screenOptions={{ gestureEnabled: false}}>
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="feed" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right'}}/>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="user" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right'}}/>
                  <Stack.Screen name="camera" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right' }} />
                  <Stack.Screen name="chat/[id]" options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right' }} />
                  <Stack.Screen name="createprofile" options={{ headerShown: false }} />
                  <Stack.Screen name="stories" options={{ headerShown: false }} />
                  <Stack.Screen name="userstories" options={{ headerShown: false }} />

                  <Stack.Screen name="blocked" options={{ headerShown: false }} />

                  <Stack.Screen name="editprofile" options={{ headerShown: false }} />


                  

                  <Stack.Screen name="+not-found" />
                </Stack>
              </NotificationProvider>
            </ProfileProvider>
          </AuthProvider>
        </Host>
        <Toast config={toastConfig} position='bottom'
    bottomOffset={20}/>
      </GestureHandlerRootView>
    );
  }