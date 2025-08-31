import { chatCache, CachedMessage } from './chatCache';
import { supabase } from './supabase';

export class EnhancedChatService {
  /**
   * Smart message loading: cache first, then sync with fresh data
   */
  static async loadMessagesWithSync(chatId: string, userId: string) {
    // 1. Load cached messages immediately for instant UI
    const cachedMessages = await chatCache.getChatMessages(chatId);
    const lastCachedTimestamp = cachedMessages.length > 0 
      ? cachedMessages[cachedMessages.length - 1].created_at 
      : null;

    console.log(`[ChatSync] Loaded ${cachedMessages.length} cached messages`);

    // 2. Fetch only messages newer than cache
    let freshQuery = supabase
      .from('Message')
      .select(`
        *,
        sender:sender_id (id, username),
        read,
        created_at
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(50);

    // If we have cached messages, only fetch newer ones
    if (lastCachedTimestamp) {
      freshQuery = freshQuery.gt('created_at', lastCachedTimestamp);
      console.log(`[ChatSync] Fetching messages newer than: ${lastCachedTimestamp}`);
    }

    const { data: newMessages } = await freshQuery;

    if (newMessages && newMessages.length > 0) {
      console.log(`[ChatSync] Found ${newMessages.length} new messages`);
      
      // 3. Merge cached + new messages
      const allMessages = [...cachedMessages, ...newMessages.reverse()];
      
      // 4. Update cache with complete message set
      await chatCache.setChatMessages(chatId, allMessages as CachedMessage[]);
      
      return {
        messages: allMessages,
        hasNewMessages: true,
        newMessageCount: newMessages.length
      };
    } else {
      console.log('[ChatSync] No new messages found');
      return {
        messages: cachedMessages,
        hasNewMessages: false,
        newMessageCount: 0
      };
    }
  }

  /**
   * Mark messages as read and sync with cache
   */
  static async markMessagesAsRead(chatId: string, userId: string) {
    // Update database
    await supabase
      .from('Message')
      .update({ read: true })
      .eq('chat_id', chatId)
      .neq('sender_id', userId);

    // Update cache
    await chatCache.markChatAsRead(chatId, userId);
    
    console.log(`[ChatSync] Marked messages as read for chat: ${chatId}`);
  }
}
