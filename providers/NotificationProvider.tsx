// context/NotificationContext.js
import { createContext, useContext, useState } from 'react';

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
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);