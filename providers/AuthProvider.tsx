import { registerForPushNotifications, sendMatchNotifications, sendMessageNotification } from '@/utils/notifications';
import { supabase } from '@/utils/supabase'
import { useRouter } from 'expo-router';
import { createContext, useContext, useEffect, useState} from 'react'
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { AppState } from 'react-native';

export const AuthContext = createContext({
    user: null as any,
    signIn: async (email: string, password: string) =>{},
    signUp: async (email: string, password: string) =>{},
    signOut: async () =>{},
    deleteAccount: async () =>{},
    likes: [] as any[],
    getLikes: async (userId: string) => {},
    setActiveChatId: (chatId: string | null) => {},
    currentChatId: null as string | null,
    loading: true,  // Add this
});

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }:{children: React.ReactNode}) => {
    const [user, setUser] = useState<any>(null);
    const router = useRouter()
    const [likes, setLikes] = useState<any[]>([])
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);   
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isProcessingAuth, setIsProcessingAuth] = useState(false);

    const getLikes = async (userId: string, immediateUpdate?: any[]) => {
        if(!user) return;
        
        if (immediateUpdate) {
            setLikes((prevLikes: any[]) => [...prevLikes, ...immediateUpdate]);
            return;
        }
        
        const { data, error } = await supabase.from('Like').select("*").eq('user_id', userId);
        if (error) return;
        
        setLikes((data as any[]) || []);
    }

    const getUser = async (id: string) => {
        try {
            console.log('[getUser] ***** CALLED WITH ID:', id, '*****');
            console.log('[getUser] Stack trace:', new Error().stack);
            const { data, error } = await supabase
                .from("User")
                .select("*")
                .eq("id", id);
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                // Brief delay in case of eventual consistency
                await new Promise(resolve => setTimeout(resolve, 2000));
                const retryResult = await supabase
                    .from("User")
                    .select("*")
                    .eq("id", id);
                
                if (retryResult.error || !retryResult.data || retryResult.data.length === 0) {
                    // Auto-provision a row for migrated users who have an auth user but no public.User row yet
                    const { data: authUserResult } = await supabase.auth.getUser();
                    const tempUsername = `user_${Date.now()}`;
                    const emailForInsert = authUserResult?.user?.email ?? '';

                    const { error: provisionError } = await supabase
                        .from('User')
                        .insert({ id, email: emailForInsert, username: tempUsername });

                    if (provisionError) {
                        throw new Error('User not found after retry');
                    }

                    // Fetch the newly provisioned row
                    const { data: createdUser } = await supabase
                        .from('User')
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (!createdUser) {
                        throw new Error('User not found after retry');
                    }

                    await setUser(createdUser);
                    await getLikes(createdUser.id);
                } else {
                    await setUser(retryResult.data[0]);
                    await getLikes(retryResult.data[0].id);
                }
            } else {
                await setUser(data[0]);
                await getLikes(data[0].id);
            }

            const { data: profileData } = await supabase
                .from('UserProfile')
                .select('*')
                .eq('user_id', id)
                .single();

            console.log('[getUser] Profile data:', !!profileData);
            if (!profileData) {
                console.log('[getUser] ***** NO PROFILE FOUND, REDIRECTING TO CREATEPROFILE *****');
                router.push('/createprofile');
            } else {
                console.log('[getUser] Profile found, redirecting to profile tab');
                router.push('/(tabs)/profile');
            }
        } catch (error) {
            console.error('Error in getUser:', error);
            // On technical errors, redirect to sign-in instead of createprofile
            router.push('/(auth)');
        }
    };

    const signIn = async (email: string, password: string) => {
        try {
            setIsProcessingAuth(true);
            const { data, error } = await supabase.auth.signInWithPassword({ 
                email, 
                password 
            });
            
            if (error) throw error;
            
            if (data.session) {
                setSession(data.session);
                await getUser(data.user.id);
            }
        } catch (error: unknown) {
            console.error('Sign in error:', error);
            throw error;
        } finally {
            setIsProcessingAuth(false);
        }
    };

    const signUp = async (email: string, password: string) => {
        try {
            setIsProcessingAuth(true);
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
                .upsert(
                    {
                        id: authData.user.id,
                        email: email,
                        username: tempUsername,
                    },
                    { onConflict: 'id' }
                )
                .select()
                .single();
            
            if (userError) throw userError;

            await new Promise(resolve => setTimeout(resolve, 2000));
            await getUser(authData.user.id);
            
        } catch (error) {
            console.error('Sign up error:', error);
            throw error;
        } finally {
            setIsProcessingAuth(false);
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

  const deleteAccount = async () => {
    try {
        if (!user?.id) return;
        
        // Delete user (cascades to all related data)
        await supabase.from('User').delete().eq('id', user.id);
        
        // Delete auth user
        const { error } = await supabase.rpc('delete_user');
        if (error) throw error;
        
    } catch (error) {
        console.error('Delete account error:', error);
        throw error;

    }finally{
        await signOut();

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
      } catch (error: any) {
          // Check if it's a refresh token error (expected when session expired)
          if (error?.message?.includes('Invalid Refresh Token') || error?.message?.includes('Refresh Token Not Found')) {
              console.log('Session expired, redirecting to login');
          } else {
              console.error('Error initializing auth:', error);
          }
          
          // Handle auth errors by clearing session and redirecting
          setUser(null);
          setSession(null);
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
  
  // Modify the auth state change listener
  useEffect(() => {
    initializeAuth();
      const handleAuthStateChange = async (event: string, newSession: any) => {
          console.log('***** AUTH STATE CHANGED:', event, 'isProcessingAuth:', isProcessingAuth, 'user exists:', !!user, '*****');
          
          try {
              switch (event) {
                  case 'SIGNED_OUT':
                  case 'USER_DELETED':
                      setUser(null);
                      setSession(null);
                      router.push('/(auth)');
                      break;
                      
                  case 'SIGNED_IN':
                      if (newSession && !isProcessingAuth && !user) {
                          console.log('***** PROCESSING SIGNED_IN EVENT, CALLING GETUSER *****');
                          setSession(newSession);
                          await getUser(newSession.user.id);
                      } else {
                          console.log('***** SKIPPING SIGNED_IN EVENT - isProcessingAuth:', isProcessingAuth, 'user exists:', !!user, '*****');
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
              // Check if it's a refresh token error (expected when session expired)
              if (error?.message?.includes('Invalid Refresh Token') || error?.message?.includes('Refresh Token Not Found')) {
                  console.log('Session expired during auth state change, redirecting to login');
              } else {
                  console.error('Error handling auth state change:', error);
              }
              
              // Handle auth errors by clearing session and redirecting
              setUser(null);
              setSession(null);
              router.push('/(auth)');
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
                       senderData?.username ?? '',
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
            deleteAccount, 
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