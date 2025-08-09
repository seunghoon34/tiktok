import { View, Text, TextInput, FlatList, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, ScrollView, Image } from 'react-native';
import { useEffect, useState, useRef, useCallback,  } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Header from '@/components/header';
import CustomHeader from '@/components/customHeader';
import { sendMessageNotification } from '@/utils/notifications';

export default function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const { id } = useLocalSearchParams();
  const { user, setActiveChatId } = useAuth();
  const [otherUser, setOtherUser] = useState(null);
  const flatListRef = useRef();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [otherUserProfile, setOtherUserProfile] = useState(null);
  const [hasVideos, setHasVideos] = useState(false);


  const scrollViewRef = useRef<ScrollView>(null);

  

  

  useEffect(() => {
    // Use a small timeout to ensure the new content is rendered
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 0);
  }, [messages]);

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  

  useEffect(() => {
    if (!id || !user) return;
  
    // Mark messages as read when entering chat
    const markMessagesAsRead = async () => {
      await supabase
        .from('Message')
        .update({ read: true })
        .eq('chat_id', id)
        .neq('sender_id', user.id);
    };
  
    markMessagesAsRead();
    // ... rest of your existing chat fetch code
  }, [id, user]);

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
    sender:sender_id (id, username),
    read,
    created_at
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
        // If the new message is from the other user, mark it as read immediately
        if (payload.new.sender_id !== user.id) {
          await supabase
            .from('Message')
            .update({ read: true })
            .eq('id', payload.new.id);
        }

        const { data: messageData } = await supabase
          .from('Message')
          .select(`
            *,
            sender:sender_id (id, username),
            read,
            created_at
          `)
          .eq('id', payload.new.id)
          .single();

        if (messageData) {
          setMessages(current => [...current, messageData]);
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'Message',
        filter: `chat_id=eq.${id}`
      },
      async (payload) => {
        // Fetch the complete updated message data
        const { data: messageData } = await supabase
          .from('Message')
          .select(`
            *,
            sender:sender_id (id, username),
            read,
            created_at
          `)
          .eq('id', payload.new.id)
          .single();
    
        if (messageData) {
          setMessages(current => 
            current.map(msg => 
              msg.id === messageData.id 
                ? messageData  // Replace with complete updated message
                : msg
            )
          );
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

    


    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 0);

    const { data: otherUserData } = await supabase
      .from('User')
      .select('app_state')
      .eq('id', otherUser.id)
      .single();

    // Only send notification if other user is in background
    if (otherUserData?.app_state === 'background') {
      await sendMessageNotification(
        user.id,
        user.username,
        otherUser.id,
        id
      );
    }

    setNewMessage('');
  };

  

  useEffect(() => {
    if (!otherUser) return;

    const getOtherUserProfile = async () => {
      try {
        console.log('[ChatScreen] Fetching profile for other user:', otherUser.id);
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
          console.error('[ChatScreen] Error fetching profile:', error);
          return;
        }

        if (data) {
          console.log('[ChatScreen] Profile data received:', { ...data, profilepicture: data.profilepicture ? 'exists' : 'null' });
          
          if (data.profilepicture) {
            console.log('[ChatScreen] Getting public URL for:', data.profilepicture);
            const { data: publicData, error: storageError } = supabase.storage
              .from('profile_images')
              .getPublicUrl(data.profilepicture);
            
            if (storageError) {
              console.error('[ChatScreen] Error getting public URL:', storageError);
            }
            
            if (publicData?.publicUrl) {
              const imageUrl = `${publicData.publicUrl}?t=${Date.now()}`;
              console.log('[ChatScreen] Setting image URL:', imageUrl);
              
              // Test if the image actually loads (web only)
              if (typeof window !== 'undefined' && window.Image) {
                const testImage = new window.Image();
                testImage.onload = () => {
                  console.log('[ChatScreen] ✅ Image loaded successfully');
                };
                testImage.onerror = (error: any) => {
                  console.error('[ChatScreen] ❌ Failed to load image:', error);
                  console.error('[ChatScreen] Image URL that failed:', imageUrl);
                };
                testImage.src = imageUrl;
              }
              
              setOtherUserProfile({...data, profilepicture: imageUrl});
            } else {
              console.log('[ChatScreen] No public URL returned from storage');
              setOtherUserProfile({...data, profilepicture: null});
            }
          } else {
            console.log('[ChatScreen] No profile picture path in data');
            setOtherUserProfile({...data, profilepicture: null});
          }
        } else {
          console.log('[ChatScreen] No profile data returned');
        }
      } catch (error) {
        console.error('[ChatScreen] Exception in getOtherUserProfile:', error);
      }
    };
    getOtherUserProfile();
  }, [otherUser]);

  const checkUserVideos = async () => {
    if (!otherUser?.id) return; // Add this check

    const { data, error } = await supabase
      .from('Video')
      .select('id')
      .eq('user_id', otherUser?.id)
      .gt('expired_at', new Date().toISOString())
      .limit(1);
    
    setHasVideos(data && data.length > 0);
  };

  useFocusEffect(
    useCallback(() => {
      // Only check if we have otherUser
      if (otherUser?.id) {
        checkUserVideos();
      }
    }, [otherUser]) // Empty dependency array as we want it to run only on focus
  );

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={['top']} className="flex-1 bg-white">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 10}
        >
          <View className="flex-1">
           
            <View className="flex-row items-center  w-full px-4 py-2">
      <View className="w-10">
        
          <TouchableOpacity onPress={() => router.back()}>
          
            <Ionicons name="chevron-back" size={32} color={'black'}/>
          </TouchableOpacity>
        
      </View>
      <TouchableOpacity className="mx-2" onPress={() => router.push(`/user?user_id=${otherUser?.id}`)}>
        <View className='flex-row'>
      {otherUserProfile?.profilepicture ? (
            <Image 
              source={{ uri: otherUserProfile.profilepicture }}
              className="w-10 h-10 rounded-full mr-2"
            />
          ) : (
            <Ionicons 
              name="person-circle-outline" 
              size={40} 
              color="gray" 
              className="mr-2" 
            />
          )}
      <Text className="font-bold text-2xl text-black">
        {otherUser?.username || 'Chat'} 
      </Text>
      </View>
      </TouchableOpacity>
    </View>
         <ScrollView
  ref={scrollViewRef}
  className="flex-1"
  contentContainerStyle={{ paddingBottom: 20 }}
