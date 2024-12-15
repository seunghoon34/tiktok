import * as Notifications from 'expo-notifications';
import { supabase } from '@/utils/supabase';
import { Platform } from 'react-native';


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
    user2Username: string
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
          data: { type: 'match', matchedUser: username },
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