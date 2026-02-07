-- This trigger calls a Supabase Edge Function to send notifications
-- Edge Functions can make HTTP requests to Expo's push API

CREATE OR REPLACE FUNCTION notify_message_webhook()
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
  
  -- Only proceed if receiver has a push token
  IF receiver_token IS NOT NULL THEN
    -- Call Supabase Edge Function to send notification
    -- You'll need to create this Edge Function separately
    PERFORM
      net.http_post(
        url := current_setting('app.settings.edge_function_url') || '/send-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object(
          'type', 'message',
          'receiverId', receiver_id,
          'receiverToken', receiver_token,
          'senderId', NEW.sender_id,
          'senderUsername', sender_username,
          'chatId', NEW.chat_id,
          'messageContent', NEW.content
        )
      );
    
    RAISE LOG 'Notification webhook called for message % to user %', NEW.id, receiver_id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the message insert
    RAISE WARNING 'Failed to send notification webhook: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to fire after message insert
DROP TRIGGER IF EXISTS on_message_inserted_webhook ON "Message";
CREATE TRIGGER on_message_inserted_webhook
  AFTER INSERT ON "Message"
  FOR EACH ROW
  EXECUTE FUNCTION notify_message_webhook();
