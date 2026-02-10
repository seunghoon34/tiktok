import * as Notifications from 'expo-notifications';
import { supabase } from '@/utils/supabase';
import { Platform } from 'react-native';

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


  export async function sendMatchNotifications(
    user1Id: string,
    user1Username: string,
    user2Id: string,
    user2Username: string,
    chatId: string
  ) {
    try {
      // Fetch both users' push tokens
      const { data: usersData, error: usersError } = await supabase
        .from('User')
        .select('id, username, expo_push_token')
        .in('id', [user1Id, user2Id]);
  
      if (usersError) {
        console.error('Failed to fetch push tokens:', usersError);
        return;
      }
  
      // Send notifications to both users
      for (const userData of usersData) {
        const pushToken = userData.expo_push_token;
        if (!pushToken) {
          console.warn(`No push token found for userId ${userData.id}`);
          continue;
        }
  
        const username = userData.id === user1Id ? user2Username : user1Username;
        
        console.log(`Sending notification to userId: ${userData.id}, pushToken: ${pushToken}`);
        
        // Send to Expo's push service instead of scheduling locally
        const message = {
          to: pushToken,
          sound: 'default',
          title: "New Match! 🎉",
          body: `You matched with ${username}!`,
          data: { type: 'match', matchedUser: username, chatId: chatId },
          priority: 'high',
      channelId: 'default',
      _displayInForeground: true,
      badge: 1,
    
          
        };
  
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });
  
        console.log(`Push notification sent to ${userData.username}`);
      }
    } catch (error) {
      console.error('Error sending match notifications:', error);
    }
  }

  export async function sendShotNotification(receiverId: string) {
    try {
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('expo_push_token')
        .eq('id', receiverId)
        .single();

      if (userError || !userData?.expo_push_token) {
        console.warn(`No push token found for userId ${receiverId}`);
        return;
      }

      const message = {
        to: userData.expo_push_token,
        sound: 'default',
        title: "A shot was fired your way! 💘",
        body: 'Open the app to find out who!',
        data: { type: 'shot' },
        priority: 'high',
        channelId: 'default',
        _displayInForeground: true,
        badge: 1,
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('Shot notification error:', result);
      } else {
        console.log(`Shot notification sent to userId: ${receiverId}`);
      }
    } catch (error) {
      console.error('Error sending shot notification:', error);
    }
  }

  export async function sendMessageNotification(
    senderId: string,
    senderUsername: string,
    receiverId: string,
    chatId: string
) {
    try {
        const { data: userData, error: userError } = await supabase
            .from('User')
            .select('expo_push_token')
            .eq('id', receiverId)
            .single();

        if (userError || !userData?.expo_push_token) {
            console.warn(`No push token found for userId ${receiverId}`);
            return;
        }

        console.log(`Sending message notification to: ${receiverId}, token: ${userData.expo_push_token}`);

        const message = {
            to: userData.expo_push_token,
            sound: 'default',
            title: "New Message! 💬",
            body: `New message from ${senderUsername}`,
            data: { 
                type: 'message',
                senderId: senderId,
                senderName: senderUsername,
                chatId: chatId
            },
            priority: 'high',
            channelId: 'default',
            _displayInForeground: true,
            _category: "message",
            badge: 1,
            android: {
                priority: 'high',
                sound: 'default',
                sticky: false,
            },
        };

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        const result = await response.json();
        if (!response.ok) {
            console.error('Message notification error:', result);
        } else {
            console.log(`Message notification sent successfully to ${senderUsername}`);
        }

    } catch (error) {
        console.error('Error sending message notification:', error);
    }
}