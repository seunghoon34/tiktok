import { View, Text, FlatList, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const formatDate = (dateString) => {
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

const ChatItem = ({ chat, user }) => {
const [otherUserProfile, setOtherUserProfile] = useState(null);
 const router = useRouter();
 const otherUser = user && chat.user1 && chat.user2 
 ? chat.user1.id === user.id ? chat.user2 : chat.user1
 : null;
  const lastMessage = chat.lastMessage;

 useEffect(() => {
  if (!otherUser) return;
  const getOtherUserProfile = async () => {
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

    if (data) {
      const { data: urlData } = await supabase.storage
        .from('avatars')
        .createSignedUrl(data.profilepicture, 3600);
      if (urlData) {
        setOtherUserProfile({...data, profilepicture: urlData.signedUrl});
      }
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
 const [chats, setChats] = useState([]);
 const { user } = useAuth();

 const fetchChats = async () => {
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
     .limit(10);

   if (error) {
     console.error('Error fetching chats:', error);
     return;
   }

   const chatsWithDetails = await Promise.all(data.map(async (chat) => {
     const { data: messagesData } = await supabase
       .from('Message')
       .select('content, created_at')
       .eq('chat_id', chat.id)
       .order('created_at', { ascending: false })
       .limit(1);

     const { count } = await supabase
       .from('Message')
       .select('*', { count: 'exact' })
       .eq('chat_id', chat.id)
       .eq('read', false)
       .neq('sender_id', user.id);

     return {
       ...chat,
       lastMessage: messagesData[0] || null,
       unreadCount: count || 0
     };
   }));

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
 };

 useEffect(() => {
   if (!user) return;
 
   const subscription = supabase
     .channel('chat_updates')
     .on(
       'postgres_changes',
       {
         event: '*',
         schema: 'public',
         table: 'Message'
       },
       () => {
         fetchChats();
       }
     )
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