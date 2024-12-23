import { registerForPushNotifications, sendMatchNotifications, sendMessageNotification } from '@/utils/notifications';
import { supabase } from '@/utils/supabase'
import { useRouter } from 'expo-router';
import { createContext, useContext, useEffect, useState} from 'react'
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';







export const AuthContext = createContext({
    user: null,
    signIn: async (email: string, password: string) =>{},
    signUp: async (username: string, email: string, password: string) =>{},
    signOut: async () =>{},
    likes: [],
    getLikes: async (userId: string) => {},
    setActiveChatId: (chatId: string | null) => {},  // Changed to match function name

});

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }:{children: React.ReactNode}) => {
    const [user, setUser] = useState(null);
    const router = useRouter()
    const [likes,setLikes] = useState([])
    const [currentChatId, setCurrentChatId] = useState(null);   

    const getLikes = async (userId: string, immediateUpdate?: any[]) => {
        if(!user) {
            return;
        }
        if (immediateUpdate) {
            setLikes(immediateUpdate);
            return;
          }
        const { data, error } = await supabase.from('Like').select("*").eq('user_id', userId);
        if (error) {
            return;
        }
        setLikes(data || []);

    }

    const getUser = async (id:string) => {
        const { data, error } = await supabase.from("User").select("*").eq("id",id).single();
        if(error) throw error
        await setUser(data);        
        await getLikes(data.id);
        console.log(data)
        router.push('/(tabs)/profile')

    }

    const signIn = async (email: string, password: string) => {
        console.log(email, password)
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) console.log(error);

        if (error) throw error;

        getUser(data.user.id)

    };

    const signUp = async (username: string, email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
          });
          if (error) throw error;
          
          if (!data.user?.id) throw new Error('User ID is undefined');
      
          const { error: userError } = await supabase.from('User').insert({
            id: data.user.id,
            email: email,
            username: username,
          });
          if (userError) console.log(userError);
          if(userError) throw userError;
          getUser(data.user.id)
          router.back()
          router.push('/(tabs)')
    };

    const signOut = async () => {
        console.log("signout")
        const { error } = await supabase.auth.signOut();
        if(error) console.log(error)
        if (error) throw error;
        setUser(null)

        router.push('/(auth)')
    };

    const setActiveChatId = (chatId: string | null) => {
        setCurrentChatId(chatId);
        console.log("current chat id: ", currentChatId)
    };

    useEffect(() => {
        const handleAuthStateChange = async (session) => {
          try {
            if (session) {
              await getUser(session.user.id);
              // Keep splash screen visible during initialization
              setTimeout(async () => {
                await SplashScreen.hideAsync();
              }, 2000); // Show splash for 2 seconds after login
            } else {
              router.push('/(auth)');
              await SplashScreen.hideAsync(); // Hide for login screen
            }
          } catch (error) {
            console.error('Error handling auth state:', error);
            await SplashScreen.hideAsync();
          }
        };
      
        const { data: authData } = supabase.auth.onAuthStateChange((event, session) => {
          handleAuthStateChange(session);
        });
      
        return () => {
          authData.subscription.unsubscribe();
        };
      }, []);

    useEffect(() => {
        if (user) {
          // Log the device info and current user
          console.log('Device registering notification:', {
            username: user.username,
            userId: user.id,
            deviceName: Device.deviceName, // You'll need to import Device from expo-device
          });
          registerForPushNotifications(user.id);
        }
      }, [user]);

      useEffect(() => {
        if (!user) return;
    
        const subscription = supabase
          .channel('global_messages')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'Message'
            },
            async (payload) => {
              // Only notify if the message is for current user and they didn't send it
              if (payload.new.chat_id) {
                const { data: chat } = await supabase
                  .from('Chat')
                  .select('user1_id, user2_id')
                  .eq('id', payload.new.chat_id)
                  .single();
    
                // Check if user is part of this chat and not the sender
                console.log("send chat id: ", currentChatId)
                if (chat && 
                    (chat.user1_id === user.id || chat.user2_id === user.id) && 
                    payload.new.sender_id !== user.id
                    && payload.new.chat_id !== currentChatId) {
                  
                  // Get sender's username
                  const { data: senderData } = await supabase
                    .from('User')
                    .select('username')
                    .eq('id', payload.new.sender_id)
                    .single();
    
                  // Send notification
                  await sendMessageNotification(
                    payload.new.sender_id,
                    senderData.username,
                    user.id,
                    payload.new.chat_id
                  );
                }
              }
            }
          )
          .subscribe();
    
        return () => {
          subscription.unsubscribe();
        };
      }, [user]);

      useEffect(() => {
        if (!user) return;
      
        // Set up notification tap handler
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            try {
              const data = response.notification.request.content.data;
              
              if (data.type === 'match' || data.type === 'message') {
                if (data.chatId) {
                  router.push(`/chat/${data.chatId}`);
                }
              }
            } catch (error) {
              console.error('Error handling notification tap:', error);
            }
          });
      
        return () => subscription.remove();
      }, [user]);

      useEffect(() => {
        if (user && user.id) {
            getLikes(user.id);
        }
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, signIn, signUp, signOut, likes, getLikes , setActiveChatId}}>
            {children}
        </AuthContext.Provider>
    );
}