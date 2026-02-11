-- Database function to send push notifications when a message is inserted
-- This runs server-side, so it works even when the receiver's app is closed!

CREATE OR REPLACE FUNCTION send_message_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_receiver_id TEXT;
  v_sender_username TEXT;
  v_receiver_token TEXT;
  v_chat_user1 TEXT;
  v_chat_user2 TEXT;
  v_message_preview TEXT;
BEGIN
  -- Get chat participants
  SELECT user1_id, user2_id INTO v_chat_user1, v_chat_user2
  FROM "Chat"
  WHERE id = NEW.chat_id;

  -- Determine receiver (the one who didn't send the message)
  IF NEW.sender_id = v_chat_user1 THEN
    v_receiver_id := v_chat_user2;
  ELSE
    v_receiver_id := v_chat_user1;
  END IF;

  -- Get sender's username
  SELECT username INTO v_sender_username
  FROM "User"
  WHERE id = NEW.sender_id;

  -- Get receiver's push token
  SELECT expo_push_token INTO v_receiver_token
  FROM "User"
  WHERE id = v_receiver_id;

  -- Build message preview (first 30 chars)
  v_message_preview := LEFT(NEW.content, 30);
  IF LENGTH(NEW.content) > 30 THEN
    v_message_preview := v_message_preview || '...';
  END IF;

  -- Only send if receiver has a push token
  IF v_receiver_token IS NOT NULL AND v_receiver_token != '' THEN
    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      body := json_build_object(
        'to', v_receiver_token,
        'sound', 'default',
        'title', COALESCE(v_sender_username, 'New Message'),
        'body', v_message_preview,
        'data', json_build_object(
          'type', 'message',
          'senderId', NEW.sender_id,
          'senderName', v_sender_username,
          'chatId', NEW.chat_id
        ),
        'priority', 'high',
        'channelId', 'default',
        '_displayInForeground', true,
        'badge', 1
      )::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
