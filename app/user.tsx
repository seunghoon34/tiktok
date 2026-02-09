import { View, Text, TouchableOpacity, SafeAreaView, Image, StyleSheet } from 'react-native';
import { useAuth } from '@/providers/AuthProvider'; 
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useEffect,  useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modalize } from 'react-native-modalize';
import { Portal } from 'react-native-portalize';
import { reportContent, blockUser } from '@/utils/userModeration';
import Toast from 'react-native-toast-message';
import { ScrollView } from 'react-native-gesture-handler';
import SkeletonLoader from '@/components/userSkeleton';
import {
  ROLE_OPTIONS,
  ROLE_COLORS,
  EXERCISE_OPTIONS,
  DRINKING_OPTIONS,
  SMOKING_OPTIONS,
  PETS_OPTIONS,
  DIET_OPTIONS,
} from '@/constants/profileOptions';

interface UserProfileData {
  user_id: string;
  profilepicture: string | null;
  name: string;
  birthdate: string | null;
  aboutme: string | null;
  hobbies: string[] | null;
  interests: string[] | null;
  role: string | null;
  exercise: string | null;
  drinking: string | null;
  smoking: string | null;
  pets: string | null;
  diet: string | null;
  height: number | null;
  location: string | null;
  user: {
    username: string;
  };
}

