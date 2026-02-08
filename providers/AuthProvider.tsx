import { registerForPushNotifications, sendMatchNotifications, sendMessageNotification } from '@/utils/notifications';
import { supabase } from '@/utils/supabase'
import { useRouter } from 'expo-router';
import { createContext, useContext, useEffect, useState, useRef} from 'react'
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { AppState } from 'react-native';
import { requestLocationPermission } from '@/utils/location';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// Complete the WebBrowser auth session when done
WebBrowser.maybeCompleteAuthSession();

export const AuthContext = createContext({
    user: null as any,
    signIn: async (email: string, password: string) =>{},
    signUp: async (email: string, password: string) =>{},
    signInWithGoogle: async () =>{},
    signOut: async () =>{},
    deleteAccount: async () =>{},
    likes: [] as any[],
    getLikes: async (userId: string, immediateUpdate?: any[]) => {},
    setActiveChatId: (chatId: string | null) => {},
    currentChatId: null as string | null,
    loading: true,
    refreshUserData: async () => {},
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
    const [isCreatingProfile, setIsCreatingProfile] = useState(false);

    // Use ref to track manual auth operations to prevent race conditions with auth state listener
    const isManualAuthRef = useRef(false);

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

    const getUser = async (id: string, skipProfileCheck: boolean = false) => {
        try {
            console.log('[getUser] ***** CALLED WITH ID:', id, 'skipProfileCheck:', skipProfileCheck, '*****');
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
                    // Auto-provision a row for new OAuth users
                    console.log('[getUser] User not found in database, auto-provisioning...');
                    const { data: authUserResult } = await supabase.auth.getUser();
                    const tempUsername = `user_${Date.now()}`;
                    const emailForInsert = authUserResult?.user?.email ?? '';

                    console.log('[getUser] Attempting to create User record with:', { id, email: emailForInsert, username: tempUsername });

                    const { data: insertedUser, error: provisionError } = await supabase
                        .from('User')
                        .insert({ id, email: emailForInsert, username: tempUsername })
                        .select()
                        .single();

                    if (provisionError) {
                        console.error('[getUser] PROVISION ERROR:', provisionError);
                        throw new Error(`Failed to create user account: ${provisionError.message}`);
                    }

                    console.log('[getUser] User record created successfully:', insertedUser);

                    await setUser(insertedUser);
                    await getLikes(insertedUser.id);
                } else {
                    await setUser(retryResult.data[0]);
                    await getLikes(retryResult.data[0].id);
                }
            } else {
                await setUser(data[0]);
                await getLikes(data[0].id);
            }

            // Skip profile check if explicitly requested (e.g., during profile creation)
            if (skipProfileCheck) {
                console.log('[getUser] Skipping profile check as requested');
                return;
            }

            const { data: profileData } = await supabase
                .from('UserProfile')
                .select('*')
                .eq('user_id', id)
                .single();

            console.log('[getUser] Profile data:', !!profileData);
            if (!profileData) {
                console.log('[getUser] ***** NO PROFILE FOUND, REDIRECTING TO CREATEPROFILE *****');
                setIsCreatingProfile(true);
                router.replace('/createprofile');
            } else {
                console.log('[getUser] Profile found, redirecting to profile tab');
                setIsCreatingProfile(false);
                
                // Request location permission after successful login
                console.log('[getUser] Requesting location permission...');
                const locationGranted = await requestLocationPermission();
                if (!locationGranted) {
                    console.log('[getUser] Location permission denied');
                    // User will see location permission screen in feed
                }
                
                router.replace('/(tabs)/profile');
            }
        } catch (error: any) {
            console.error('[getUser] ERROR:', error);
            console.error('[getUser] Error details:', error.message, error.code);

            // If this is a provision error (user creation failed), don't redirect to auth
            // The authentication already succeeded - just show the error
            if (error.message?.includes('Failed to create user account')) {
                console.error('[getUser] User provisioning failed - auth succeeded but database user creation failed');
                console.error('[getUser] This usually means a database constraint issue or RLS policy blocking the insert');
                // Set processing flag to false so UI updates
                setIsProcessingAuth(false);
                // Stay on current screen and let the error bubble up to be shown to the user
                throw error;
            }

            // For other errors, redirect to sign-in
            console.log('[getUser] Redirecting to auth screen due to error');
            setIsProcessingAuth(false);
            router.replace('/(auth)');
        }
    };

    const refreshUserData = async () => {
        try {
            if (!user?.id) {
                console.log('[refreshUserData] No user ID available');
                return;
            }
            
            console.log('[refreshUserData] Refreshing user data for:', user.id);
            const { data, error } = await supabase
                .from("User")
                .select("*")
                .eq("id", user.id)
                .single();
            
            if (error) {
                console.error('[refreshUserData] Error fetching updated user data:', error);
                return;
            }
            
            if (data) {
                console.log('[refreshUserData] Updated user data received, updating state');
                setUser(data);
            }
        } catch (error) {
            console.error('[refreshUserData] Exception refreshing user data:', error);
        }
    };

    const signIn = async (email: string, password: string) => {
        try {
            setIsProcessingAuth(true);
            isManualAuthRef.current = true; // Mark as manual auth to prevent listener interference
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
            isManualAuthRef.current = false;
        }
    };

    const signUp = async (email: string, password: string) => {
        try {
            setIsProcessingAuth(true);
            isManualAuthRef.current = true; // Mark as manual auth to prevent listener interference
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
            isManualAuthRef.current = false;
        }
    };

    const signInWithGoogle = async () => {
        try {
            setIsProcessingAuth(true);
            isManualAuthRef.current = true; // Mark as manual auth to prevent listener interference

            // Create the redirect URL for the OAuth callback
            const redirectUrl = Linking.createURL('/');
            console.log('[signInWithGoogle] Redirect URL:', redirectUrl);

            // Get the OAuth URL from Supabase
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true, // Don't auto-redirect, we'll use WebBrowser
                }
            });

            if (error) throw error;

            console.log('[signInWithGoogle] OAuth URL:', data.url);

            // Open the OAuth URL in a browser
            const result = await WebBrowser.openAuthSessionAsync(
                data.url,
                redirectUrl
            );

            console.log('[signInWithGoogle] WebBrowser result:', result);

            if (result.type === 'success') {
                // Extract the URL from the result
                const { url } = result;

                // Parse the URL to extract tokens
                const hashParams = new URLSearchParams(url.split('#')[1]);
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');

                if (accessToken && refreshToken) {
                    // Set the session with the tokens
                    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });

                    if (sessionError) throw sessionError;

                    console.log('[signInWithGoogle] Session created successfully');

                    // Set session and get user
                    if (sessionData?.session) {
                        setSession(sessionData.session);
                        // Directly get user instead of relying on auth state listener
                        await getUser(sessionData.session.user.id);
                    }

                    console.log('[signInWithGoogle] Auth processing completed successfully');
                } else {
                    throw new Error('No tokens found in callback URL');
                }
            } else {
                // User cancelled or something went wrong
                console.log('[signInWithGoogle] Auth cancelled or failed:', result.type);
                setIsProcessingAuth(false);
                isManualAuthRef.current = false;
            }

        } catch (error) {
            console.error('Google sign in error:', error);
            setIsProcessingAuth(false);
            isManualAuthRef.current = false;
            throw error;
        } finally {
            setIsProcessingAuth(false);
            isManualAuthRef.current = false;
        }
    };

    const signOut = async () => {
      // Always clear local state, let auth state change listener handle redirect
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

          // Sign out - this will trigger the auth state change listener
          // which will handle clearing state and redirecting
          try {
              await supabase.auth.signOut();
          } catch (e) {
              // Ignore auth errors during signout
              console.log('Auth signout error (expected if session invalid):', e);
              // If signout fails, manually clear state and redirect
              setUser(null);
              setSession(null);
              setLikes([]);
              setCurrentChatId(null);
              router.replace('/(auth)');
          }
      } catch (error) {
          console.error('Unexpected error during signout:', error);
          // Fallback: clear state and redirect
          setUser(null);
          setSession(null);
          setLikes([]);
          setCurrentChatId(null);
          router.replace('/(auth)');
      }
  };

  const deleteAccount = async () => {
    try {
        if (!user?.id) return;

        // Try to delete using the database function first (deletes both User table and auth.users)
        const { error: rpcError } = await supabase.rpc('delete_user');

        if (rpcError) {
            // If the function doesn't exist, fall back to manual deletion
            console.warn('delete_user function not found, using fallback method:', rpcError);

            // Delete from User table (cascades to all related data)
            const { error: deleteError } = await supabase
                .from('User')
                .delete()
                .eq('id', user.id);

            if (deleteError) throw deleteError;

            // Note: This won't delete the auth user without the database function
            // You MUST apply the delete_user_function.sql migration to fully delete auth users
            console.error('WARNING: Auth user not deleted. Apply migrations/delete_user_function.sql to fix this.');
        }

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
              router.replace('/(auth)');
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
          router.replace('/(auth)');
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

      // Handle deep links for OAuth callback
      const handleDeepLink = async (event: { url: string }) => {
          console.log('[OAuth] Deep link received:', event.url);

          // Check if this is an OAuth callback
          if (event.url.includes('#access_token') || event.url.includes('?access_token')) {
              console.log('[OAuth] Processing OAuth callback');

              // Supabase will automatically handle the session creation
              // through the auth state change listener
              const { data, error } = await supabase.auth.getSession();

              if (error) {
                  console.error('[OAuth] Error getting session from callback:', error);
                  setIsProcessingAuth(false);
              } else if (data.session) {
                  console.log('[OAuth] Session created successfully');
                  // The SIGNED_IN event will be triggered automatically
              }
          }
      };

      // Listen for deep link events (when app is already open)
      const linkingSubscription = Linking.addEventListener('url', handleDeepLink);

      // Check if app was opened via deep link (when app was closed)
      Linking.getInitialURL().then((url) => {
          if (url) {
              console.log('[OAuth] App opened with URL:', url);
              handleDeepLink({ url });
          }
      });

      const handleAuthStateChange = async (event: string, newSession: any) => {
          console.log('***** AUTH STATE CHANGED:', event, 'isProcessingAuth:', isProcessingAuth, 'user exists:', !!user, '*****');

          try {
              switch (event) {
                  case 'SIGNED_OUT':
                  case 'USER_DELETED':
                      setUser(null);
                      setSession(null);
                      router.replace('/(auth)');
                      break;

                  case 'SIGNED_IN':
                      // Skip if this is a manual auth operation (signIn, signUp, signInWithGoogle)
                      // to prevent duplicate getUser calls and race conditions
                      if (isManualAuthRef.current) {
                          console.log('***** SKIPPING SIGNED_IN EVENT - manual auth in progress *****');
                          break;
                      }

                      // Don't process if we're already creating a profile or have a user
                      if (newSession && !user && !isCreatingProfile) {
                          console.log('***** PROCESSING SIGNED_IN EVENT, CALLING GETUSER *****');
                          console.log('[Auth] isProcessingAuth:', isProcessingAuth, 'will be cleared after getUser completes');
                          setSession(newSession);
                          await getUser(newSession.user.id);
                          setIsProcessingAuth(false); // Clear processing state after getUser completes
                      } else {
                          console.log('***** SKIPPING SIGNED_IN EVENT - user exists:', !!user, 'isCreatingProfile:', isCreatingProfile, '*****');
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
                          router.replace('/(auth)');
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
              setIsProcessingAuth(false);
              router.replace('/(auth)');
          }
      };

      const { data: authListener } = supabase.auth.onAuthStateChange(handleAuthStateChange);

      return () => {
          authListener.subscription.unsubscribe();
          linkingSubscription.remove();
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
                } else if (data.type === 'shot') {
                    router.push('/feed');
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
            signInWithGoogle,
            signOut,
            deleteAccount,
            likes,
            getLikes,
            setActiveChatId,
            currentChatId,
            loading,
            refreshUserData
        }}>
            {children}
        </AuthContext.Provider>
    );
};