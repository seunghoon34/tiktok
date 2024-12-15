import { supabase } from '@/utils/supabase';

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

        return {
          status: 'matched',
          message: "It's a match!",
          like: newLike,
          match,
          users: [user1_id,user2_id]
          
        };
      }
    }

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