export default function UserScreen() {
 const params = useLocalSearchParams();
 const [profile, setProfile] = useState<UserProfileData | null>(null);
 const router = useRouter();
 const modalRef = useRef<Modalize>(null);
 const [modalView, setModalView] = useState<'menu' | 'confirmBlock' | 'reportReasons' | 'confirmReportReason'>('menu');
 const [selectedReason, setSelectedReason] = useState<'INAPPROPRIATE_CONTENT' | 'HARASSMENT' | 'SPAM' | 'FAKE_PROFILE' | 'OTHER' | null>(null);
 const { user } = useAuth();
 
 // Helper to get user_id as string
 const userId = Array.isArray(params.user_id) ? params.user_id[0] : params.user_id;

 useEffect(() => {
  const getProfile = async () => {
    try {
      console.log('[UserScreen] Fetching profile for user_id:', params.user_id);
      const { data, error } = await supabase
        .from('UserProfile')
        .select(`
          *,
          user:User (
            username
          )
        `)
        .eq('user_id', params.user_id)
        .single();
 
      if (error) {
        console.error('[UserScreen] Error fetching profile:', error);
        return;
      }
 
      if (data) {
        console.log('[UserScreen] Profile data received:', { ...data, profilepicture: data.profilepicture ? 'exists' : 'null' });
        
        if (data.profilepicture) {
          console.log('[UserScreen] Getting public URL for:', data.profilepicture);
          const { data: publicData } = supabase.storage
            .from('profile_images')
            .getPublicUrl(data.profilepicture);
          
          if (publicData?.publicUrl) {
            const imageUrl = publicData.publicUrl; // Remove dynamic timestamp
            console.log('[UserScreen] Setting image URL:', imageUrl);
            
            // Test if the image actually loads (web only)
            if (typeof window !== 'undefined' && window.Image) {
              const testImage = new window.Image();
              testImage.onload = () => {
                console.log('[UserScreen] ✅ Image loaded successfully');
              };
              testImage.onerror = (error: any) => {
                console.error('[UserScreen] ❌ Failed to load image:', error);
                console.error('[UserScreen] Image URL that failed:', imageUrl);
              };
              testImage.src = imageUrl;
            }
            
            setProfile({...data, profilepicture: imageUrl});
          } else {
            console.log('[UserScreen] No public URL returned from storage');
            setProfile({...data, profilepicture: null});
          }
        } else {
          console.log('[UserScreen] No profile picture path in data');
          setProfile({...data, profilepicture: null});
        }
      } else {
        console.log('[UserScreen] No profile data returned');
      }
    } catch (error) {
      console.error('[UserScreen] Exception in getProfile:', error);
    }
  };
  getProfile();
 }, [params.user_id]);
 

 if (!profile) {
  return <SkeletonLoader />;
 }

 const getAge = (birthdate: string | null) => {
   if (!birthdate) return '';
   return new Date().getFullYear() - new Date(birthdate).getFullYear();
 };

 const getLabelForValue = (value: string | null, options: Array<{value: string, label: string, description?: string}>) => {
   if (!value) return null;
   const option = options.find(opt => opt.value === value);
   return option?.label || value;
 };

 const handleReasonSelect = (reason: 'INAPPROPRIATE_CONTENT' | 'HARASSMENT' | 'SPAM' | 'FAKE_PROFILE' | 'OTHER') => {
  setSelectedReason(reason);
  setModalView('confirmReportReason');
};

 return (
   <SafeAreaView style={styles.container}>
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={28} color="#1F2937"/>
        </TouchableOpacity>
        
        <Text style={styles.username}>@{profile.user.username}</Text>
        
        <TouchableOpacity onPress={() => modalRef.current?.open()} style={styles.headerButton}>
          <Ionicons name="ellipsis-horizontal" size={28} color="#1F2937"/>
        </TouchableOpacity>
      </View>

      {/* Profile Image */}
      <View style={styles.imageWrapper}>
        <View style={styles.imageContainer}>
          {profile.profilepicture ? (
            <Image
              source={{ uri: profile.profilepicture }}
              style={styles.profileImage}
              onLoad={() => console.log('[UserScreen] Image loaded')}
              onError={(error) => console.error('[UserScreen] Image error:', error)}
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Ionicons name="person" size={80} color="#D1D5DB" />
            </View>
          )}
          
          {/* Gradient overlay */}
          <View style={styles.imageGradient} />
          
          {/* Name and age overlay */}
          <View style={styles.nameOverlay}>
            <Text style={styles.nameText}>
              {profile.name}
              <Text style={styles.ageText}>, {getAge(profile.birthdate)}</Text>
            </Text>
            {profile.location && (
              <View style={styles.locationBadge}>
                <Ionicons name="location" size={14} color="white" />
                <Text style={styles.locationText}>{profile.location}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Content Cards */}
      <View style={styles.contentContainer}>
        {/* About Me */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle" size={22} color="#FF6B6B" />
            <Text style={styles.cardTitle}>About Me</Text>
          </View>
          <Text style={styles.aboutText}>
            {profile.aboutme || "No description yet"}
          </Text>
        </View>

        {/* Role Badge - Prominent */}
        {profile.role && ROLE_COLORS[profile.role] && (() => {
          const roleColors = ROLE_COLORS[profile.role];
          return (
            <View style={[styles.roleBanner, { 
              backgroundColor: roleColors.background,
              borderColor: roleColors.border 
            }]}>
              <View style={styles.roleIcon}>
                <Ionicons name="star" size={24} color={roleColors.ring} />
              </View>
              <View style={styles.roleContent}>
                <Text style={[styles.roleLabel, { color: roleColors.text }]}>Vibe</Text>
                <Text style={[styles.roleValue, { color: roleColors.ring }]}>
                  {getLabelForValue(profile.role, ROLE_OPTIONS)}
                </Text>
                {ROLE_OPTIONS.find(r => r.value === profile.role)?.description && (
                  <Text style={[styles.roleDescription, { color: roleColors.text }]}>
                    {ROLE_OPTIONS.find(r => r.value === profile.role)?.description}
                  </Text>
                )}
              </View>
            </View>
          );
        })()}

        {/* Hobbies */}
        {profile.hobbies && profile.hobbies.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="basketball" size={22} color="#FF6B6B" />
              <Text style={styles.cardTitle}>Hobbies</Text>
            </View>
            <View style={styles.tagsContainer}>
              {profile.hobbies.map((hobby, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{hobby}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="sparkles" size={22} color="#FF6B6B" />
              <Text style={styles.cardTitle}>Interests</Text>
            </View>
            <View style={styles.tagsContainer}>
              {profile.interests.map((interest, index) => (
                <View key={index} style={[styles.tag, styles.tagBlue]}>
                  <Text style={[styles.tagText, styles.tagTextBlue]}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Basics */}
        {profile.height && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="information" size={22} color="#FF6B6B" />
              <Text style={styles.cardTitle}>Basics</Text>
            </View>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Height</Text>
                <Text style={styles.infoValue}>{profile.height} cm</Text>
              </View>
            </View>
          </View>
        )}

        {/* Lifestyle */}
        {(profile.exercise || profile.drinking || profile.smoking || profile.pets || profile.diet) && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="leaf" size={22} color="#FF6B6B" />
              <Text style={styles.cardTitle}>Lifestyle</Text>
            </View>
            <View style={styles.lifestyleGrid}>
              {profile.exercise && (
                <View style={styles.lifestyleItem}>
                  <View style={styles.lifestyleIcon}>
                    <Ionicons name="fitness" size={18} color="#10B981" />
                  </View>
                  <View style={styles.lifestyleContent}>
                    <Text style={styles.lifestyleLabel}>Exercise</Text>
                    <Text style={styles.lifestyleValue}>
                      {getLabelForValue(profile.exercise, EXERCISE_OPTIONS)}
                    </Text>
                  </View>
                </View>
              )}
              {profile.drinking && (
                <View style={styles.lifestyleItem}>
                  <View style={styles.lifestyleIcon}>
                    <Ionicons name="wine" size={18} color="#8B5CF6" />
                  </View>
                  <View style={styles.lifestyleContent}>
                    <Text style={styles.lifestyleLabel}>Drinking</Text>
                    <Text style={styles.lifestyleValue}>
                      {getLabelForValue(profile.drinking, DRINKING_OPTIONS)}
                    </Text>
                  </View>
                </View>
              )}
              {profile.smoking && (
                <View style={styles.lifestyleItem}>
                  <View style={styles.lifestyleIcon}>
                    <Ionicons name="cloud" size={18} color="#6B7280" />
                  </View>
                  <View style={styles.lifestyleContent}>
                    <Text style={styles.lifestyleLabel}>Smoking</Text>
                    <Text style={styles.lifestyleValue}>
                      {getLabelForValue(profile.smoking, SMOKING_OPTIONS)}
                    </Text>
                  </View>
                </View>
              )}
              {profile.pets && (
                <View style={styles.lifestyleItem}>
                  <View style={styles.lifestyleIcon}>
                    <Ionicons name="paw" size={18} color="#F59E0B" />
                  </View>
                  <View style={styles.lifestyleContent}>
                    <Text style={styles.lifestyleLabel}>Pets</Text>
                    <Text style={styles.lifestyleValue}>
                      {getLabelForValue(profile.pets, PETS_OPTIONS)}
                    </Text>
                  </View>
                </View>
              )}
              {profile.diet && (
                <View style={styles.lifestyleItem}>
                  <View style={styles.lifestyleIcon}>
                    <Ionicons name="restaurant" size={18} color="#EF4444" />
                  </View>
                  <View style={styles.lifestyleContent}>
                    <Text style={styles.lifestyleLabel}>Diet</Text>
                    <Text style={styles.lifestyleValue}>
                      {getLabelForValue(profile.diet, DIET_OPTIONS)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Bottom Padding */}
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
     

   <Portal>
     <Modalize
       ref={modalRef}
       modalHeight={280}
       modalStyle={{
         backgroundColor: '#1a1a1a',
         borderTopLeftRadius: 20,
         borderTopRightRadius: 20,
       }}
       closeOnOverlayTap
       handleStyle={{ backgroundColor: '#4a4a4a', width: 40, height: 4, borderRadius: 2 }}
       onClose={() => setModalView('menu')}
     >
       <View className="pt-4 pb-6">
         {modalView === 'menu' && (
           <>
             <TouchableOpacity
               className="flex-row items-center px-6 py-4 mx-4 mb-2 bg-gray-800/50 rounded-2xl active:bg-gray-700/60"
               onPress={() => setModalView('reportReasons')}
             >
               <View className="w-8 h-8 bg-red-500/20 rounded-full items-center justify-center mr-4">
                 <Ionicons name="flag-outline" size={18} color="#FF6B6B" />
               </View>
               <Text className="text-white text-base font-medium">Report {profile.user.username}</Text>
             </TouchableOpacity>

             <TouchableOpacity
               className="flex-row items-center px-6 py-4 mx-4 mb-2 bg-gray-800/50 rounded-2xl active:bg-gray-700/60"
               onPress={() => setModalView('confirmBlock')}
             >
               <View className="w-8 h-8 bg-red-500/20 rounded-full items-center justify-center mr-4">
                 <Ionicons name="ban-outline" size={18} color="#FF6B6B" />
               </View>
               <Text className="text-white text-base font-medium">Block {profile.user.username}</Text>
             </TouchableOpacity>

             <TouchableOpacity
               className="flex-row items-center px-6 py-4 mx-4 mb-2 bg-gray-700/50 rounded-2xl active:bg-gray-600/60"
               onPress={() => modalRef.current?.close()}
             >
               <View className="w-8 h-8 bg-gray-500/20 rounded-full items-center justify-center mr-4">
                 <Ionicons name="close-outline" size={18} color="#9ca3af" />
               </View>
               <Text className="text-gray-300 text-base font-medium">Cancel</Text>
             </TouchableOpacity>
           </>
         )}

         {modalView === 'reportReasons' && (
           <View className="px-4 py-3">
             <Text className="text-white text-lg mb-4">
               Why are you reporting this user?
             </Text>
             
             {(['INAPPROPRIATE_CONTENT', 'HARASSMENT', 'SPAM', 'FAKE_PROFILE', 'OTHER'] as const).map((reason) => (
               <TouchableOpacity
                 key={reason}
                 className="active:bg-gray-800 rounded-lg py-3 mb-3"
                 onPress={() => handleReasonSelect(reason)}
               >
                 <Text className="text-white text-center text-lg">
                   {reason.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                 </Text>
               </TouchableOpacity>
             ))}
             
             <TouchableOpacity
               className="active:bg-gray-800 rounded-lg py-3"
               onPress={() => setModalView('menu')}
             >
               <Text className="text-white text-center text-lg">Cancel</Text>
             </TouchableOpacity>
           </View>
         )}

         {modalView === 'confirmReportReason' && (
           <View className="px-4 py-3">
             <Text className="text-white text-lg mb-4">
               Are you sure you want to report {profile.user.username} for{' '}
               {selectedReason?.toLowerCase().replace(/_/g, ' ')}?
             </Text>
             
             <TouchableOpacity
               className="bg-red-500 rounded-xl py-3 mb-3"
               onPress={async () => {
                 if (!selectedReason) return;
                 try {
                   const result = await reportContent(
                     user.id,
                     userId,
                     'USER',
                     userId,
                     selectedReason
                   );
                   
                   if (result.status === 'success') {
                     modalRef.current?.close();
                     setModalView('menu');
                     setSelectedReason(null);
                     Toast.show({
                       type: 'success',
                       text1: 'Report Submitted',
                       text2: 'Thank you for helping keep our community safe',
                     });
                   }
                 } catch (error) {
                   console.error('Error reporting:', error);
                   Toast.show({
                     type: 'error',
                     text1: 'Error',
                     text2: 'Failed to submit report. Please try again.',
                   });
                 }
               }}
             >
               <Text className="text-white text-center font-semibold text-lg">Submit Report</Text>
             </TouchableOpacity>
             
             <TouchableOpacity
               className="bg-gray-600 rounded-lg py-3"
               onPress={() => setModalView('reportReasons')}
             >
               <Text className="text-white text-center text-lg">Go Back</Text>
             </TouchableOpacity>
           </View>
         )}

         {modalView === 'confirmBlock' && (
           <View className="px-4 py-3">
             <Text className="text-white text-lg mb-4">
               Are you sure you want to block {profile.user.username}?
             </Text>
             <TouchableOpacity
               className="bg-red-500 rounded-xl py-3 mb-3"
               onPress={async () => {
                 try {
                   const result = await blockUser(user.id, userId);
                   if (result.status === 'success' || result.status === 'already_blocked') {
                     modalRef.current?.close();
                     setModalView('menu');
                     Toast.show({
                       type: 'success',
                       text1: 'User Blocked',
                       text2: `You have blocked ${profile.user.username}`,
                     });
                   }
                 } catch (error) {
                   console.error('Error blocking user:', error);
                   Toast.show({
                     type: 'error',
                     text1: 'Error',
                     text2: 'Failed to block user. Please try again.',
                   });
                 }
               }}
             >
               <Text className="text-white text-center font-semibold text-lg">Block User</Text>
             </TouchableOpacity>
             <TouchableOpacity
               className="bg-gray-600 rounded-lg py-3"
               onPress={() => setModalView('menu')}
             >
               <Text className="text-white text-center text-lg">Cancel</Text>
             </TouchableOpacity>
           </View>
         )}
       </View>
     </Modalize>
   </Portal>
 </SafeAreaView>
 );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  imageWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4/5,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    maxHeight: 480,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '25%',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  nameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  nameText: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  ageText: {
    fontSize: 24,
    fontWeight: '400',
    color: '#F3F4F6',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  locationText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 10,
  },
  aboutText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4B5563',
  },
  roleBanner: {
    // backgroundColor and borderColor will be set dynamically
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roleContent: {
    flex: 1,
  },
  roleLabel: {
    // color will be set dynamically
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleValue: {
    // color will be set dynamically
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  roleDescription: {
    // color will be set dynamically
    fontSize: 13,
    fontStyle: 'italic',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tagBlue: {
    backgroundColor: '#DBEAFE',
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  tagTextBlue: {
    color: '#1D4ED8',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  lifestyleGrid: {
    gap: 12,
  },
  lifestyleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 12,
  },
  lifestyleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  lifestyleContent: {
    flex: 1,
  },
  lifestyleLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
    fontWeight: '500',
  },
  lifestyleValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
  },
});