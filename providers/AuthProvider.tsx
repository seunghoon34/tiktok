import { registerForPushNotifications, sendMatchNotifications, sendMessageNotification } from '@/utils/notifications';
import { supabase } from '@/utils/supabase'
import { useRouter } from 'expo-router';
import { createContext, useContext, useEffect, useState} from 'react'
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { AppState } from 'react-native';

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
      // Always clear local state and redirect, regardless of auth session status
      try {
          // Try to update app state if we have a user
          if (user?.id) {
              try {
                  await supabase
                      .from('User')
                      .update({ app_state: 'background' })
                      .eq('id', user.id);
              } catch (e) {
                  // Ignore errors here as the session might already be invalid
                  console.log('Error updating app state during signout:', e);
              }
          }
  
          // Try to sign out, but don't wait for it or let it block the process
          try {
              await supabase.auth.signOut();
          } catch (e) {
              // Ignore auth errors during signout
              console.log('Auth signout error (expected if session invalid):', e);
          }
  
      } finally {
          // Always clear local state and redirect
          setUser(null);
          setSession(null);
          setLikes([]);
          setCurrentChatId(null);
          router.push('/(auth)');
      }
  };

    const setActiveChatId = (chatId: string | null) => {
        setCurrentChatId(chatId);
    };

    const initializeAuth = async () => {
      try {
          await SplashScreen.preventAutoHideAsync();
          const { data: { session: currentSession }, error } = await supabase.auth.getSession();
          
          if (error) {
              throw error;
          }
          
          if (currentSession) {
              setSession(currentSession);
              await getUser(currentSession.user.id);
          } else {
              // Clear states and redirect to auth
              setUser(null);
              setSession(null);
              router.push('/(auth)');
          }
      } catch (error) {
          console.error('Error initializing auth:', error);
          // Handle the auth session missing error
          if (error.message?.includes('Auth session missing')) {
              setUser(null);
              setSession(null);
              router.push('/(auth)');
          }
      } finally {
          setLoading(false);
          try {
              await SplashScreen.hideAsync();
          } catch (error) {
              console.error('Error hiding splash screen:', error);
          }
      }
  };
  
  // Modify the auth state change listener
  useEffect(() => {
    initializeAuth();
      const handleAuthStateChange = async (event, newSession) => {
          console.log('Auth state changed:', event);
          
          try {
              switch (event) {
                  case 'SIGNED_OUT':
                  case 'USER_DELETED':
                      setUser(null);
                      setSession(null);
                      router.push('/(auth)');
                      break;
                      
                  case 'SIGNED_IN':
                      if (newSession) {
                          setSession(newSession);
                          await getUser(newSession.user.id);
                      }
                      break;
                      
                  case 'TOKEN_REFRESHED':
                      if (newSession) {
                          setSession(newSession);
                      }
                      break;
                      
                  case 'INITIAL_SESSION':
                      if (!newSession) {
                          setUser(null);
                          setSession(null);
                          router.push('/(auth)');
                      }
                      break;
              }
          } catch (error: any) {
              console.error('Error handling auth state change:', error);
              if (error.message?.includes('Auth session missing')) {
                  setUser(null);
                  setSession(null);
                  router.push('/(auth)');
              }
          }
      };
  
      const { data: authListener } = supabase.auth.onAuthStateChange(handleAuthStateChange);
  
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

    useEffect(() => {
      if (!user) return;

      let becameActiveTime: string | null = null;

    const handleAppStateChange = (nextAppState: string) => {
        if (nextAppState === 'active') {
            becameActiveTime = new Date().toISOString();
        }
    };


    // Set initial active time
    becameActiveTime = new Date().toISOString();

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);


  
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

                if (becameActiveTime && payload.new.created_at <= becameActiveTime) {
                  return; // Skip old messages
              }
                  // First check if the message is for the current user and they're not the sender
                  if (payload.new.sender_id === user.id) {
                      return; // Don't notify for messages the user sent
                  }
  
                  // Check if user is currently in the chat
                  if (payload.new.chat_id === currentChatId) {
                      return; // Don't notify if user is in the chat
                  }
  
                  const { data: chat } = await supabase
                      .from('Chat')
                      .select('user1_id, user2_id')
                      .eq('id', payload.new.chat_id)
                      .single();
  
                  // Check if user is part of this chat
                  if (!chat || (chat.user1_id !== user.id && chat.user2_id !== user.id)) {
                      return; // Don't notify if user is not part of the chat
                  }
  
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
          )
          .subscribe();
  
      return () => {
          subscription.unsubscribe();
          appStateSubscription.remove();
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

    useEffect(() => {
      if (!user) return;
    
      const updateAppState = async (state: string) => {
        try {
          const { error } = await supabase
            .from('User')
            .update({ app_state: state })
            .eq('id', user.id);
    
          if (error) {
            console.error('Error updating app_state:', error);
          } else {
            console.log('App state updated successfully to:', state);
          }
        } catch (error) {
          console.error('Exception updating app_state:', error);
        }
      };
    
      // Set initial state
      updateAppState('active');
    
      const subscription = AppState.addEventListener('change', async (nextAppState) => {
        console.log('AppState changed to:', nextAppState);
        const newState = nextAppState === 'active' ? 'active' : 'background';
        await updateAppState(newState);
      });
    
      return () => {
        // Cleanup
        updateAppState('background');
        subscription.remove();
      };
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