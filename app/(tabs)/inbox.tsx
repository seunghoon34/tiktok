import { View, Text, FlatList, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { useCallback, useEffect, useState, memo, useMemo } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { hybridCache } from '@/utils/memoryCache';

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
    // Check match expiration
    try {
      const { data: matchData } = await supabase
        .from('Match')
        .select('created_at')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUser.id}),and(user1_id.eq.${otherUser.id},user2_id.eq.${user.id})`)
        .single();
      
      if (matchData?.created_at) {
        const matchTime = new Date(matchData.created_at).getTime();
        const now = Date.now();
        const hoursPassed = (now - matchTime) / (1000 * 60 * 60);
        setIsExpired(hoursPassed >= 24);
      }
    } catch (error) {
      console.error('[InboxScreen] Error checking match expiration:', error);
    }
    
    // Get profile
    const getOtherUserProfile = async () => {
    // Check cache first
    const cacheKey = `profile:${otherUser.id}`;
    const cached = await hybridCache.get(cacheKey);
    
    if (cached) {
      console.log('[InboxScreen] Using cached profile for:', otherUser.id);
      setOtherUserProfile(cached);
      return;
    }
    
    setIsLoadingProfile(true);
    try {
      console.log('[InboxScreen] Fetching profile for other user:', otherUser.id);
      const { data, error } = await supabase
        .from('UserProfile')
        .select(`
          *,
          user:User (
            username
          )
        `)
        .eq('user_id', otherUser.id)
        .single();

      if (error) {
        console.error('[InboxScreen] Error fetching profile:', error);
        return;
      }

      if (data) {
        console.log('[InboxScreen] Profile data received:', { ...data, profilepicture: data.profilepicture ? 'exists' : 'null' });
        
        let profileData = data;
        
        if (data.profilepicture) {
          console.log('[InboxScreen] Getting public URL for:', data.profilepicture);
          const { data: publicData } = supabase.storage
            .from('profile_images')
            .getPublicUrl(data.profilepicture);
          
          if (publicData?.publicUrl) {
            // Remove dynamic timestamp - use static URL for better caching
            const imageUrl = publicData.publicUrl;
            console.log('[InboxScreen] Setting image URL:', imageUrl);
            profileData = {...data, profilepicture: imageUrl};
          } else {
            console.log('[InboxScreen] No public URL returned from storage');
            profileData = {...data, profilepicture: null};
          }
        } else {
          console.log('[InboxScreen] No profile picture path in data');
          profileData = {...data, profilepicture: null};
        }
        
        // Cache for 6 hours
        await hybridCache.set(cacheKey, profileData, 6 * 60 * 60 * 1000);
        setOtherUserProfile(profileData);
      } else {
        console.log('[InboxScreen] No profile data returned');
      }
    } catch (error) {
      console.error('[InboxScreen] Exception in getOtherUserProfile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };
  
  getOtherUserProfile();
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
    prevProps.user?.id === nextProps.user?.id
  );
});

export default function InboxScreen() {
 const [chats, setChats] = useState<any[]>([]);
 const { user } = useAuth();

 const fetchChats = async () => {
   try {
     // First, get list of blocked users
     const { data: blockedUsers, error: blockError } = await supabase
       .from('UserBlock')
       .select('blocker_id, blocked_id')
       .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

     if (blockError) throw blockError;

     // Create array of user IDs to exclude
     const excludeUserIds = blockedUsers?.reduce((acc: string[], block) => {
       if (block.blocker_id === user.id) acc.push(block.blocked_id);
       if (block.blocked_id === user.id) acc.push(block.blocker_id);
       return acc;
     }, []);

     // Get chats excluding blocked users
     const { data, error } = await supabase
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
       .not(excludeUserIds.length > 0 ? 'user1_id' : 'id', 
            excludeUserIds.length > 0 ? 'in' : 'eq', 
            excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : user.id)
       .not(excludeUserIds.length > 0 ? 'user2_id' : 'id', 
            excludeUserIds.length > 0 ? 'in' : 'eq', 
            excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : user.id)
       .limit(10);

     if (error) throw error;

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

     setChats(sortedChats);
   } catch (error) {
     console.error('Error fetching chats:', error);
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
     <View className="px-4 pt-2 pb-3">
       <Text className="text-ios-large-title">Messages</Text>
     </View>
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