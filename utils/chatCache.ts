import { cache, CacheService } from './cache';

export interface CachedMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
  sender: {
    id: string;
    username: string;
  };
}

export interface CachedChat {
  chat_id: string;
  messages: CachedMessage[];
  last_updated: number;
  message_count: number;
}

export class ChatCacheService {
  private static instance: ChatCacheService;
  
  public static getInstance(): ChatCacheService {
    if (!ChatCacheService.instance) {
      ChatCacheService.instance = new ChatCacheService();
    }
    return ChatCacheService.instance;
  }

  private constructor() {}

  private getChatKey(chatId: string): string {
    return `${CacheService.KEYS.CHAT_HISTORY}:${chatId}`;
  }

  /**
   * Get cached messages for a chat
   */
  async getChatMessages(chatId: string): Promise<CachedMessage[]> {
    try {
      const cacheKey = this.getChatKey(chatId);
      const cachedChat = await cache.get<CachedChat>(cacheKey);
      
      if (cachedChat) {
        console.log(`[ChatCache] Loaded ${cachedChat.messages.length} cached messages for chat: ${chatId}`);
        return cachedChat.messages;
      }
      
      console.log(`[ChatCache] No cached messages found for chat: ${chatId}`);
      return [];
    } catch (error) {
      console.error(`[ChatCache] Error getting messages for chat ${chatId}:`, error);
      return [];
    }
  }

  /**
   * Cache messages for a chat (replaces existing cache)
   */
  async setChatMessages(chatId: string, messages: CachedMessage[]): Promise<void> {
    try {
      const cacheKey = this.getChatKey(chatId);
      const cachedChat: CachedChat = {
        chat_id: chatId,
        messages: messages.slice(-100), // Keep only last 100 messages
        last_updated: Date.now(),
        message_count: messages.length
      };
      
      // Chat history never expires (TTL = 0)
      await cache.set(cacheKey, cachedChat, CacheService.TTL.CHAT_HISTORY);
      console.log(`[ChatCache] Cached ${cachedChat.messages.length} messages for chat: ${chatId}`);
    } catch (error) {
      console.error(`[ChatCache] Error caching messages for chat ${chatId}:`, error);
    }
  }

  /**
   * Add a new message to existing cache
   */
  async addMessage(chatId: string, message: CachedMessage): Promise<void> {
    try {
      const existingMessages = await this.getChatMessages(chatId);
      const updatedMessages = [...existingMessages, message];
      await this.setChatMessages(chatId, updatedMessages);
      console.log(`[ChatCache] Added new message to chat: ${chatId}`);
    } catch (error) {
      console.error(`[ChatCache] Error adding message to chat ${chatId}:`, error);
    }
  }

  /**
   * Update a specific message in cache (useful for read status updates)
   */
  async updateMessage(chatId: string, messageId: string, updates: Partial<CachedMessage>): Promise<void> {
    try {
      const existingMessages = await this.getChatMessages(chatId);
      const updatedMessages = existingMessages.map(msg => 
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
      
      await this.setChatMessages(chatId, updatedMessages);
      console.log(`[ChatCache] Updated message ${messageId} in chat: ${chatId}`);
    } catch (error) {
      console.error(`[ChatCache] Error updating message in chat ${chatId}:`, error);
    }
  }

  /**
   * Mark all messages in a chat as read
   */
  async markChatAsRead(chatId: string, currentUserId: string): Promise<void> {
    try {
      const existingMessages = await this.getChatMessages(chatId);
      const updatedMessages = existingMessages.map(msg => 
        msg.sender_id !== currentUserId ? { ...msg, read: true } : msg
      );
      
      await this.setChatMessages(chatId, updatedMessages);
      console.log(`[ChatCache] Marked all messages as read in chat: ${chatId}`);
    } catch (error) {
      console.error(`[ChatCache] Error marking chat as read ${chatId}:`, error);
    }
  }

  /**
   * Get cache stats for debugging
   */
  async getStats(): Promise<{
    cachedChats: number;
    totalMessages: number;
    totalCacheSize: number;
  }> {
    try {
      const allStats = await cache.getStats();
      
      // Get detailed chat cache info
      let totalMessages = 0;
      const chatEntries = allStats.entriesByType.chat_history || 0;
      
      // This is an approximation since we'd need to read each cache entry to get exact counts
      // For now, estimate based on average messages per chat
      totalMessages = chatEntries * 50; // Rough estimate
      
      return {
        cachedChats: chatEntries,
        totalMessages,
        totalCacheSize: allStats.totalSize
      };
    } catch (error) {
      console.error('[ChatCache] Error getting stats:', error);
      return { cachedChats: 0, totalMessages: 0, totalCacheSize: 0 };
    }
  }

  /**
   * Clear cache for a specific chat
   */
  async clearChat(chatId: string): Promise<void> {
    try {
      const cacheKey = this.getChatKey(chatId);
      await cache.delete(cacheKey);
      console.log(`[ChatCache] Cleared cache for chat: ${chatId}`);
    } catch (error) {
      console.error(`[ChatCache] Error clearing chat ${chatId}:`, error);
    }
  }

  /**
   * Clear all chat caches
   */
  async clearAllChats(): Promise<void> {
    try {
      // Get all cache keys and filter for chat history
      const allStats = await cache.getStats();
      console.log(`[ChatCache] Clearing all chat caches...`);
      
      // For now, just clear the entire cache
      // In the future, we could be more selective
      await cache.clearAll();
      console.log('[ChatCache] Cleared all chat caches');
    } catch (error) {
      console.error('[ChatCache] Error clearing all chats:', error);
    }
  }
}

// Export singleton instance
export const chatCache = ChatCacheService.getInstance();
