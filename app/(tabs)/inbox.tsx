import { View, Text, FlatList, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { inboxCache } from '@/utils/inboxCache';
import { profileCache } from '@/utils/profileCache';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const formatDate = (dateString: string) => {
 if (!dateString) return '';

 try {
   const date = new Date(dateString);
   if (isNaN(date.getTime())) {
     console.error('Invalid date string received:', dateString);
     return '';
   }

   const userTimezoneOffset = date.getTimezoneOffset();
   const localDate = new Date(date.getTime() - (userTimezoneOffset * 60000));
   
   const now = new Date();
   const yesterday = new Date(now);
   yesterday.setDate(now.getDate() - 1);
   
   const startOfWeek = new Date(now);
   startOfWeek.setDate(now.getDate() - now.getDay());

   const isToday = localDate.toDateString() === now.toDateString();
   const isYesterday = localDate.toDateString() === yesterday.toDateString();
   const isThisWeek = localDate >= startOfWeek;
   const isThisYear = localDate.getFullYear() === now.getFullYear();

   if (isToday) {
     return localDate.toLocaleTimeString('en-US', { 
       hour: '2-digit', 
       minute: '2-digit',
       hour12: true
     });
   } else if (isYesterday) {
     return 'Yesterday';
   } else if (isThisWeek) {
     return localDate.toLocaleDateString('en-US', {
       weekday: 'long'
     });
   } else if (isThisYear) {
     const day = localDate.getDate();
     const month = localDate.getMonth() + 1;
     return `${day}/${month}`;
   } else {
     const day = localDate.getDate();
     const month = localDate.getMonth() + 1;
     const year = localDate.getFullYear();
     return `${day}/${month}/${year}`;
   }
 } catch (error) {
   console.error('Error formatting date:', error, 'for date string:', dateString);
   return '';
 }
};

const ChatItem = ({ chat, user }: { chat: any; user: any }) => {
 const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
 const router = useRouter();
 const otherUser = user && chat.user1 && chat.user2 
 ? chat.user1.id === user.id ? chat.user2 : chat.user1
 : null;
  const lastMessage = chat.lastMessage;

 useEffect(() => {
  if (!otherUser) return;
  const getOtherUserProfile = async () => {
    try {
      console.log('[InboxScreen] Loading profile for other user:', otherUser.id);
      const cachedProfile = await profileCache.getProfile(otherUser.id);
      
      if (cachedProfile) {
        console.log('[InboxScreen] Profile loaded (cached or fresh)');
        setOtherUserProfile(cachedProfile);
      } else {
        console.log('[InboxScreen] No profile data available for user:', otherUser.id);
      }
    } catch (error) {
      console.error('[InboxScreen] Exception in getOtherUserProfile:', error);
    }
  };
  getOtherUserProfile();
}, [otherUser]);

 const maxLength = 50;
 const truncatedMessage = lastMessage && lastMessage.content.length > maxLength
   ? lastMessage.content.substring(0, maxLength) + '...'
   : lastMessage ? lastMessage.content : '';

 return (
   <TouchableOpacity
     className="p-4 border-b border-gray-100"
     onPress={() => router.push(`/chat/${chat.id}`)}
   >
     <View className="flex-row items-start justify-between">
       <View className="flex-row">
         {otherUserProfile?.profilepicture ? (
           <Image 
             source={{ uri: otherUserProfile?.profilepicture }}
             className="w-10 h-10 rounded-full"
             onLoad={() => console.log('[InboxScreen] Image component loaded successfully')}
             onError={(error) => {
               console.error('[InboxScreen] Image component failed to load:', error.nativeEvent);
               console.error('[InboxScreen] Failed image URL:', otherUserProfile?.profilepicture);
             }}
           />
         ) : (
           <Ionicons 
             name="person-circle-outline" 
             size={40} 
             color="gray" 
           />
         )}
         <View className="ml-3">
           <View className="flex-row items-center justify-between">
             <Text className="text-lg font-semibold">{otherUser?.username}</Text>
           </View>
           {lastMessage && (
             <Text className="text-gray-500">{truncatedMessage}</Text>
           )}
         </View>
       </View>

       <View className="items-end">
         {lastMessage && (
           <Text className="text-gray-400 text-sm mb-1">
             {formatDate(lastMessage.created_at)}
           </Text>
         )}
         {chat.unreadCount > 0 && (
           <View className="bg-red-400 rounded-full px-2 py-0.5">
             <Text className="text-white text-sm">{chat.unreadCount}</Text>
           </View>
         )}
       </View>
     </View>
   </TouchableOpacity>
 );
};

export default function InboxScreen() {
 const [chats, setChats] = useState<any[]>([]);
 const { user } = useAuth();

 const fetchChats = async () => {
  try {
    // Use inbox cache for efficient loading
    console.log(`[Inbox] Loading chats for user: ${user.id}`);
    const result = await inboxCache.getInboxWithSync(user.id);
    
    console.log(`[Inbox] Loaded ${result.chats.length} chats from ${result.source}`);
    if (result.hasUpdates) {
      console.log(`[Inbox] Found inbox updates (${result.totalUnreadCount} total unread)`);
    }

    setChats(result.chats);
  } catch (error) {
    console.error('[Inbox] Error fetching chats:', error);
  }
};

 useEffect(() => {
  if (!user) return;

  // Set up realtime subscription
  const subscription = supabase
    .channel('inbox_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'Message',
      filter: `chat_id=in.(${chats.map(chat => chat.id).join(',')})`,
    }, () => {
      // Refetch chats when a new message arrives
      fetchChats();
    })
    .subscribe();

  return () => {
    // Cleanup subscription when component unmounts
    subscription.unsubscribe();
  };
}, [chats, user]);

 useFocusEffect(
   useCallback(() => {
     if (user) {
       fetchChats();
     }
   }, [user])
 );

 return (
   <SafeAreaView className="flex-1 bg-white">
     <Text style={{ fontSize: 32, fontWeight: 'bold', marginLeft: 15, marginBottom: 10 }}>
       Messages
     </Text>
     <FlatList
       data={chats}
       renderItem={({ item: chat }) => (
         <ChatItem chat={chat} user={user} />
       )}
       keyExtractor={(item) => item.id}
     />
   </SafeAreaView>
 );
}