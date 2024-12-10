import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { Link, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useEffect, useState } from 'react';
import Header from '@/components/header';

// Define User type
interface User {
  id: string;
  username: string;
  // add other user fields you need
}

export default function UserScreen() {
  const params = useLocalSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter()

  const getUser = async () => {
    const { data, error } = await supabase
      .from('User')
      .select('*')
      .eq('id', params.user_id)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }
    return data;
  };

  useEffect(() => {
    const loadUser = async () => {
      const userData = await getUser();
      setUser(userData);
    };
    
    loadUser();
  }, [params.user_id]);

  if (!user) {
    return (
      <View className="flex-1 bg-white">
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Header 
        title={user.username || ''} // Add empty string as fallback
        color="black" 
        goBack={true}
      />
      <View className="flex-1 items-center">
        <Text className='text-black font-bold text-3xl'>
          {user.username}
        </Text>
      </View>
    </SafeAreaView>
  );
}