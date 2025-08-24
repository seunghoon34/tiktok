import { createContext, useContext, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'expo-router';

const ProfileContext = createContext({
  hasProfile: false,
  checkProfile: async (userId: string) => false,
  updateProfileStatus: (status: boolean) => {},
});

export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const [hasProfile, setHasProfile] = useState(false);
  const router = useRouter();

  const checkProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('UserProfile')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        setHasProfile(false);
        console.log('No profile found, redirecting to createprofile (profile provider');
        router.push('/createprofile');
        return false;
      }

      setHasProfile(true);
      router.push('/(tabs)/profile');
      return true;
    } catch (error) {
      console.error('Error checking profile:', error);
      setHasProfile(false);
      return false;
    }
  };

  const updateProfileStatus = (status: boolean) => {
    setHasProfile(status);
  };

  return (
    <ProfileContext.Provider value={{ hasProfile, checkProfile, updateProfileStatus }}>
      {children}
    </ProfileContext.Provider>
  );
};
