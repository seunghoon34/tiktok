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

    // Also check for read status updates on sent messages still marked unread in cache
    const unreadSentIds = cachedMessages
      .filter(m => m.sender_id === userId && !m.read)
      .map(m => m.id);

    const [{ data: newMessages }, readStatusResult] = await Promise.all([
      freshQuery,
      unreadSentIds.length > 0
        ? supabase
            .from('Message')
            .select('id')
            .in('id', unreadSentIds)
            .eq('read', true)
        : Promise.resolve({ data: null })
    ]);

    // Update read status on cached messages
    const readIds = new Set(readStatusResult?.data?.map((m: any) => m.id) || []);
    const updatedCachedMessages = readIds.size > 0
      ? cachedMessages.map(msg => readIds.has(msg.id) ? { ...msg, read: true } : msg)
      : cachedMessages;

    if (newMessages && newMessages.length > 0) {
      console.log(`[ChatSync] Found ${newMessages.length} new messages`);

      // 3. Merge cached + new messages
      const allMessages = [...updatedCachedMessages, ...newMessages.reverse()];

      // 4. Update cache with complete message set
      await chatCache.setChatMessages(chatId, allMessages as CachedMessage[]);

      return {
        messages: allMessages,
        hasNewMessages: true,
        newMessageCount: newMessages.length
      };
    } else {
      // Update cache if read statuses changed
      if (readIds.size > 0) {
        await chatCache.setChatMessages(chatId, updatedCachedMessages);
        console.log(`[ChatSync] Updated ${readIds.size} read receipts from cache`);
      }
      console.log('[ChatSync] No new messages found');
      return {
        messages: updatedCachedMessages,
        hasNewMessages: false,
        newMessageCount: 0
      };
    }
  }

  /**
   * Mark messages as read and sync with cache
   */
  static async markMessagesAsRead(chatId: string, userId: string) {
    try {
      // Update database - only update messages that are actually unread
      const { data, error } = await supabase
        .from('Message')
        .update({ read: true })
        .eq('chat_id', chatId)
        .eq('read', false)
        .neq('sender_id', userId)
        .select();

      if (error) {
        console.error(`[ChatSync] Error marking messages as read:`, error);
        return;
      }

      console.log(`[ChatSync] Marked ${data?.length || 0} messages as read in database for chat: ${chatId}`);

      // Update cache
      await chatCache.markChatAsRead(chatId, userId);
      
      console.log(`[ChatSync] Marked messages as read for chat: ${chatId}`);
    } catch (err) {
      console.error(`[ChatSync] Exception marking messages as read:`, err);
    }
  }
}
