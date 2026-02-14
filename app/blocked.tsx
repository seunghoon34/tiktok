import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/utils/supabase";
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, Image } from "react-native";
import { useState, useEffect } from "react";
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import Header from "@/components/header";
import { invalidateBlockedUsersCache } from "@/utils/cacheInvalidation";
import { profileCache, CachedProfile } from "@/utils/profileCache";
import { useColorScheme } from 'nativewind';

interface BlockedUser {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

interface BlockedUserItemProps {
  blockedUser: BlockedUser;
  onUnblock: (user: BlockedUser) => void;
}

const BlockedUserItem = ({ blockedUser, onUnblock }: BlockedUserItemProps) => {
  const [userProfile, setUserProfile] = useState<CachedProfile | null>(null);

  useEffect(() => {
    const getUserProfile = async () => {
      try {
        console.log('[BlockedScreen] Loading profile for blocked user:', blockedUser.blocked_id);
        const profile = await profileCache.getProfile(blockedUser.blocked_id);

        if (profile) {
          console.log('[BlockedScreen] Profile loaded:', { userId: profile.user_id, hasPicture: !!profile.profilepicture });
          setUserProfile(profile);
        } else {
          console.log('[BlockedScreen] No profile found for user:', blockedUser.blocked_id);
        }
      } catch (error) {
        console.error('[BlockedScreen] Error loading profile:', error);
      }
    };
    getUserProfile();
  }, [blockedUser]);

  return (
    <View className="p-4 border-b border-gray-100 dark:border-gray-800 flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        {userProfile?.profilepicture ? (
          <Image
            source={{ uri: userProfile.profilepicture }}
            className="w-10 h-10 rounded-full"
            onLoad={() => console.log('[BlockedScreen] Image loaded successfully')}
            onError={(error) => {
              console.error('[BlockedScreen] Image failed to load:', error.nativeEvent);
              console.error('[BlockedScreen] Failed image URL:', userProfile.profilepicture);
            }}
          />
        ) : (
          <Ionicons
            name="person-circle-outline"
            size={40}
            color="gray"
          />
        )}
        <Text className="text-lg font-semibold ml-3 dark:text-white">
          {userProfile?.username}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => onUnblock(blockedUser)}
        className="bg-blue-500 px-4 py-2 rounded-full"
      >
        <Text className="text-white font-semibold">Unblock</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function BlockedScreen() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const fetchBlockedUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('UserBlock')
        .select('*')
        .eq('blocker_id', user.id);

      if (error) throw error;
      setBlockedUsers(data || []);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    }
  };

  const handleUnblock = async (blockedUser: BlockedUser) => {
    try {
      const { error } = await supabase
        .from('UserBlock')
        .delete()
        .match({
          blocker_id: user.id,
          blocked_id: blockedUser.blocked_id
        });

      if (error) throw error;

      await invalidateBlockedUsersCache(user.id);
      console.log('[BlockedScreen] Cache invalidated after unblock');

      setBlockedUsers(current =>
        current.filter(u => u.blocked_id !== blockedUser.blocked_id)
      );

      Toast.show({
        type: 'success',
        text1: 'User Unblocked',
        text2: 'You can now interact with this user again',
      });
    } catch (error) {
      console.error('Error unblocking user:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to unblock user. Please try again.',
      });
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <Header title="Blocked Users" color={isDark ? 'white' : 'black'} goBack={true}/>

      {blockedUsers.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="shield-checkmark-outline" size={64} color={isDark ? '#48484A' : 'gray'} />
          <Text className="text-gray-500 dark:text-gray-400 text-lg mt-4">No blocked users</Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          renderItem={({ item }) => (
            <BlockedUserItem
              blockedUser={item}
              onUnblock={handleUnblock}
            />
          )}
          keyExtractor={(item) => item.id.toString()}
        />
      )}
    </SafeAreaView>
  );
}
