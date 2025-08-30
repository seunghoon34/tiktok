import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/utils/supabase";
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, Image } from "react-native";
import { useState, useEffect } from "react";
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import Header from "@/components/header";

const BlockedUserItem = ({ blockedUser, onUnblock }) => {
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const getUserProfile = async () => {
      const { data, error } = await supabase
        .from('UserProfile')
        .select(`
          *,
          user:User (
            username
          )
        `)
        .eq('user_id', blockedUser.blocked_id)
        .single();

      if (data) {
        const publicUrl = supabase.storage
          .from('avatars')
          .getPublicUrl(data.profilepicture).data.publicUrl;
        
        setUserProfile({...data, profilepicture: publicUrl});
      }
    };
    getUserProfile();
  }, [blockedUser]);

  return (
    <View className="p-4 border-b border-gray-100 flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        {userProfile?.profilepicture ? (
          <Image 
            source={{ uri: userProfile.profilepicture }}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <Ionicons 
            name="person-circle-outline" 
            size={40} 
            color="gray" 
          />
        )}
        <Text className="text-lg font-semibold ml-3">
          {userProfile?.user?.username}
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
  const [blockedUsers, setBlockedUsers] = useState([]);

  const fetchBlockedUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('UserBlock')
        .select('*')
        .eq('blocker_id', user.id);

      if (error) throw error;
      setBlockedUsers(data);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    }
  };

  const handleUnblock = async (blockedUser) => {
    try {
      const { error } = await supabase
        .from('UserBlock')
        .delete()
        .match({ 
          blocker_id: user.id, 
          blocked_id: blockedUser.blocked_id 
        });

      if (error) throw error;

      // Update the local state to remove the unblocked user
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
    <SafeAreaView className="flex-1 bg-white">
        <Header title="Blocked Users" color="black" goBack={true}/>
      
      
      {blockedUsers.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="shield-checkmark-outline" size={64} color="gray" />
          <Text className="text-gray-500 text-lg mt-4">No blocked users</Text>
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