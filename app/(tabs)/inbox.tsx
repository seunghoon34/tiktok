import { View, Text, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
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

    // Get user's timezone offset in minutes
    const userTimezoneOffset = date.getTimezoneOffset();
    // Create a new date adjusted for the user's timezone
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
      // Changed format for this year to day/month
      const day = localDate.getDate();
      const month = localDate.getMonth() + 1; // getMonth() returns 0-11
      return `${day}/${month}`;
    } else {
      // Different year: show day/month/year
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



export default function ChatsScreen() {
  const [chats, setChats] = useState([]);
  const { user } = useAuth();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      const fetchChats = async () => {
        const { data, error } = await supabase
          .from('Chat')
          .select(`
            id,
            user1:user1_id (id, username),
            user2:user2_id (id, username)
          `)
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
          .limit(10);

        if (error) {
          console.error('Error fetching chats:', error);
          return;
        }

        console.log('Fetched chats:', data);

        // Fetch the last message for each chat
        const chatsWithLastMessage = await Promise.all(data.map(async (chat) => {
          const { data: messagesData } = await supabase
            .from('Message')
            .select('content, created_at')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...chat,
            lastMessage: messagesData[0] || null, // Get the last message or null if none
          };
        }));

        // Sort chats by the last message's created_at timestamp in descending order
        const sortedChats = chatsWithLastMessage.sort((a, b) => {
          const aLastMessageTime = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
          const bLastMessageTime = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
          return bLastMessageTime - aLastMessageTime; // Newest first
        });

        console.log('Chats with last message:', sortedChats);

        setChats(sortedChats);
      };

      fetchChats();
    }, [user])
  );

  console.log('Rendered chats:', chats);

  const getOtherUser = (chat) => {
    return chat.user1.id === user.id ? chat.user2 : chat.user1;
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Text style={{ fontSize: 32
        , fontWeight: 'bold', marginLeft: 15, marginBottom:10 }}>Messages</Text>
      <FlatList
        data={chats}
        renderItem={({ item: chat }) => {
          if (chat.lastMessage) {
            console.log('Original Supabase date:', chat.lastMessage.created_at);
            console.log('Converted local date:', new Date(chat.lastMessage.created_at).toLocaleString());
          }
          const otherUser = getOtherUser(chat);
          const lastMessage = chat.lastMessage;
          const maxLength = 50; // Set the maximum length for the message preview
          const truncatedMessage = lastMessage && lastMessage.content.length > maxLength
            ? lastMessage.content.substring(0, maxLength) + '...' // Truncate and add "..."
            : lastMessage ? lastMessage.content : ''; // Handle case where lastMessage is null

          return (
            <TouchableOpacity
              className="p-4 border-b border-gray-200"
              onPress={() => router.push(`/chat/${chat.id}`)}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Ionicons name="person-circle-outline" size={40} color="gray" />
                  <View className="ml-3">
                    <Text className="text-lg font-semibold">{otherUser.username}</Text>
                    {lastMessage && (
                      <Text className="text-gray-500">{truncatedMessage}</Text> // Use truncated message
                    )}
                  </View>
                </View>
                {lastMessage && (
                  <Text className="text-gray-400 text-sm">
                    {formatDate(lastMessage.created_at)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        keyExtractor={(item) => item.id}
      />
    </SafeAreaView>
  );
}