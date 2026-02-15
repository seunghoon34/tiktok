import * as Notifications from 'expo-notifications';
import { supabase } from '@/utils/supabase';

// Track which chat the user is currently viewing
let _activeChatId: string | null = null;

export function setActiveChatForNotifications(chatId: string | null) {
  _activeChatId = chatId;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    // Suppress alert if user is already in the chat this message is for
    if (data?.type === 'message' && data?.chatId && data.chatId === _activeChatId) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    }
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});


export async function registerForPushNotifications(userId: string) {
    console.log("Starting push notification registration");
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log("Existing permission status:", existingStatus);
    
    let finalStatus = existingStatus;
  
    // Only ask if permissions have not already been determined
    if (existingStatus !== 'granted') {
      console.log("Requesting permissions...");
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log("Permission request result:", status);
    }
  
    if (finalStatus !== 'granted') {
      console.log("Permission not granted");
      return;
    }
  
    try {
        console.log("Getting push token...");
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        console.log("Got token:", token);
    
        // Always update the token
        const { error } = await supabase
          .from('User')
          .update({ expo_push_token: token })
          .eq('id', userId);
    
        if (error) {
          console.error("Error updating token:", error);
          return;
        }
    
        console.log("Token updated successfully for user:", userId);
        return token;
      } catch (error) {
        console.error("Error in registerForPushNotifications:", error);
      }
  }


