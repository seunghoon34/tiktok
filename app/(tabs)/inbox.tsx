import { View, Text, FlatList, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { useCallback, useEffect, useState, useRef, memo, useMemo } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { hybridCache } from '@/utils/memoryCache';
import { profileCache } from '@/utils/profileCache';

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
}

const ChatItem = memo(({ chat, user }: ChatItemProps) => {
const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
const [isLoadingProfile, setIsLoadingProfile] = useState(false);
const [isExpired, setIsExpired] = useState(false);
 const router = useRouter();
 
 const otherUser = useMemo(() => {
   return user && chat.user1 && chat.user2 
     ? chat.user1.id === user.id ? chat.user2 : chat.user1
     : null;
 }, [user?.id, chat.user1?.id, chat.user2?.id]);
 
  const lastMessage = chat.lastMessage;

 useEffect(() => {
  if (!otherUser?.id || !user?.id) return;

  const fetchData = async () => {
    try {
      // Parallelize match check and profile fetch
      const [matchResult, profile] = await Promise.all([
        supabase
          .from('Match')
          .select('created_at')
          .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUser.id}),and(user1_id.eq.${otherUser.id},user2_id.eq.${user.id})`)
          .single(),
        profileCache.getProfile(otherUser.id)
      ]);

      // Handle match expiration
      const { data: matchData } = matchResult;
      if (matchData?.created_at) {
        const matchTime = new Date(matchData.created_at).getTime();
        const now = Date.now();
        const hoursPassed = (now - matchTime) / (1000 * 60 * 60);
        setIsExpired(hoursPassed >= 24);
      }

      // Handle profile
      if (profile) {
        console.log('[InboxScreen] Profile loaded:', { userId: profile.user_id, hasPicture: !!profile.profilepicture });
        setOtherUserProfile({
          ...profile,
          user: { username: profile.username }
        });
      } else {
        console.log('[InboxScreen] No profile found for user:', otherUser.id);
      }
    } catch (error) {
      console.error('[InboxScreen] Error fetching data:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  fetchData();
}, [otherUser?.id, user?.id]); // Re-fetch if user IDs change

 const maxLength = 50;
 const truncatedMessage = lastMessage && lastMessage.content.length > maxLength
   ? lastMessage.content.substring(0, maxLength) + '...'
   : lastMessage ? lastMessage.content : '';

 return (
   <TouchableOpacity
     className="px-4 py-3 border-b border-gray-200"
     onPress={() => router.push(`/chat/${chat.id}`)}
     activeOpacity={0.6}
   >
     <View className="flex-row items-start justify-between">
       <View className="flex-row flex-1">
         {otherUserProfile?.profilepicture ? (
           <Image 
             source={{ uri: otherUserProfile?.profilepicture }}
             className="w-avatar h-avatar rounded-full"
             onLoad={() => console.log('[InboxScreen] Image component loaded successfully')}
             onError={(error) => {
               console.error('[InboxScreen] Image component failed to load:', error.nativeEvent);
               console.error('[InboxScreen] Failed image URL:', otherUserProfile?.profilepicture);
             }}
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
  // Custom comparison for memo - only re-render if these change
  return (
    prevProps.chat.id === nextProps.chat.id &&
    prevProps.chat.lastMessage?.content === nextProps.chat.lastMessage?.content &&
    prevProps.chat.lastMessage?.created_at === nextProps.chat.lastMessage?.created_at &&
    prevProps.chat.unreadCount === nextProps.chat.unreadCount &&
    prevProps.user?.id === nextProps.user?.id
  );
});

export default function InboxScreen() {
 const [chats, setChats] = useState<any[]>([]);
 const { user } = useAuth();
 const chatIdsRef = useRef<string[]>([]);

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

     // Optimized: Get all last messages and unread counts in 2 queries instead of N+1
     const chatIds = data.map(chat => chat.id);
     
     // Get last messages for all chats in one query
     const { data: lastMessages } = await supabase
       .from('Message')
       .select('chat_id, content, created_at')
       .in('chat_id', chatIds)
       .order('created_at', { ascending: false });

     // Get unread counts for all chats in one query  
     const { data: unreadMessages } = await supabase
       .from('Message')
       .select('chat_id')
       .in('chat_id', chatIds)
       .eq('read', false)
       .neq('sender_id', user.id);

     // Process the data efficiently
     const lastMessageMap = new Map();
     const unreadCountMap = new Map();

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

     const chatsWithDetails = data.map(chat => ({
       ...chat,
       lastMessage: lastMessageMap.get(chat.id) || null,
       unreadCount: unreadCountMap.get(chat.id) || 0
     }));

     console.log(`[Inbox] Optimized fetch: ${chatIds.length} chats loaded with 2 queries instead of ${chatIds.length * 2}`);

     const sortedChats = chatsWithDetails.sort((a, b) => {
       const aTime = a.lastMessage 
         ? new Date(a.lastMessage.created_at).getTime() 
         : new Date(a.created_at).getTime();
       const bTime = b.lastMessage 
         ? new Date(b.lastMessage.created_at).getTime() 
         : new Date(b.created_at).getTime();
       return bTime - aTime;
     });

     chatIdsRef.current = sortedChats.map((c: any) => c.id);
     setChats(sortedChats);
   } catch (error) {
     console.error('Error fetching chats:', error);
   }
 };

 useEffect(() => {
  if (!user) return;

  // Subscribe to all message changes for this user's chats
  // Uses a broad filter and checks chatIdsRef in the handler
  // so the subscription doesn't recreate on every chat update
  const subscription = supabase
    .channel('inbox_changes')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'Message',
    }, (payload) => {
      // Only refetch if the message belongs to one of our chats
      if (chatIdsRef.current.includes(payload.new.chat_id)) {
        fetchChats();
      }
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [user]);

 useFocusEffect(
   useCallback(() => {
     if (user) {
       fetchChats();
     }
   }, [user])
 );

 return (
   <SafeAreaView className="flex-1 bg-white">
     <View className="px-4 pt-2 pb-3">
       <Text className="text-ios-large-title">Messages</Text>
     </View>
     {chats.length === 0 ? (
       <View className="flex-1 items-center justify-center px-8">
         <View className="items-center">
           <Ionicons name="chatbubbles-outline" size={80} color="#E5E7EB" />
           <Text className="text-2xl font-bold text-gray-800 mt-6 text-center">
             No Messages Yet
           </Text>
           <Text className="text-base text-gray-500 mt-3 text-center leading-6">
             When you match with someone, you'll be able to chat with them here
           </Text>
           <View className="mt-8 bg-gray-50 px-6 py-4 rounded-2xl">
             <Text className="text-sm text-gray-600 text-center">
               💡 Start liking posts in your feed to get matches!
             </Text>
           </View>
         </View>
       </View>
     ) : (
       <FlatList
         data={chats}
         renderItem={({ item: chat }) => (
           <ChatItem chat={chat} user={user} />
         )}
         keyExtractor={(item) => item.id}
       />
     )}
   </SafeAreaView>
 );
}