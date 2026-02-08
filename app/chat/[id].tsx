import { View, Text, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useRef, useCallback,  } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Header from '@/components/header';
import CustomHeader from '@/components/customHeader';
import { chatCache, CachedMessage } from '@/utils/chatCache';
import { profileCache } from '@/utils/profileCache';
import { EnhancedChatService } from '@/utils/chatCacheEnhanced';

// Helper function to format time
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const { id } = useLocalSearchParams();
  const { user, setActiveChatId } = useAuth();
  const [otherUser, setOtherUser] = useState<any>(null);
  const flatListRef = useRef<any>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputHeight, setInputHeight] = useState(44); // Track input height
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const [hasVideos, setHasVideos] = useState<boolean>(false);
  const [isChatExpired, setIsChatExpired] = useState<boolean>(false);
  const [matchCreatedAt, setMatchCreatedAt] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);


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
      await EnhancedChatService.markMessagesAsRead(id as string, user.id);
    };
  
    markMessagesAsRead();
  }, [id, user]);

  useEffect(() => {
    setActiveChatId(Array.isArray(id) ? id[0] : id);
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
        // Fix: Use scrollViewRef instead of flatListRef
        console.log(`[Chat] Keyboard shown, height: ${e.endCoordinates.height}, scrolling to end`);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
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
          user2:user2_id (id, username),
          created_at
        `)
        .eq('id', id)
        .single();

      if (chatData) {
        const user1 = Array.isArray(chatData.user1) ? chatData.user1[0] : chatData.user1;
        const user2 = Array.isArray(chatData.user2) ? chatData.user2[0] : chatData.user2;
        const other = user1?.id === user.id ? user2 : user1;
        setOtherUser(other);
        
        // Check if either user has blocked the other
        if (other?.id) {
          const { data: blockData } = await supabase
            .from('UserBlock')
            .select('id')
            .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${other.id}),and(blocker_id.eq.${other.id},blocked_id.eq.${user.id})`);
          
          if (blockData && blockData.length > 0) {
            setIsBlocked(true);
            console.log('[Chat] User is blocked - messaging disabled');
          }
        }
        
        // Check if there's a match and if it's expired
        if (other?.id) {
          const { data: matchData } = await supabase
            .from('Match')
            .select('created_at')
            .or(`and(user1_id.eq.${user.id},user2_id.eq.${other.id}),and(user1_id.eq.${other.id},user2_id.eq.${user.id})`)
            .single();
          
          if (matchData?.created_at) {
            setMatchCreatedAt(matchData.created_at);
            
            // Check if 24 hours have passed
            const matchTime = new Date(matchData.created_at).getTime();
            const now = Date.now();
            const hoursPassed = (now - matchTime) / (1000 * 60 * 60);
            const expired = hoursPassed >= 24;
            
            setIsChatExpired(expired);
            console.log(`[Chat] Match age: ${hoursPassed.toFixed(1)}h, expired: ${expired}`);
          }
        }
      }

      // Use enhanced chat service for smart loading
      const result = await EnhancedChatService.loadMessagesWithSync(id as string, user.id);
      
      setMessages(result.messages);
      
      if (result.hasNewMessages) {
        console.log(`[Chat] Loaded ${result.messages.length} total messages (${result.newMessageCount} new)`);
      } else {
        console.log(`[Chat] Loaded ${result.messages.length} messages from cache (no new messages)`);
      }
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

        // Optimize: Use payload data directly instead of fetching again
        const newMessage = {
          ...payload.new,
          sender: payload.new.sender_id === user.id ? 
            { id: user.id, username: user.username } : 
            otherUser,
          read: payload.new.read,
          created_at: payload.new.created_at
        };

        setMessages(current => [...current, newMessage]);
        
        // Update cache with new message
        await chatCache.addMessage(id as string, newMessage as CachedMessage);
        
        // Ensure scroll happens after message is rendered
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 150);
        
        console.log(`[Chat] Real-time message added and cached`);
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
    
    // Check if user is blocked
    if (isBlocked) {
      console.log('[Chat] Cannot send message - user is blocked');
      return;
    }
    
    // Check if chat has expired
    if (isChatExpired) {
      console.log('[Chat] Cannot send message - chat has expired');
      return;
    }

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

    // Notification is handled automatically by AuthProvider's real-time subscription
    // No need to send it here to avoid duplicates

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 0);

    setNewMessage('');
  };

  

  useEffect(() => {
    if (!otherUser) return;

    const getOtherUserProfile = async () => {
      try {
        console.log('[ChatScreen] Loading profile for other user:', otherUser.id);
        const cachedProfile = await profileCache.getProfile(otherUser.id);
        
        if (cachedProfile) {
          console.log('[ChatScreen] Profile loaded (cached or fresh)');
          setOtherUserProfile(cachedProfile);
        } else {
          console.log('[ChatScreen] No profile data available for user:', otherUser.id);
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
    
            setHasVideos(data ? data.length > 0 : false);
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
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
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
      className={`m-2 gap-3 ${item.sender_id === user.id ? 'self-end flex-row-reverse' : 'self-start flex-row'}`}
    >
      {/* Avatar for other user */}
      {item.sender_id !== user.id && (
  hasVideos ? (
    <TouchableOpacity onPress={() => router.push(`/userstories?user_id=${otherUser?.id}`)} activeOpacity={0.6}>
      <View className="p-0.5 rounded-full" style={{ backgroundColor: '#FF6B6B' }}>
        <View className="p-0.5 bg-white rounded-full">
          {otherUserProfile?.profilepicture ? (
            <Image
              source={{ uri: otherUserProfile.profilepicture }}
              className="w-avatar h-avatar rounded-full"
              onLoad={() => {}}
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
    <TouchableOpacity onPress={() => router.push(`/user?user_id=${otherUser?.id}`)} activeOpacity={0.6}>
      {otherUserProfile?.profilepicture ? (
        <Image
          source={{ uri: otherUserProfile.profilepicture }}
          className="w-avatar h-avatar rounded-full"
          onLoad={() => {}}
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
      <View className="flex-1">
        <View 
          className={`px-3 py-2 rounded-2xl ${item.sender_id === user.id ? 'self-end' : 'self-start'}`}
          style={[
            { maxWidth: '75%' },
            item.sender_id === user.id ? { backgroundColor: '#FF6B6B' } : { backgroundColor: '#F3F4F6' }
          ]}
        >
          <Text className={`text-base ${item.sender_id === user.id ? 'text-white' : 'text-black'}`}>
            {item.content}
          </Text>
        </View>
        
        {/* Time and Read status - directly under bubble */}
        <View className={`mt-0.5 ${item.sender_id === user.id ? 'items-end' : 'items-start'}`}>
          <Text className="text-gray-500 text-xs">
            {item.sender_id === user.id && item.read ? 'Read · ' : ''}{formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    </View>
  ))}
</ScrollView>
            
            <View className="px-4 py-4 pb-8 border-t border-gray-200 flex-row items-center bg-white">
            {isBlocked ? (
              <View className="flex-1 bg-gray-200 px-4 py-3 rounded-[20px] items-center justify-center">
                <Text className="text-gray-500 font-medium">
                  🚫 This user is blocked
                </Text>
              </View>
            ) : isChatExpired ? (
              <View className="flex-1 bg-gray-200 px-4 py-3 rounded-[20px] items-center justify-center">
                <Text className="text-gray-500 font-medium">
                  💬 This chat has expired (24h)
                </Text>
              </View>
            ) : (
              <>
                <TextInput
                  className="flex-1 bg-gray-100 px-4 py-3 mr-2 min-h-[44px]"
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Type a message..."
                  multiline={true}
                  style={{ 
                    maxHeight: 120, // Allow more height for expansion
                    borderRadius: 20,
                    textAlignVertical: 'top', // Align text to top for multiline
                    fontSize: 16,
                    lineHeight: 20, // Better line spacing
                  }}
                  onContentSizeChange={(event) => {
                    const newHeight = Math.max(44, Math.min(120, event.nativeEvent.contentSize.height + 24)); // 24 for padding
                    const previousHeight = inputHeight;
                    setInputHeight(newHeight);
                    
                    // Force scroll when input height changes (expanding or shrinking)
                    if (newHeight !== previousHeight) {
                      console.log(`[Chat] Input height changed: ${previousHeight} → ${newHeight}, scrolling to end`);
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 50);
                    }
                  }}
                />
                <TouchableOpacity 
                  onPress={sendMessage}
                  className="bg-[#FF6B6B] rounded-full p-3"
                >
                  <Ionicons name="send" size={20} color="white" />
                </TouchableOpacity>
              </>
            )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}