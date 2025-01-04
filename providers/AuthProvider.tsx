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
    signUp: async (email: string, password: string) =>{},
    signOut: async () =>{},
    likes: [],
    getLikes: async (userId: string) => {},
    setActiveChatId: (chatId: string | null) => {},
    currentChatId: null,
    loading: true,  // Add this
});

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }:{children: React.ReactNode}) => {
    const [user, setUser] = useState(null);
    const router = useRouter()
    const [likes, setLikes] = useState([])
    const [currentChatId, setCurrentChatId] = useState(null);   
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    const getLikes = async (userId: string, immediateUpdate?: any[]) => {
        if(!user) return;
        
        if (immediateUpdate) {
            setLikes(prevLikes => [...prevLikes, ...immediateUpdate]);
            return;
        }
        
        const { data, error } = await supabase.from('Like').select("*").eq('user_id', userId);
        if (error) return;
        
        setLikes(data || []);
    }

    const getUser = async (id: string) => {
        try {
            const { data, error } = await supabase
                .from("User")
                .select("*")
                .eq("id", id);
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const retryResult = await supabase
                    .from("User")
                    .select("*")
                    .eq("id", id);
                
                if (retryResult.error || !retryResult.data || retryResult.data.length === 0) {
                    throw new Error('User not found after retry');
                }
                await setUser(retryResult.data[0]);
                await getLikes(retryResult.data[0].id);
            } else {
                await setUser(data[0]);
                await getLikes(data[0].id);
            }

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
            console.error('Error in getUser:', error);
            router.push('/createprofile');
        }
    };

    const signIn = async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ 
                email, 
                password 
            });
            
            if (error) throw error;
            
            if (data.session) {
                setSession(data.session);
                await getUser(data.user.id);
            }
        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    };

    const signUp = async (email: string, password: string) => {
        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
            });
            
            if (authError) throw authError;
            if (!authData.user?.id) throw new Error('User ID is undefined');

            await new Promise(resolve => setTimeout(resolve, 2000));

            const tempUsername = `user_${Date.now()}`;

            const { data: userData, error: userError } = await supabase
                .from('User')
                .insert({
                    id: authData.user.id,
                    email: email,
                    username: tempUsername,
                })
                .select()
                .single();
            
            if (userError) throw userError;

            await new Promise(resolve => setTimeout(resolve, 2000));
            await getUser(authData.user.id);
            
        } catch (error) {
            console.error('Sign up error:', error);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            await SplashScreen.preventAutoHideAsync();
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            setUser(null);
            setSession(null);
            router.push('/(auth)');
        } catch (error) {
            console.error('Sign out error:', error);
            throw error;
        } finally {
            try {
                await SplashScreen.hideAsync();
            } catch (error) {
                console.error('Error hiding splash screen:', error);
            }
        }
    };

    const setActiveChatId = (chatId: string | null) => {
        setCurrentChatId(chatId);
    };

    useEffect(() => {
      const initializeAuth = async () => {
          try {
              await SplashScreen.preventAutoHideAsync();
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              
              if (currentSession) {
                  setSession(currentSession);
                  await getUser(currentSession.user.id);
              } else {
                  router.push('/(auth)');
              }
          } catch (error) {
              console.error('Error initializing auth:', error);
              router.push('/(auth)');
          } finally {
              setLoading(false);
              try {
                  await SplashScreen.hideAsync();
              } catch (error) {
                  console.error('Error hiding splash screen:', error);
              }
          }
      };
  
      initializeAuth();
  
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          setSession(newSession);
          
          if (event === 'SIGNED_OUT') {
              setUser(null);
              router.push('/(auth)');
          } else if (event === 'SIGNED_IN' && newSession) {
              await getUser(newSession.user.id);
          } else if (event === 'TOKEN_REFRESHED' && newSession) {
              setSession(newSession);
          }
      });
  
      return () => {
          authListener.subscription.unsubscribe();
      };
  }, []);

    // Push notifications registration
    useEffect(() => {
        if (user) {
            registerForPushNotifications(user.id);
        }
    }, [user]);

    // Message notifications
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
                    if (payload.new.chat_id) {
                        const { data: chat } = await supabase
                            .from('Chat')
                            .select('user1_id, user2_id')
                            .eq('id', payload.new.chat_id)
                            .single();

                        if (chat && 
                            (chat.user1_id === user.id || chat.user2_id === user.id) && 
                            payload.new.sender_id !== user.id && 
                            payload.new.chat_id !== currentChatId) {
                            
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

    // Notification tap handler
    useEffect(() => {
        if (!user) return;
        
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

    // Fetch likes when user changes
    useEffect(() => {
        if (user && user.id) {
            getLikes(user.id);
        }
    }, [user]);

    return (
        <AuthContext.Provider value={{ 
            user, 
            signIn, 
            signUp, 
            signOut, 
            likes, 
            getLikes, 
            setActiveChatId, 
            currentChatId,
            loading
        }}>
            {children}
        </AuthContext.Provider>
    );
};