import { supabase } from '@/utils/supabase';
import { invalidateNotificationCache } from './cacheInvalidation';
// Push notifications are now handled by database triggers on Notification table

export const handleVideoLike = async (
  userId: string,
  videoId: string,
  videoUserId: string
) => {
  try {
    // 1. Create the like
    const { data: newLike, error: likeError } = await supabase
      .from('Like')
      .insert({
        user_id: userId,
        video_id: videoId,
        video_user_id: videoUserId
      })
      .single();

    if (likeError) throw likeError;

    // Debug: Check current user session
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    console.log('Current authenticated user:', currentUser?.id);
    console.log('Trying to insert notification from_user:', userId);

    const { error: shotNotificationError } = await supabase
      .from('Notification')
      .insert({
        type: 'SHOT',
        from_user: userId,
        to_user: videoUserId,
      });
    if (shotNotificationError) {
      console.error('Error creating shot notification:', shotNotificationError);
      console.error('User trying to insert:', userId);
      console.error('Authenticated user:', currentUser?.id);
      // Don't throw error - continue with like flow even if notification fails
    }

    // 2. Check if the other user has liked any of current user's videos
    const { data: otherUserLikes, error: checkError } = await supabase
      .from('Like')
      .select('*')
      .eq('user_id', videoUserId)
      .eq('video_user_id', userId);

    if (checkError) throw checkError;

    // If there's a mutual like, create a match
    if (otherUserLikes && otherUserLikes.length > 0) {
      // Sort IDs to ensure consistent ordering
      const [user1_id, user2_id] = [userId, videoUserId].sort();
      
      // Check if match already exists
      const { data: existingMatch, error: matchCheckError } = await supabase
        .from('Match')
        .select('*')
        .eq('user1_id', user1_id)
        .eq('user2_id', user2_id)
        .single();

      if (matchCheckError && matchCheckError.code !== 'PGRST116') throw matchCheckError;

      // Only create new match if it doesn't exist
      if (!existingMatch) {
        const { data: match, error: matchError } = await supabase
          .from('Match')
          .insert({
            user1_id,
            user2_id
          })
          .single();

        if (matchError) throw matchError;

        const { error: matchNotificationsError } = await supabase
        .from('Notification')
        .insert([
          {
            type: 'MATCH',
            from_user: userId,
            to_user: videoUserId,
          },
          {
            type: 'MATCH',
            from_user: videoUserId,
            to_user: userId,
          }
        ]);
      if (matchNotificationsError) {
        console.error('Error creating match notifications:', matchNotificationsError);
        // Don't throw error - continue with match flow even if notifications fail
      }

        

      const [chatUser1, chatUser2] = [user1_id, user2_id].sort();
      const { data: existingChat, error: existingChatError } = await supabase
      .from('Chat')
      .select('*')
      .eq('user1_id', chatUser1)
      .eq('user2_id', chatUser2)
      .single();
    
    if (existingChatError && existingChatError.code !== 'PGRST116') throw existingChatError;
    
    // If chat doesn't exist, create it. Otherwise use existing chat
    const chatData = existingChat || (await supabase
      .from('Chat')
      .insert({
        user1_id: chatUser1,
        user2_id: chatUser2
      })
      .select('*')
      .single())
      .data;
    
    if (!chatData) {
      console.error("Chat not found and couldn't be created");
      return;
    }
    

    

        // Invalidate notification caches for both users after match
        await invalidateNotificationCache(userId);
        await invalidateNotificationCache(videoUserId);
        console.log('[VideoMatching] Invalidated notification caches for both users after match');
        
        return {
          status: 'matched',
          message: "It's a match!",
          like: newLike,
          match,
          users: [user1_id,user2_id]
          
        };
      }
    }

    // For non-match likes, still invalidate the video owner's notification cache
    await invalidateNotificationCache(videoUserId);
    console.log('[VideoMatching] Invalidated notification cache after like');

    return {
      status: 'liked',
      message: 'Video liked successfully',
      like: newLike
    };

  } catch (error) {
    console.error('Error in handleVideoLike:', error);
    throw error;
  }
};