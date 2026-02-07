-- Database function to send push notifications when a message is inserted
-- This runs server-side, so it works even when the receiver's app is closed!

CREATE OR REPLACE FUNCTION send_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  receiver_id UUID;
  sender_username TEXT;
  receiver_token TEXT;
  chat_user1 UUID;
  chat_user2 UUID;
BEGIN
  -- Get chat participants
  SELECT user1_id, user2_id INTO chat_user1, chat_user2
  FROM "Chat"
  WHERE id = NEW.chat_id;
  
  -- Determine receiver (the one who didn't send the message)
  IF NEW.sender_id = chat_user1 THEN
    receiver_id := chat_user2;
  ELSE
    receiver_id := chat_user1;
  END IF;
  
  -- Get sender's username and receiver's push token
  SELECT username INTO sender_username
  FROM "User"
  WHERE id = NEW.sender_id;
  
  SELECT expo_push_token INTO receiver_token
  FROM "User"
  WHERE id = receiver_id;
  
  -- Only send notification if receiver has a push token
  IF receiver_token IS NOT NULL THEN
    -- Use Supabase Edge Functions or pg_net to send HTTP request to Expo
    -- For now, we'll use a simple approach with http extension
    
    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      body := json_build_object(
        'to', receiver_token,
        'sound', 'default',
        'title', 'New Message! 💬',
        'body', 'New message from ' || sender_username,
        'data', json_build_object(
          'type', 'message',
          'senderId', NEW.sender_id,
          'senderName', sender_username,
          'chatId', NEW.chat_id
        ),
        'priority', 'high',
        'channelId', 'default',
        '_displayInForeground', true,
        'badge', 1
      )::jsonb
    );
    
    RAISE LOG 'Notification sent to user % for message %', receiver_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to fire after message insert
DROP TRIGGER IF EXISTS on_message_inserted ON "Message";
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON "Message"
  FOR EACH ROW
  EXECUTE FUNCTION send_message_notification();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION send_message_notification() TO authenticated;
GRANT EXECUTE ON FUNCTION send_message_notification() TO service_role;
