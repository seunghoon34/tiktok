import { supabase } from './supabase';
import { invalidateBlockedUsersCache } from './cacheInvalidation';

export async function blockUser(blockerId: string, blockedId: string) {
    try {
        // First check if block already exists
        const { data: existingBlock } = await supabase
            .from('UserBlock')
            .select()
            .eq('blocker_id', blockerId)
            .eq('blocked_id', blockedId)
            .single();

        if (existingBlock) {
            return { status: 'already_blocked' };
        }

        // Create new block
        const { data, error } = await supabase
            .from('UserBlock')
            .insert({
                blocker_id: blockerId,
                blocked_id: blockedId,
            })
            .select()
            .single();

        if (error) throw error;

        // Delete any existing matches between these users
        await supabase
            .from('Match')
            .delete()
            .or(`user1_id.eq.${blockerId},user2_id.eq.${blockerId}`)
            .or(`user1_id.eq.${blockedId},user2_id.eq.${blockedId}`);

        // Invalidate blocked users cache
        await invalidateBlockedUsersCache(blockerId);
        console.log('[UserModeration] Cache invalidated after blocking user');

        return { status: 'success', data };
    } catch (error) {
        console.error('Error blocking user:', error);
        return { status: 'error', error };
    }
}

export async function unblockUser(blockerId: string, blockedId: string) {
    try {
        const { data, error } = await supabase
            .from('UserBlock')
            .delete()
            .eq('blocker_id', blockerId)
            .eq('blocked_id', blockedId);

        if (error) throw error;

        // Invalidate blocked users cache
        await invalidateBlockedUsersCache(blockerId);
        console.log('[UserModeration] Cache invalidated after unblocking user');

        return { status: 'success', data };
    } catch (error) {
        console.error('Error unblocking user:', error);
        return { status: 'error', error };
    }
}

export async function reportContent(
  reporterId: string,
  reportedId: string,
  contentType: 'CONTENT' | 'USER',
  contentId: string,
  reason: 'INAPPROPRIATE_CONTENT' | 'HARASSMENT' | 'SPAM' | 'FAKE_PROFILE' | 'OTHER',
  description?: string
) {
  try {
    const { data, error } = await supabase
      .from('Report')
      .insert({
        reporter_id: reporterId,
        reported_id: reportedId,
        content_type: contentType,
        content_id: contentId,
        reason: reason,
        description: description,
      })
      .select()
      .single();

    if (error) throw error;
    return { status: 'success', data };
  } catch (error) {
    console.error('Error reporting content:', error);
    return { status: 'error', error };
  }
}

export async function isUserBlocked(userId: string, targetId: string) {
  try {
    const { data, error } = await supabase
      .from('UserBlock')
      .select()
      .or(`and(blocker_id.eq.${userId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${userId})`)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
    return { status: 'success', isBlocked: !!data };
  } catch (error) {
    console.error('Error checking block status:', error);
    return { status: 'error', error };
  }
}