>
  {messages.map((item) => (
    <View 
      key={item.id}
      className={`m-2 ${item.sender_id === user.id ? 'self-end flex-row-reverse' : 'self-start flex-row'}`}
    >
      {/* Avatar for other user */}
      {item.sender_id !== user.id && (
  hasVideos ? (
    <TouchableOpacity onPress={() => router.push(`/userstories?user_id=${otherUser?.id}`)}>
      <View className="p-0.5 rounded-full bg-red-400">
        <View className="p-0.5 bg-white rounded-full">
          {otherUserProfile?.profilepicture ? (
            <Image
              source={{ uri: otherUserProfile.profilepicture }}
              className="w-10 h-10 rounded-full"
              onLoad={() => console.log('[ChatScreen] Image component loaded successfully')}
              onError={(error) => {
                console.error('[ChatScreen] Image component failed to load:', error.nativeEvent);
                console.error('[ChatScreen] Failed image URL:', otherUserProfile.profilepicture);
              }}
            />
          ) : (
            <View className="mr-2">
              <Ionicons
                name="person-circle-outline"
                size={40}
                color="gray"
              />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  ) : (
    <TouchableOpacity onPress={() => router.push(`/user?user_id=${otherUser?.id}`)}>
      {otherUserProfile?.profilepicture ? (
        <Image
          source={{ uri: otherUserProfile.profilepicture }}
          className="w-10 h-10 rounded-full"
          onLoad={() => console.log('[ChatScreen] Image component loaded successfully (with stories)')}
          onError={(error) => {
            console.error('[ChatScreen] Image component failed to load (with stories):', error.nativeEvent);
            console.error('[ChatScreen] Failed image URL:', otherUserProfile.profilepicture);
          }}
        />
      ) : (
        <View className="mr-2">
          <Ionicons
            name="person-circle-outline"
            size={40}
            color="gray"
          />
        </View>
      )}
    </TouchableOpacity>
  )
)}

      {/* Message bubble */}
      <View className={`p-2 rounded-lg max-w-[80%] ${
        item.sender_id === user.id ? 'bg-red-400 ml-2' : 'bg-gray-100 mr-2'
      }`}>
        <Text className={item.sender_id === user.id ? 'text-white text-lg' : 'text-black text-lg'}>
          {item.content}
        </Text>
      </View>

      {/* Time and Read status */}
      <View className='mt-2'>
        <Text className="text-gray-500 text-xs text-right h-4" >
          {item.sender_id === user.id && item.read ? 'Read' : ' '}
        </Text>
        <Text className="text-gray-500 text-xs">
          {formatMessageTime(item.created_at + 'Z')}
        </Text>
      </View>
    </View>
  ))}
</ScrollView>
            
            <View className="px-4 py-2 border-t border-gray-200 flex-row items-center bg-white">
            <TextInput
              className="flex-1 bg-gray-100 px-4 py-2 rounded-full mr-2 min-h-[40px]" // Removed max-h
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              multiline={true} // Add this
              numberOfLines={1} // This sets initial number of lines
              style={{ maxHeight: 100,
                borderRadius: 20, // Add fixed border radius instead of rounded-full
                textAlignVertical: 'center',
              }} // Limit maximum height if needed
              onFocus={() => {
                scrollViewRef.current?.scrollToEnd({ animated: false });
              }}
            />
              <TouchableOpacity
                onPress={sendMessage}
                className="h-10 w-10 items-center justify-center"
              >
                <Ionicons name="send" size={24} color="#ff5757" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}