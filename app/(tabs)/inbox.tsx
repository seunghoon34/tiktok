import { View, Text, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'expo-router';

export default function ChatsScreen() {
  const [chats, setChats] = useState([]);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const fetchChats = async () => {
      const { data, error } = await supabase
        .from('Chat')
        .select(`
          id,
          user1:user1_id (id, username),
          user2:user2_id (id, username)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (error) {
        console.error('Error fetching chats:', error);
        return;
      }

      setChats(data);
    };

    fetchChats();
  }, [user]);

  const getOtherUser = (chat) => {
    return chat.user1.id === user.id ? chat.user2 : chat.user1;
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <FlatList
        data={chats}
        renderItem={({ item: chat }) => {
          const otherUser = getOtherUser(chat);
          return (
            <TouchableOpacity
              className="p-4 border-b border-gray-200"
              onPress={() => router.push(`/chat/${chat.id}`)}
            >
              <Text className="text-lg font-semibold">{otherUser.username}</Text>
            </TouchableOpacity>
          );
        }}
        keyExtractor={(item) => item.id}
      />
    </SafeAreaView>
  );
}