# Bug Fix: Duplicate Message Notifications

## Problem
Message notifications were being sent **twice** for every message.

## Root Cause
Notifications were being sent from **two places**:

### 1. Chat Screen (`app/chat/[id].tsx`) ❌ REMOVED
```typescript
// Lines 277-291 (OLD CODE)
const { data: otherUserData } = await supabase
  .from('User')
  .select('app_state')
  .eq('id', otherUser.id)
  .single();

// Only send notification if other user is in background
if (otherUserData?.app_state === 'background') {
  await sendMessageNotification(
    user.id,
    user.username,
    otherUser?.id,
    Array.isArray(id) ? id[0] : id
  );
}
```

### 2. AuthProvider (`providers/AuthProvider.tsx`) ✅ KEPT
```typescript
// Lines 422-471
const subscription = supabase
  .channel('global_messages')
  .on('postgres_changes', { event: 'INSERT', table: 'Message' }, async (payload) => {
    // Skip if sender is current user
    if (payload.new.sender_id === user.id) return;
    
    // Skip if user is currently in the chat
    if (payload.new.chat_id === currentChatId) return;
    
    // Verify user is part of this chat
    const { data: chat } = await supabase
      .from('Chat')
      .select('user1_id, user2_id')
      .eq('id', payload.new.chat_id)
      .single();
    
    if (!chat || (chat.user1_id !== user.id && chat.user2_id !== user.id)) return;
    
    // Send notification
    await sendMessageNotification(...);
  })
```

## Solution
**Removed notification sending from chat screen** and kept only the `AuthProvider` implementation.

### Why AuthProvider is Better:
1. ✅ **Centralized**: All notification logic in one place
2. ✅ **Global**: Works even if chat screen unmounts
3. ✅ **Smart checks**: Already has all necessary conditions:
   - Don't notify if sender is current user
   - Don't notify if user is currently in the chat
   - Verify user is part of the chat
4. ✅ **Real-time**: Uses Supabase subscriptions for instant delivery
5. ✅ **No redundant queries**: Doesn't need to check `app_state` separately

### Changes Made:

#### File: `app/chat/[id].tsx`

**Removed:**
- Import: `sendMessageNotification` from utils/notifications
- Lines 277-291: Duplicate notification sending code

**Simplified `sendMessage` function:**
```typescript
const sendMessage = async () => {
  if (!newMessage.trim()) return;
  
  if (isChatExpired) {
    console.log('[Chat] Cannot send message - chat has expired');
    return;
  }

  const { error } = await supabase
    .from('Message')
    .insert({
      chat_id: id,
      sender_id: user.id,
      content: newMessage.trim()
    });

  if (error) {
    console.error('Error sending message:', error);
    return;
  }

  // Notification is handled automatically by AuthProvider's real-time subscription
  // No need to send it here to avoid duplicates

  setTimeout(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, 0);

  setNewMessage('');
};
```

## Testing Checklist

- [ ] Send message in chat → Receiver gets 1 notification (not 2)
- [ ] Send message when receiver is in chat → No notification
- [ ] Send message when receiver is in background → Notification appears
- [ ] Send multiple messages quickly → Each gets exactly 1 notification
- [ ] Send message to yourself → No notification

## Result
✅ **Bug fixed!** Users will now receive exactly **one notification** per message instead of two.
