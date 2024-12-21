import { View, Text, TextInput, FlatList, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Header from '@/components/header';

export default function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [otherUser, setOtherUser] = useState(null);
  const { setActiveChatId } = useAuth();
  const flatListRef = useRef();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    setActiveChatId(id);
    return () => setActiveChatId(null);
  }, [id]);

  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to ensure render is complete
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 300);
    }
  }, [messages]); // This will trigger whenever messages update

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    if (!id || !user) return;

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
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
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
    <View className="flex-1 bg-white">
      <SafeAreaView edges={['top']} className="flex-1 bg-white">
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View className="flex-1">
            <Header 
              title={otherUser?.username || 'Chat'} 
              color="black" 
              goBack={true}
            />
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={({ item }) => {
                return (
                  <View className={`flex-row items-start m-2 max-w-[80%] ${item.sender_id === user.id ? 'self-end' : 'self-start'}`}>
                    {item.sender_id !== user.id && (
                      <TouchableOpacity onPress={() => router.push(`/user?user_id=${otherUser?.id}`)}>
                        <Ionicons name="person-circle-outline" size={40} color="gray" className="mr-2 self-start" />
                      </TouchableOpacity>
                    )}
                    <View className={`p-2 rounded-lg ${
                      item.sender_id === user.id ? 'bg-blue-500' : 'bg-gray-200'
                    }`}>
                      <Text className={item.sender_id === user.id ? 'text-white text-lg' : 'text-black text-lg'}>
                        {item.content}
                      </Text>
                    </View>
                  </View>
                );
              }}
              keyExtractor={(item) => item.id}
              className="flex-1"
              contentContainerStyle={{ paddingBottom: keyboardHeight * 0.5 }}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
              initialNumToRender={messages.length} // Render all messages initially
              maintainVisibleContentPosition={{ // Keep position when keyboard appears
                minIndexForVisible: 0,
              }}
              className="flex-1"
            />
            <View className="px-4 py-2 border-t border-gray-200 flex-row items-center bg-white">
              <TextInput
                className="flex-1 bg-gray-100 px-4 py-2 rounded-full mr-2 min-h-[40px] max-h-[40px]"
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                onFocus={() => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
              />
              <TouchableOpacity 
                onPress={sendMessage}
                className="h-10 w-10 items-center justify-center"
              >
                <Ionicons name="send" size={24} color="blue" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}