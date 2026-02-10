import { View, Text, FlatList, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { useCallback, useEffect, useState, useRef, memo, useMemo } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { hybridCache } from '@/utils/memoryCache';
import * as Notifications from 'expo-notifications';

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

interface ChatItemProps {
  chat: any;
  user: any;
  onChatPress: (chatId: string) => void;
}

const ChatItem = memo(({ chat, user, onChatPress }: ChatItemProps) => {
 const router = useRouter();

 const otherUser = useMemo(() => {
   return user && chat.user1 && chat.user2
     ? chat.user1.id === user.id ? chat.user2 : chat.user1
     : null;
 }, [user?.id, chat.user1?.id, chat.user2?.id]);

 // Build profile picture URL directly from chat query data (fresh on every inbox focus)
 const profilePicUrl = useMemo(() => {
   const profile = otherUser?.UserProfile;
   const path = Array.isArray(profile) ? profile[0]?.profilepicture : profile?.profilepicture;
   if (!path) return null;
   const { data } = supabase.storage.from('profile_images').getPublicUrl(path);
   return data?.publicUrl || null;
 }, [otherUser]);

  const lastMessage = chat.lastMessage;
  const isExpired = chat.isExpired || false;

 const maxLength = 50;
 const truncatedMessage = lastMessage && lastMessage.content.length > maxLength
   ? lastMessage.content.substring(0, maxLength) + '...'
   : lastMessage ? lastMessage.content : '';

 return (
   <TouchableOpacity
     className="px-4 py-3 border-b border-gray-200"
     onPress={() => {
       onChatPress?.(chat.id);
       router.push({
         pathname: '/chat/[id]',
         params: {
           id: chat.id,
           username: otherUser?.username || '',
           profilePicture: profilePicUrl || '',
         }
       });
     }}
     activeOpacity={0.6}
   >
     <View className="flex-row items-start justify-between">
       <View className="flex-row flex-1">
         {profilePicUrl ? (
           <Image
             source={{ uri: profilePicUrl }}
             className="w-avatar h-avatar rounded-full"
           />
         ) : (
           <View className="w-avatar h-avatar rounded-full bg-gray-200 items-center justify-center">
             <Ionicons 
               name="person" 
               size={20} 
               color="#8E8E93" 
             />
           </View>
         )}
         <View className="ml-3 flex-1">
           <View className="flex-row items-center justify-between mb-0.5">
             <Text className="text-ios-body font-semibold text-black">
               {otherUser?.username}
             </Text>
             {isExpired && (
               <View className="bg-red-100 px-2 py-0.5 rounded-full ml-2">
                 <Text className="text-red-600 text-xs font-semibold">Expired</Text>
               </View>
             )}
           </View>
           {lastMessage && (
             <Text className="text-ios-subhead text-gray-600" numberOfLines={1}>
               {truncatedMessage}
             </Text>
           )}
         </View>
       </View>

       <View className="items-end ml-2">
         {lastMessage && (
           <Text className="text-ios-caption1 text-gray-500 mb-1">
             {formatDate(lastMessage.created_at)}
           </Text>
         )}
         {chat.unreadCount > 0 && (
           <View className="bg-red-500 rounded-full px-1.5 py-0.5 min-w-[18px] items-center">
             <Text className="text-white text-[11px] font-semibold">
               {chat.unreadCount}
             </Text>
           </View>
         )}
       </View>
     </View>
   </TouchableOpacity>
 );
}, (prevProps: ChatItemProps, nextProps: ChatItemProps) => {
  // Extract profile picture path from chat data for comparison
  const getOtherPicPath = (props: ChatItemProps) => {
    const other = props.chat.user1?.id === props.user?.id ? props.chat.user2 : props.chat.user1;
    const profile = other?.UserProfile;
    return Array.isArray(profile) ? profile[0]?.profilepicture : profile?.profilepicture;
  };

  return (
    prevProps.chat.id === nextProps.chat.id &&
    prevProps.chat.lastMessage?.content === nextProps.chat.lastMessage?.content &&
    prevProps.chat.lastMessage?.created_at === nextProps.chat.lastMessage?.created_at &&
    prevProps.chat.unreadCount === nextProps.chat.unreadCount &&
    prevProps.chat.isExpired === nextProps.chat.isExpired &&
    prevProps.user?.id === nextProps.user?.id &&
    getOtherPicPath(prevProps) === getOtherPicPath(nextProps)
  );
});

export default function InboxScreen() {
 const [chats, setChats] = useState<any[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [showUnreadOnly, setShowUnreadOnly] = useState(false);
 const { user } = useAuth();
 const chatIdsRef = useRef<string[]>([]);

 const filteredChats = useMemo(() => {
   if (!showUnreadOnly) return chats;
   return chats.filter(chat => chat.unreadCount > 0);
 }, [chats, showUnreadOnly]);

 const fetchChats = async () => {
   try {
     // Parallelize blocked users and chats fetch
     const [blockedResult, chatsResult] = await Promise.all([
       supabase
         .from('UserBlock')
         .select('blocker_id, blocked_id')
         .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
       supabase
         .from('Chat')
         .select(`
           id,
           created_at,
           user1:user1_id (
             id,
             username,
             UserProfile (profilepicture)
           ),
           user2:user2_id (
             id,
             username,
             UserProfile (profilepicture)
           )
         `)
         .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
         .limit(10)
     ]);

     if (blockedResult.error) throw blockedResult.error;
     if (chatsResult.error) throw chatsResult.error;

     const blockedUsers = blockedResult.data;
     const allChats = chatsResult.data;

     // Create set of blocked user IDs for efficient filtering
     const excludeUserIds = new Set(
       blockedUsers?.reduce((acc: string[], block) => {
         if (block.blocker_id === user.id) acc.push(block.blocked_id);
         if (block.blocked_id === user.id) acc.push(block.blocker_id);
         return acc;
       }, []) || []
     );

     // Filter out chats with blocked users
     const data = allChats?.filter(chat => {
       const user1 = Array.isArray(chat.user1) ? chat.user1[0] : chat.user1;
       const user2 = Array.isArray(chat.user2) ? chat.user2[0] : chat.user2;
       return !excludeUserIds.has(user1?.id) && !excludeUserIds.has(user2?.id);
     });

     // Optimized: Get all last messages, unread counts, and match data in parallel
     const chatIds = data.map(chat => chat.id);

     // Build pairs for match query
     const otherUserIds = data.map(chat => {
       const u1 = Array.isArray(chat.user1) ? chat.user1[0] : chat.user1;
       const u2 = Array.isArray(chat.user2) ? chat.user2[0] : chat.user2;
       return u1?.id === user.id ? u2?.id : u1?.id;
     }).filter(Boolean);

     const [lastMsgResult, unreadResult, matchResult] = await Promise.all([
       supabase
         .from('Message')
         .select('chat_id, content, created_at')
         .in('chat_id', chatIds)
         .order('created_at', { ascending: false }),
       supabase
         .from('Message')
         .select('chat_id')
         .in('chat_id', chatIds)
         .eq('read', false)
         .neq('sender_id', user.id),
       supabase
         .from('Match')
         .select('user1_id, user2_id, created_at')
         .or(otherUserIds.map(otherId =>
           `and(user1_id.eq.${user.id},user2_id.eq.${otherId}),and(user1_id.eq.${otherId},user2_id.eq.${user.id})`
         ).join(','))
     ]);

     const lastMessages = lastMsgResult.data;
     const unreadMessages = unreadResult.data;
     const matches = matchResult.data;

     // Process the data efficiently
     const lastMessageMap = new Map();
     const unreadCountMap = new Map();
     const matchMap = new Map<string, string>();

     // Group last messages by chat_id
     lastMessages?.forEach(msg => {
       if (!lastMessageMap.has(msg.chat_id)) {
         lastMessageMap.set(msg.chat_id, msg);
       }
     });

     // Count unread messages by chat_id
     unreadMessages?.forEach(msg => {
       unreadCountMap.set(msg.chat_id, (unreadCountMap.get(msg.chat_id) || 0) + 1);
     });

     // Map match created_at by other user ID
     matches?.forEach(match => {
       const otherId = match.user1_id === user.id ? match.user2_id : match.user1_id;
       matchMap.set(otherId, match.created_at);
     });

     const chatsWithDetails = data.map(chat => {
       const u1 = Array.isArray(chat.user1) ? chat.user1[0] : chat.user1;
       const u2 = Array.isArray(chat.user2) ? chat.user2[0] : chat.user2;
       const otherId = u1?.id === user.id ? u2?.id : u1?.id;
       const matchCreatedAt = matchMap.get(otherId);
       let isExpired = false;
       if (matchCreatedAt) {
         const matchTime = new Date(matchCreatedAt + 'Z').getTime();
         const hoursPassed = (Date.now() - matchTime) / (1000 * 60 * 60);
         isExpired = hoursPassed >= 24;
       }
       return {
         ...chat,
         lastMessage: lastMessageMap.get(chat.id) || null,
         unreadCount: unreadCountMap.get(chat.id) || 0,
         isExpired,
       };
     });

     console.log(`[Inbox] Optimized fetch: ${chatIds.length} chats loaded`);

     const sortedChats = chatsWithDetails.sort((a, b) => {
       const aChatTime = new Date(a.created_at).getTime();
       const aMessageTime = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
       const aTime = Math.max(aChatTime, aMessageTime);
       const bChatTime = new Date(b.created_at).getTime();
       const bMessageTime = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
       const bTime = Math.max(bChatTime, bMessageTime);
       return bTime - aTime;
     });

     chatIdsRef.current = sortedChats.map((c: any) => c.id);
     setChats(sortedChats);
   } catch (error) {
     console.error('Error fetching chats:', error);
   } finally {
     setIsLoading(false);
   }
 };

 // Optimistically clear unread count when user taps into a chat
 const handleChatPress = useCallback((chatId: string) => {
   setChats(prev => prev.map(chat =>
     chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
   ));
 }, []);

 useFocusEffect(
   useCallback(() => {
     if (user) {
       fetchChats();
     }
   }, [user])
 );

 // Re-fetch inbox when a message push notification arrives while on this screen
 useEffect(() => {
   if (!user) return;
   const subscription = Notifications.addNotificationReceivedListener((notification) => {
     const data = notification.request.content.data;
     if (data?.type === 'message') {
       fetchChats();
     }
   });
   return () => subscription.remove();
 }, [user]);

 return (
   <SafeAreaView className="flex-1 bg-white">
     <View className="px-4 pt-2 pb-3 flex-row items-center justify-between">
       <Text className="text-ios-large-title">Messages</Text>
       <TouchableOpacity
         onPress={() => setShowUnreadOnly(prev => !prev)}
         className={`px-3 py-1.5 rounded-full ${showUnreadOnly ? 'bg-[#FF6B6B]' : 'bg-gray-100'}`}
       >
         <Text className={`text-sm font-medium ${showUnreadOnly ? 'text-white' : 'text-gray-600'}`}>
           Unread
         </Text>
       </TouchableOpacity>
     </View>
     {!isLoading && filteredChats.length === 0 ? (
       <View className="flex-1 items-center justify-center px-8">
         <View className="items-center">
           <Ionicons name={showUnreadOnly ? "mail-open-outline" : "chatbubbles-outline"} size={80} color="#E5E7EB" />
           <Text className="text-2xl font-bold text-gray-800 mt-6 text-center">
             {showUnreadOnly ? 'All Caught Up' : 'No Messages Yet'}
           </Text>
           <Text className="text-base text-gray-500 mt-3 text-center leading-6">
             {showUnreadOnly
               ? "You have no unread messages"
               : "When you match with someone, you'll be able to chat with them here"}
           </Text>
           {!showUnreadOnly && (
             <View className="mt-8 bg-gray-50 px-6 py-4 rounded-2xl">
               <Text className="text-sm text-gray-600 text-center">
                 💡 Start liking posts in your feed to get matches!
               </Text>
             </View>
           )}
         </View>
       </View>
     ) : (
       <FlatList
         data={filteredChats}
         renderItem={({ item: chat }) => (
           <ChatItem chat={chat} user={user} onChatPress={handleChatPress} />
         )}
         keyExtractor={(item) => item.id}
       />
     )}
   </SafeAreaView>
 );
}