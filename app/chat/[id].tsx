import { View, Text, TextInput, FlatList, TouchableOpacity, SafeAreaView, KeyboardAvoidingView } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Header from '@/components/header';

export default function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [otherUser, setOtherUser] = useState(null);

  useEffect(() => {
    if (!id || !user) return;

    // Fetch initial messages
    const fetchMessages = async () => {
      const { data: chatData } = await supabase
        .from('Chat')
        .select(`
          user1:user1_id (id, username),
          user2:user2_id (id, username)
        `)
        .eq('id', id)
        .single();

      setOtherUser(chatData.user1.id === user.id ? chatData.user2 : chatData.user1);

      const { data: messagesData } = await supabase
        .from('Message')
        .select(`
          *,
          sender:sender_id (id, username)
        `)
        .eq('chat_id', id)
        .order('created_at', { ascending: true });

      setMessages(messagesData);
    };

    fetchMessages();

    // Set up real-time subscription for new messages
    const subscription = supabase
      .channel(`chat:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          filter: `chat_id=eq.${id}`
        },
        async (payload) => {
          // Fetch the complete message data including sender info
          const { data: messageData } = await supabase
            .from('Message')
            .select(`
              *,
              sender:sender_id (id, username)
            `)
            .eq('id', payload.new.id)
            .single();

          if (messageData) {
            setMessages(current => [...current, messageData]);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
}, [id, user]);

  

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const { error } = await supabase
      .from('Message')
      .insert({
        chat_id: id,
        sender_id: user.id,
        content: newMessage.trim()
      });

    if (error) {
      console.error('Error sending message:', error);
      return;
    }

    setNewMessage('');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View className="flex-1 bg-white">
          <Header 
            title={otherUser?.username || 'Chat'} 
            color="black" 
            goBack={true}
          />
          <FlatList
            data={messages}
            renderItem={({ item }) => (
              <View className={`p-2 m-2 max-w-[80%] rounded-lg ${
                item.sender_id === user.id ? 'bg-blue-500 self-end' : 'bg-gray-200 self-start'
              }`}>
                <View className="flex-row">
                  <Text className={item.sender_id === user.id ? 'text-white text-lg' : 'text-black text-lg'}>
                    {item.content}
                  </Text>
                </View>
              </View>
            )}
            keyExtractor={(item) => item.id}
            className="flex-1"
          />
          <View className="p-4 border-t border-gray-200 flex-row items-center">
            <TextInput
              className="flex-1 bg-gray-100 p-2 rounded-full mr-2"
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
            />
            <TouchableOpacity onPress={sendMessage}>
              <Ionicons name="send" size={24} color="blue" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}