import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { supabase } from '@/utils/supabase';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import * as ImageManipulator from 'expo-image-manipulator';

import {
  ROLE_OPTIONS,
  ROLE_COLORS,
  EXERCISE_OPTIONS,
  DRINKING_OPTIONS,
  SMOKING_OPTIONS,
  PETS_OPTIONS,
  DIET_OPTIONS,
  POPULAR_HOBBIES,
  POPULAR_INTERESTS,
} from '@/constants/profileOptions';
import { hybridCache } from '@/utils/memoryCache';
import { invalidateUserCache } from '@/utils/cacheInvalidation';
import { useColorScheme } from 'nativewind';

const EditProfileScreen = () => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const scrollViewRef = useRef<any>(null);
  const aboutMeRef = useRef<any>(null);
  const [image, setImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({
    name: '',
    aboutme: '',
    general: '',
  });
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    aboutme: '',
    hobbies: [] as string[],
    interests: [] as string[],
    role: '',
    exercise: '',
    drinking: '',
    smoking: '',
    pets: '',
    diet: '',
    height: '',
    location: '',
  });
  const [originalFormData, setOriginalFormData] = useState({
    name: '',
    aboutme: '',
    hobbies: [] as string[],
    interests: [] as string[],
    role: '',
    exercise: '',
    drinking: '',
    smoking: '',
    pets: '',
    diet: '',
    height: '',
    location: '',
  });

  useEffect(() => {
    const getProfile = async () => {
      // Check cache first
      const cacheKey = `profile:${user?.id}`;
      const cached = await hybridCache.get<any>(cacheKey);
      
      if (cached) {
        console.log('[EditProfile] Using cached profile');
        const profileData = {
          name: cached.name || '',
          aboutme: cached.aboutme || '',
          hobbies: cached.hobbies || [],
          interests: cached.interests || [],
          role: cached.role || '',
          exercise: cached.exercise || '',
          drinking: cached.drinking || '',
          smoking: cached.smoking || '',
          pets: cached.pets || '',
          diet: cached.diet || '',
          height: cached.height ? String(cached.height) : '',
          location: cached.location || '',
        };
        setFormData(profileData);
        setOriginalFormData(profileData);
        
        // Load image if exists
        if (cached.profilepicture) {
          const { data: urlData } = await supabase.storage
            .from('profile_images')
            .createSignedUrl(cached.profilepicture, 3600);
          
          if (urlData) {
            setImage(urlData.signedUrl);
            setOriginalImage(urlData.signedUrl);
          }
        }
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('UserProfile')
          .select('*')
          .eq('user_id', user?.id)
          .single();

        if (error) throw error;

        if (data) {
          // Cache the profile data
          await hybridCache.set(cacheKey, data, 6 * 60 * 60 * 1000);
          
          const profileData = {
            name: data.name || '',
            aboutme: data.aboutme || '',
            hobbies: data.hobbies || [],
            interests: data.interests || [],
            role: data.role || '',
            exercise: data.exercise || '',
            drinking: data.drinking || '',
            smoking: data.smoking || '',
            pets: data.pets || '',
            diet: data.diet || '',
            height: data.height ? String(data.height) : '',
            location: data.location || '',
          };
          setFormData(profileData);
          setOriginalFormData(profileData);

          if (data.profilepicture) {
            console.log('[EditProfile] Loading existing profile picture:', data.profilepicture);
            const { data: urlData, error: urlError } = await supabase.storage
              .from('profile_images')
              .createSignedUrl(data.profilepicture, 3600);
            
            if (urlError) {
              console.error('[EditProfile] Error creating signed URL:', urlError);
            }
            
            if (urlData) {
              setImage(urlData.signedUrl);
              setOriginalImage(urlData.signedUrl);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setErrors(prev => ({...prev, general: 'Failed to load profile data'}));
      }
    };

    getProfile();
  }, [user?.id]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        setImage(compressed.uri);
      } catch (error) {
        console.error('Error compressing image:', error);
        setErrors(prev => ({...prev, general: 'Failed to process image'}));
      }
    }
  };


  const validateForm = () => {
    const newErrors = {
      name: !formData.name.trim() ? 'Name is required' : '',
      aboutme: !formData.aboutme.trim() ? 'About me is required' : '',
    };

    setErrors(prev => ({...prev, ...newErrors}));
    return !Object.values(newErrors).some(error => error !== '');
  };

  const toggleHobby = (hobby: string) => {
    setFormData(prev => ({
      ...prev,
      hobbies: prev.hobbies.includes(hobby)
        ? prev.hobbies.filter(h => h !== hobby)
        : [...prev.hobbies, hobby]
    }));
  };

  const toggleInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      // Scroll to top to show validation errors
      scrollViewRef.current?.scrollToPosition(0, 0, true);
      return;
    }

    setIsSubmitting(true);
    setErrors(prev => ({...prev, general: ''}));

    try {
      let profilePicturePath = null;

      // Only upload if image has changed from original
      if (image && image !== originalImage) {
        console.log('[EditProfile] Image changed, starting upload process...');
        console.log('[EditProfile] Starting image compression...');
        const compressed = await ImageManipulator.manipulateAsync(
          image,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        console.log('[EditProfile] Image compressed successfully');

        const fileName = `${user?.id}-${Date.now()}.jpg`;
        console.log('[EditProfile] Uploading file:', fileName);
        
        // Create FormData for React Native upload
        const fileFormData = new FormData();
        fileFormData.append('file', {
          uri: compressed.uri,
          type: 'image/jpeg',
          name: fileName,
        } as any);

        console.log('[EditProfile] FormData created for file:', fileName);
        console.log('[EditProfile] Image URI:', compressed.uri);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('profile_images')
          .upload(fileName, fileFormData, {
            cacheControl: '3600000000',
            upsert: true,
            contentType: 'image/jpeg',
          });

        if (uploadError) {
          console.error('[EditProfile] File upload failed:', uploadError);
          console.error('[EditProfile] Upload error details:', JSON.stringify(uploadError, null, 2));
          throw new Error('Unable to upload profile picture. Please try again.');
        }
        
        if (!uploadData || !uploadData.path) {
          console.error('[EditProfile] Upload succeeded but no data/path returned:', uploadData);
          throw new Error('Unable to upload profile picture. Please try again.');
        }
        
        console.log('[EditProfile] File uploaded successfully:', uploadData.path);
        profilePicturePath = uploadData?.path;
        
        // Test the uploaded image URL
        const { data: testUrl } = supabase.storage
            .from('profile_images')
            .getPublicUrl(uploadData.path);
        console.log('[EditProfile] Testing uploaded image URL:', testUrl?.publicUrl);
      } else {
        console.log('[EditProfile] No image change detected, skipping upload');
      }

      console.log('[EditProfile] Form data state:', formData);
      const updateData: any = {
        name: formData.name.trim(),
        aboutme: formData.aboutme.trim(),
        hobbies: formData.hobbies.length > 0 ? formData.hobbies : null,
        interests: formData.interests.length > 0 ? formData.interests : null,
        role: formData.role || null,
        exercise: formData.exercise || null,
        drinking: formData.drinking || null,
        smoking: formData.smoking || null,
        pets: formData.pets || null,
        diet: formData.diet || null,
        height: formData.height ? parseInt(formData.height) : null,
        location: formData.location || null,
      };
      console.log('[EditProfile] Update data to save:', updateData);

      if (profilePicturePath) {
        updateData.profilepicture = profilePicturePath;
      }

      console.log('[EditProfile] Updating profile data...');
      console.log('[EditProfile] Update data:', { ...updateData, profilepicture: updateData.profilepicture ? 'exists' : 'unchanged' });
      
      const { error: profileError } = await supabase
        .from('UserProfile')
        .update(updateData)
        .eq('user_id', user?.id);

      if (profileError) {
        console.error('[EditProfile] Failed to update profile:', profileError);
        console.error('[EditProfile] Profile error details:', JSON.stringify(profileError, null, 2));
        throw new Error('Unable to save changes. Please try again.');
      }
      
      console.log('[EditProfile] Profile updated successfully!');
      
      // Invalidate ALL user-related caches (profile, profile_pic, notifications, feed)
      await invalidateUserCache(user?.id);

      router.back();
    } catch (error: any) {
      console.error('[EditProfile] An error occurred:', error);
      console.error('[EditProfile] Full error object:', error);
      setErrors(prev => ({
        ...prev,
        general: 'Unable to save changes. Please try again.'
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges = () => {
    const hobbiesChanged = JSON.stringify(formData.hobbies) !== JSON.stringify(originalFormData.hobbies);
    const interestsChanged = JSON.stringify(formData.interests) !== JSON.stringify(originalFormData.interests);

    return (
      image !== originalImage ||
      formData.name.trim() !== originalFormData.name.trim() ||
      formData.aboutme.trim() !== originalFormData.aboutme.trim() ||
      hobbiesChanged ||
      interestsChanged ||
      formData.role !== originalFormData.role ||
      formData.exercise !== originalFormData.exercise ||
      formData.drinking !== originalFormData.drinking ||
      formData.smoking !== originalFormData.smoking ||
      formData.pets !== originalFormData.pets ||
      formData.diet !== originalFormData.diet ||
      formData.height !== originalFormData.height ||
      formData.location !== originalFormData.location
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000000' : 'white' }}>
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        enableOnAndroid={true}
        extraScrollHeight={50}
        keyboardShouldPersistTaps="handled"
        enableAutomaticScroll={true}
        scrollEnabled={true}
        keyboardOpeningTime={0}
        extraHeight={50}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 16, paddingVertical: 12 }}>
          <View style={{ width: 40 }}>
            <TouchableOpacity
              onPress={() => {
                if (hasChanges()) {
                  Alert.alert('Unsaved Changes', 'You have unsaved changes. Are you sure you want to leave?', [
                    { text: 'Keep Editing', style: 'cancel' },
                    { text: 'Discard', style: 'destructive', onPress: () => router.back() },
                  ]);
                } else {
                  router.back();
                }
              }}
              activeOpacity={0.6}
            >
              <Ionicons name="chevron-back" size={28} color={isDark ? 'white' : 'black'} />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 17, fontWeight: '600', color: isDark ? 'white' : 'black' }}>{''}</Text>
          <View style={{ width: 40 }}>
            {hasChanges() && !isSubmitting && (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Save Changes', 'Are you sure you want to save your changes?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Save', onPress: handleSubmit },
                  ]);
                }}
                activeOpacity={0.6}
              >
                <Ionicons name="checkmark" size={28} color="#007C7B" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Edit Profile</Text>

          {errors.general && (
            <View style={styles.errorContainer}>
              <Text style={styles.generalError}>{errors.general}</Text>
            </View>
          )}

          <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
            {image ? (
              <Image source={{ uri: image }} style={styles.profileImage} />
            ) : (
              <View style={styles.placeholderContainer}>
                <Ionicons name="camera" size={40} color="#9CA3AF" />
                <Text style={styles.uploadText}>Upload Photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={formData.name}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, name: text }));
                setErrors(prev => ({ ...prev, name: '' }));
              }}
              placeholder="Enter your full name"
              placeholderTextColor="#9CA3AF"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            <View style={styles.separator} />
          </View>


          <View style={styles.formGroup}>
            <View style={styles.aboutMeHeader}>
              <Text style={styles.label}>About Me</Text>
              <Text style={styles.characterCount}>{formData.aboutme.length}/150</Text>
            </View>
            <TextInput
              ref={aboutMeRef}
              style={[styles.input, styles.textArea, errors.aboutme && styles.inputError]}
              value={formData.aboutme}
              onChangeText={(text) => {
                if (text.length <= 150) {
                  setFormData(prev => ({ ...prev, aboutme: text }));
                  setErrors(prev => ({ ...prev, aboutme: '' }));
                }
              }}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToFocusedInput(aboutMeRef.current, 200);
                }, 100);
              }}
              placeholder="Tell us about yourself..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={150}
            />
            {errors.aboutme && <Text style={styles.errorText}>{errors.aboutme}</Text>}
          </View>

          {/* Hobbies Section */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Hobbies (Select up to 5)</Text>
            <View style={styles.tagsContainer}>
              {POPULAR_HOBBIES.map((hobby) => (
                <TouchableOpacity
                  key={hobby}
                  style={[
                    styles.tag,
                    formData.hobbies.includes(hobby) && styles.tagSelected
                  ]}
                  onPress={() => toggleHobby(hobby)}
                  disabled={formData.hobbies.length >= 5 && !formData.hobbies.includes(hobby)}
                >
                  <Text style={[
                    styles.tagText,
                    formData.hobbies.includes(hobby) && styles.tagTextSelected
                  ]}>
                    {hobby}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Interests Section */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Interests (Select up to 5)</Text>
            <View style={styles.tagsContainer}>
              {POPULAR_INTERESTS.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.tag,
                    formData.interests.includes(interest) && styles.tagSelected
                  ]}
                  onPress={() => toggleInterest(interest)}
                  disabled={formData.interests.length >= 5 && !formData.interests.includes(interest)}
                >
                  <Text style={[
                    styles.tagText,
                    formData.interests.includes(interest) && styles.tagTextSelected
                  ]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Your Role */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Your Vibe</Text>
            <Text style={styles.helperText}>Pick a role that represents you</Text>
            <View style={styles.optionsContainer}>
              {ROLE_OPTIONS.map((option) => {
                const isSelected = formData.role === option.value;
                const colors = ROLE_COLORS[option.value];
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      isSelected && {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        borderWidth: 2,
                      }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, role: option.value }))}
                  >
                    <Text style={[
                      styles.optionText,
                      isSelected && { color: colors.text, fontWeight: '600' }
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.separator} />
          </View>

          {/* Lifestyle Section */}
          <Text style={styles.sectionTitle}>Lifestyle</Text>

          {/* Exercise */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Exercise</Text>
            <View style={styles.optionsContainer}>
              {EXERCISE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    formData.exercise === option.value && styles.optionButtonSelected
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, exercise: option.value }))}
                >
                  <Text style={[
                    styles.optionText,
                    formData.exercise === option.value && styles.optionTextSelected
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.separator} />
          </View>

          {/* Drinking */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Drinking</Text>
            <View style={styles.optionsContainer}>
              {DRINKING_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    formData.drinking === option.value && styles.optionButtonSelected
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, drinking: option.value }))}
                >
                  <Text style={[
                    styles.optionText,
                    formData.drinking === option.value && styles.optionTextSelected
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.separator} />
          </View>

          {/* Smoking */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Smoking</Text>
            <View style={styles.optionsContainer}>
              {SMOKING_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    formData.smoking === option.value && styles.optionButtonSelected
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, smoking: option.value }))}
                >
                  <Text style={[
                    styles.optionText,
                    formData.smoking === option.value && styles.optionTextSelected
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.separator} />
          </View>

          {/* Pets */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Pets</Text>
            <View style={styles.optionsContainer}>
              {PETS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    formData.pets === option.value && styles.optionButtonSelected
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, pets: option.value }))}
                >
                  <Text style={[
                    styles.optionText,
                    formData.pets === option.value && styles.optionTextSelected
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.separator} />
          </View>

          {/* Diet */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Diet</Text>
            <View style={styles.optionsContainer}>
              {DIET_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    formData.diet === option.value && styles.optionButtonSelected
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, diet: option.value }))}
                >
                  <Text style={[
                    styles.optionText,
                    formData.diet === option.value && styles.optionTextSelected
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.separator} />
          </View>

          {/* Additional Info Section */}
          <Text style={styles.sectionTitle}>Additional Info <Text style={styles.optionalLabel}>(Optional)</Text></Text>

          {/* Height */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              value={formData.height}
              onChangeText={(text) => {
                // Only allow numbers
                if (/^\d*$/.test(text)) {
                  setFormData(prev => ({ ...prev, height: text }));
                }
              }}
              placeholder="e.g., 170"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              maxLength={3}
            />
            <View style={styles.separator} />
          </View>

          {/* Location */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
              placeholder="e.g., Seoul, Bangkok"
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.separator} />
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              (!hasChanges() || isSubmitting) && styles.buttonDisabled
            ]}
            onPress={() => {
              Alert.alert('Save Changes', 'Are you sure you want to save your changes?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Save', onPress: handleSubmit },
              ]);
            }}
            disabled={!hasChanges() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const createStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#000000' : '#ffffff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: isDark ? '#F9FAFB' : '#111827',
  },
  imageContainer: {
    alignSelf: 'center',
    marginBottom: 30,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    marginTop: 8,
    fontSize: 14,
    color: isDark ? '#8E8E93' : '#6B7280',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: isDark ? '#D1D5DB' : '#374151',
  },
  input: {
    fontSize: 16,
    color: isDark ? '#F9FAFB' : '#111827',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  separator: {
    height: 1,
    backgroundColor: isDark ? '#38383A' : '#E5E7EB',
    marginTop: 8,
  },
  aboutMeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 14,
    color: isDark ? '#8E8E93' : '#6B7280',
  },
  textArea: {
    minHeight: 100,
    backgroundColor: isDark ? '#1C1C1E' : '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: isDark ? '#38383A' : '#E5E7EB',
  },
  button: {
    backgroundColor: '#007C7B',
    padding: 16,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
  },
  inputError: {
    borderColor: '#dc2626',
    borderWidth: 1,
  },
  errorContainer: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: isDark ? '#451A1A' : '#FEE2E2',
    borderRadius: 8,
  },
  generalError: {
    color: '#dc2626',
    textAlign: 'center',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 15,
    color: isDark ? '#F9FAFB' : '#111827',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6',
    borderWidth: 1,
    borderColor: isDark ? '#38383A' : '#E5E7EB',
  },
  tagSelected: {
    backgroundColor: '#007C7B',
    borderColor: '#007C7B',
  },
  tagText: {
    fontSize: 14,
    color: isDark ? '#D1D5DB' : '#374151',
  },
  tagTextSelected: {
    color: 'white',
    fontWeight: '500',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: isDark ? '#1C1C1E' : '#F9FAFB',
    borderWidth: 1,
    borderColor: isDark ? '#38383A' : '#E5E7EB',
  },
  optionButtonSelected: {
    backgroundColor: isDark ? '#042F2E' : '#CCFBF1',
    borderColor: '#007C7B',
  },
  optionText: {
    fontSize: 14,
    color: isDark ? '#D1D5DB' : '#374151',
  },
  optionTextSelected: {
    color: '#007C7B',
    fontWeight: '500',
  },
  helperText: {
    fontSize: 13,
    color: isDark ? '#8E8E93' : '#6B7280',
    marginBottom: 12,
  },
  optionalLabel: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: isDark ? '#6B7280' : '#9CA3AF',
  },
});

export default EditProfileScreen;