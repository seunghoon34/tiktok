// context/NotificationContext.js
import { createContext, useContext, useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/utils/supabase';
import { useAuth } from './AuthProvider';

// Define the type for our context value
type NotificationContextType = {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
};

// Create context with default values
const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  setUnreadCount: () => {}, // Empty function as default
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  return (
    <NotificationContext.Provider value={{ unreadCount, setUnreadCount }}>
      <NotificationManager />
      {children}
    </NotificationContext.Provider>
  );
}

// Separate component to handle notification logic
function NotificationManager() {
  const { setUnreadCount } = useContext(NotificationContext);
  const { user } = useAuth();

  const fetchUnreadCount = async () => {
    if (!user) return;

    try {
      // First, get list of blocked users
      const { data: blockedUsers, error: blockError } = await supabase
        .from('UserBlock')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

      if (blockError) throw blockError;

      // Create array of user IDs to exclude
      const excludeUserIds = blockedUsers?.reduce((acc: string[], block) => {
        if (block.blocker_id === user.id) acc.push(block.blocked_id);
        if (block.blocked_id === user.id) acc.push(block.blocker_id);
        return acc;
      }, []);

      // Get unread notifications count excluding blocked users
      const { count, error } = await supabase
        .from('Notification')
        .select('*', { count: 'exact' })
        .eq('to_user', user.id)
        .eq('read', false)
        .not(excludeUserIds.length > 0 ? 'from_user' : 'id', 
             excludeUserIds.length > 0 ? 'in' : 'eq', 
             excludeUserIds.length > 0 ? `(${excludeUserIds.join(',')})` : user.id);

      if (error) throw error;

      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Initial fetch
    fetchUnreadCount();

    // Set up real-time subscription
    const subscription = supabase
      .channel('notifications_unread')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (insert, update, delete)
          schema: 'public',
          table: 'Notification',
          filter: `to_user=eq.${user.id}` // Only listen for notifications to this user
        },
        () => {
          // Refetch unread count whenever notifications change
          fetchUnreadCount();
        }
      )
      .subscribe();

    // Listen for app state changes to refetch when app becomes active
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        fetchUnreadCount();
      }
    });

    // Cleanup
    return () => {
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, [user]);

  return null; // This component only manages side effects
}

export const useNotifications = () => useContext(NotificationContext);