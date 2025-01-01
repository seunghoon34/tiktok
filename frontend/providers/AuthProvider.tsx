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
    currentChatId: null

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
            // Merge existing likes with new like
            setLikes(prevLikes => [...prevLikes, ...immediateUpdate]);
            return;
          }
        const { data, error } = await supabase.from('Like').select("*").eq('user_id', userId);
        if (error) {
            return;
        }
        setLikes(data || []);
        console.log(likes)

    }

    const getUser = async (id: string) => {
        try {
            console.log('Fetching user with ID:', id); // Debug log

            // First verify the user exists
            const { data, error } = await supabase
                .from("User")
                .select("*")
                .eq("id", id);
            
            console.log('User query result:', { data, error }); // Debug log

            if (error) throw error;
            if (!data || data.length === 0) {
                console.log('No user found, retrying in 2 seconds...'); // Debug log
                // If user not found, wait and retry once
                await new Promise(resolve => setTimeout(resolve, 2000));
                const retryResult = await supabase
                    .from("User")
                    .select("*")
                    .eq("id", id);
                
                console.log('Retry result:', retryResult); // Debug log
                
                if (retryResult.error || !retryResult.data || retryResult.data.length === 0) {
                    throw new Error('User not found after retry');
                }
                await setUser(retryResult.data[0]);
                await getLikes(retryResult.data[0].id);
            } else {
                await setUser(data[0]);
                await getLikes(data[0].id);
            }

            // Check if user has a profile
            const { data: profileData } = await supabase
                .from('UserProfile')
                .select('*')
                .eq('user_id', id)
                .single();

            if (!profileData) {
                router.push('/createprofile');
            } else {
                router.push('/(tabs)/profile');
            }
        } catch (error) {
            console.error('Detailed error in getUser:', error); // More detailed error logging
            router.push('/createprofile');
        }
    };

    const signIn = async (email: string, password: string) => {
        console.log(email, password)
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) console.log(error);

        if (error) throw error;

        getUser(data.user.id)

    };

    const signUp = async (username: string, email: string, password: string) => {
        try {
            console.log('Starting signup process...'); // Debug log

            // First create the auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
            });
            
            console.log('Auth signup result:', { authData, authError }); // Debug log

            if (authError) throw authError;
            if (!authData.user?.id) throw new Error('User ID is undefined');

            // Add a delay to ensure auth is completed
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log('Creating user record...'); // Debug log

            // Then create the user record
            const { data: userData, error: userError } = await supabase
                .from('User')
                .insert({
                    id: authData.user.id,
                    email: email,
                    username: username,
                })
                .select() // Add this to get the created user data
                .single();
            
            console.log('User creation result:', { userData, userError }); // Debug log

            if (userError) throw userError;

            // Add another delay to ensure user record is created
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log('Fetching created user...'); // Debug log

            // Now get the user
            await getUser(authData.user.id);
            
        } catch (error) {
            console.error('Detailed error in signUp:', error); // More detailed error logging
            throw error;
        }
    };

    const signOut = async () => {
        try {
          await SplashScreen.preventAutoHideAsync();
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          setUser(null);
          router.push('/(auth)');
        } catch (error) {
          console.log(error);
        } 
      };

    const setActiveChatId = (chatId: string | null) => {
        console.log("Setting active chat id to:", chatId); // Add this log

        setCurrentChatId(chatId);
    };

    useEffect(() => {
        const handleAuthStateChange = async (session) => {
          try {
            if (session) {
              // Show splash screen while getting user data
              await SplashScreen.preventAutoHideAsync();
              await getUser(session.user.id);
              
              // Hide splash after a short delay (for smoother transition)
              setTimeout(async () => {
                try {
                  await SplashScreen.hideAsync();
                } catch (error) {
                  console.log("Error hiding splash screen:", error);
                }
              }, 1000); // 1 second delay
            } else {
              // For logout/no session
              router.push('/(auth)');
              // Brief splash screen on logout
              setTimeout(async () => {
                try {
                  await SplashScreen.hideAsync();
                } catch (error) {
                  console.log("Error hiding splash screen:", error);
                }
              }, 500); // half second delay for logout
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
              console.log("New message received in chat:", payload.new.chat_id);
            console.log("Current active chat:", currentChatId);
              if (payload.new.chat_id) {
                const { data: chat } = await supabase
                  .from('Chat')
                  .select('user1_id, user2_id')
                  .eq('id', payload.new.chat_id)
                  .single();
    
                // Check if user is part of this chat and not the sender
                if (chat && 
                    (chat.user1_id === user.id || chat.user2_id === user.id) && 
                    payload.new.sender_id !== user.id && 
                    payload.new.chat_id !== currentChatId) { // This condition should now work correctly
                  
                  const { data: senderData } = await supabase
                    .from('User')
                    .select('username')
                    .eq('id', payload.new.sender_id)
                    .single();
      
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
      }, [user, currentChatId]);

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
        <AuthContext.Provider value={{ user, signIn, signUp, signOut, likes, getLikes , setActiveChatId, currentChatId}}>
            {children}
        </AuthContext.Provider>
    );
}