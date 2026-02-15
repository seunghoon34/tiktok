import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Image,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
    ScrollView,
    Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { supabase } from '@/utils/supabase';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import * as ImageManipulator from 'expo-image-manipulator';
import { invalidateUserCache } from '@/utils/cacheInvalidation';
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

const CreateProfileScreen = () => {
    const [image, setImage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [tosConfirmed, setTosConfirmed] = useState(false);
    const [errors, setErrors] = useState({
        image: '',
        username: '',
        name: '',
        aboutme: '',
        birthdate: '',
        general: '',
    });

    const scrollViewRef = useRef<any>(null);
    const aboutMeRef = useRef<any>(null);
    const { user, refreshUserData, deleteAccount } = useAuth();
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        name: '',
        birthdate: new Date(),
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

    const checkUsername = async (username: string) => {
        if (!username.trim()) return;

        try {
            setIsCheckingUsername(true);
            const { data, error } = await supabase
                .from('User')
                .select('username')
                .eq('username', username)
                .not('id', 'eq', user?.id);

            if (error) throw error;
            
            if (data && data.length > 0) {
                setErrors(prev => ({...prev, username: 'Username already taken'}));
                return false;
            }
            
            setErrors(prev => ({...prev, username: ''}));
            return true;
        } catch (error) {
            console.error('Error checking username:', error);
            return false;
        } finally {
            setIsCheckingUsername(false);
        }
    };

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
            const compressed = await ImageManipulator.manipulateAsync(
                result.assets[0].uri,
                [{ resize: { width: 800 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            setImage(compressed.uri);
            setErrors(prev => ({...prev, image: ''}));
        }
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        if (selectedDate) {
            setFormData(prev => ({ ...prev, birthdate: selectedDate }));
            setErrors(prev => ({ ...prev, birthdate: '' }));
        }
    };

    const getAge = (birthdate: Date) => {
        const today = new Date();
        let age = today.getFullYear() - birthdate.getFullYear();
        const monthDiff = today.getMonth() - birthdate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
            age--;
        }
        return age;
    };

    const validateForm = () => {
        const age = getAge(formData.birthdate);

        if (age < 18) {
            Alert.alert(
                'Age Requirement',
                'You must be at least 18 years old to use this app. Your account will be removed.',
                [
                    {
                        text: 'OK',
                        onPress: async () => {
                            try {
                                await deleteAccount();
                            } catch (error) {
                                console.error('[CreateProfile] Error deleting underage account:', error);
                            }
                        },
                    },
                ],
                { cancelable: false }
            );
            return false;
        }

        const newErrors = {
            image: !image ? 'Profile picture is required' : '',
            username: !formData.username.trim() ? 'Username is required' : '',
            name: !formData.name.trim() ? 'Name is required' : '',
            aboutme: !formData.aboutme.trim() ? 'About me is required' : '',
            birthdate: '',
            general: '',
        };

        setErrors(newErrors);
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
        // Prevent double submission
        if (hasSubmitted) {
            console.log('[CreateProfile] Already submitted, ignoring duplicate submission');
            return;
        }
        
        // Clear any previous general errors to allow retry
        setErrors(prev => ({...prev, general: ''}));
        
        if (!validateForm()) {
            // Scroll to top to show validation errors
            scrollViewRef.current?.scrollToPosition(0, 0, true);
            return;
        }

        // Final username availability check right before submission
        const isUsernameAvailable = await checkUsername(formData.username);
        if (!isUsernameAvailable) {
            setIsSubmitting(false);
            scrollViewRef.current?.scrollToPosition(0, 0, true);
            return;
        }

        setIsSubmitting(true);
        setHasSubmitted(true);

        try {
            if (!image) {
                throw new Error("Please select an image");
            }

            console.log('[CreateProfile] Starting image compression...');
            const compressed = await ImageManipulator.manipulateAsync(
                image,
                [{ resize: { width: 800 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            console.log('[CreateProfile] Image compressed successfully');

            const fileName = `${user?.id}-${Date.now()}.jpg`;
            console.log('[CreateProfile] Uploading file:', fileName);

            // Create FormData for React Native upload
            const fileFormData = new FormData();
            fileFormData.append('file', {
                uri: compressed.uri,
                type: 'image/jpeg',
                name: fileName,
            } as any);

            console.log('[CreateProfile] FormData created for file:', fileName);
            console.log('[CreateProfile] Image URI:', compressed.uri);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('profile_images')
                .upload(fileName, fileFormData, {
                    cacheControl: '3600000000',
                    upsert: false,
                    contentType: 'image/jpeg',
                });
    
            if (uploadError) {
                console.error('[CreateProfile] File upload failed:', uploadError);
                console.error('[CreateProfile] Upload error details:', JSON.stringify(uploadError, null, 2));
                throw new Error('Unable to upload profile picture. Please try again.');
            }
            
            if (!uploadData || !uploadData.path) {
                console.error('[CreateProfile] Upload succeeded but no data/path returned:', uploadData);
                throw new Error('Unable to upload profile picture. Please try again.');
            }
            
            console.log('[CreateProfile] File uploaded successfully:', uploadData.path);
            
            // Test the uploaded image URL
            const { data: testUrl } = supabase.storage
                .from('profile_images')
                .getPublicUrl(uploadData.path);
            console.log('[CreateProfile] Testing uploaded image URL:', testUrl?.publicUrl);
    
            const { error: userError } = await supabase
                .from('User')
                .update({ username: formData.username })
                .eq('id', user?.id);

            if (userError) {
                console.error("Failed to update username:", userError.message);
                
                // Handle duplicate username error specifically
                if (userError.code === '23505' || userError.message.includes('duplicate') || userError.message.includes('unique constraint')) {
                    setErrors(prev => ({...prev, username: 'Username already taken. Please choose a different one.'}));
                    setIsSubmitting(false);
                    return;
                }
                
                throw new Error("Failed to update username.");
            }

            // Refresh user data in AuthProvider to get updated username
            console.log('[CreateProfile] Refreshing user data after username update');
            await refreshUserData();

            console.log('[CreateProfile] Inserting profile data...');
            console.log('[CreateProfile] Form data state:', formData);
            const profileData = {
                name: formData.name,
                birthdate: formData.birthdate,
                aboutme: formData.aboutme,
                profilepicture: uploadData?.path,
                user_id: user?.id,
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
            console.log('[CreateProfile] Profile data to insert:', { ...profileData, profilepicture: profileData.profilepicture ? 'exists' : 'missing' });
            
            const { error: profileError } = await supabase
                .from('UserProfile')
                .insert(profileData);
    
            if (profileError) {
                console.error('[CreateProfile] Failed to insert profile:', profileError);
                console.error('[CreateProfile] Profile error details:', JSON.stringify(profileError, null, 2));
                throw new Error('Unable to create profile. Please try again.');
            }
            
            console.log('[CreateProfile] Profile created successfully!');
    
            // Invalidate user cache to ensure fresh data
            await invalidateUserCache(user?.id);
            console.log('[CreateProfile] User cache invalidated');
    
            router.replace('/(tabs)/profile');
        } catch (error: any) {
            console.error('[CreateProfile] An error occurred:', error?.message ?? String(error));
            console.error('[CreateProfile] Full error object:', error);
            setErrors(prev => ({...prev, general: 'Unable to create profile. Please try again.'}));
            setHasSubmitted(false); // Allow retry on error
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasValidationErrors = !!(errors.image || errors.username || errors.name || errors.aboutme || errors.birthdate);
    const isButtonDisabled = isSubmitting || hasValidationErrors || isCheckingUsername || !tosConfirmed;

    return (
        <SafeAreaView style={{ flex: 1, minHeight: '100%', backgroundColor: 'white'}}>
            <KeyboardAwareScrollView
                ref={scrollViewRef}
                style={styles.container}
                contentContainerStyle={styles.content}
                enableOnAndroid={true}
                extraScrollHeight={50}
                keyboardShouldPersistTaps="handled"
                enableAutomaticScroll={true}
                scrollEnabled={true}
                bounces={false}
                enableResetScrollToCoords={false}
                scrollToOverflowEnabled={true}
                keyboardOpeningTime={0}
                extraHeight={50}
            >
                <View style={styles.content}>
                    <Text style={styles.title}>Create Your Profile</Text>

                    {errors.general && (
                        <Text style={styles.generalError}>{errors.general}</Text>
                    )}

                    <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
                        {image ? (
                            <Image source={{ uri: image }} style={styles.profileImage} />
                        ) : (
                            <View style={[styles.placeholderContainer, errors.image && styles.errorBorder]}>
                                <Ionicons name="camera" size={40} color="#9CA3AF" />
                                <Text style={styles.uploadText}>Upload Photo</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    {errors.image && <Text style={styles.errorText}>{errors.image}</Text>}

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Username</Text>
                        <TextInput
                            style={[styles.input, errors.username && styles.inputError]}
                            value={formData.username}
                            onChangeText={(text) => {
                                setFormData(prev => ({ ...prev, username: text }));
                                setErrors(prev => ({ ...prev, username: '' }));
                            }}
                            onBlur={() => checkUsername(formData.username)}
                            placeholder="Enter your username"
                            placeholderTextColor="#9CA3AF"
                        />
                        {isCheckingUsername && (
                            <Text style={styles.checkingText}>Checking username availability...</Text>
                        )}
                        {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
                        <View style={styles.separator} />
                    </View>

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
                        <Text style={styles.label}>Birthdate</Text>
                        <DateTimePicker
                            value={formData.birthdate}
                            mode="date"
                            onChange={onDateChange}
                            maximumDate={new Date()}
                            minimumDate={new Date(1900, 0, 1)}
                            textColor="#111827"
                            themeVariant="light"
                            style={{backgroundColor: 'white', marginLeft: -20}}
                        />
                        {errors.birthdate && <Text style={styles.errorText}>{errors.birthdate}</Text>}
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
                        style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}
                        onPress={() => setTosConfirmed(!tosConfirmed)}
                        activeOpacity={0.6}
                    >
                        <Ionicons
                            name={tosConfirmed ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={tosConfirmed ? '#007C7B' : '#9CA3AF'}
                            style={{ marginTop: 1 }}
                        />
                        <Text style={{ marginLeft: 8, color: '#4B5563', fontSize: 13, flex: 1, lineHeight: 20 }}>
                            I confirm I am 18 years or older and agree to the{' '}
                            <Text style={{ color: '#3B82F6' }} onPress={() => WebBrowser.openBrowserAsync('https://s2-delta-tan.vercel.app/terms', { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })}>
                                Terms of Service
                            </Text>{' '}
                            and{' '}
                            <Text style={{ color: '#3B82F6' }} onPress={() => WebBrowser.openBrowserAsync('https://s2-delta-tan.vercel.app/privacy', { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })}>
                                Privacy Policy
                            </Text>
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.button,
                            isButtonDisabled && styles.buttonDisabled
                        ]}
                        onPress={handleSubmit}
                        disabled={isButtonDisabled}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.buttonText}>Create Profile</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAwareScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    content: {
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 30,
        color: '#111827',
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
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadText: {
        marginTop: 8,
        fontSize: 14,
        color: '#6B7280',
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
        color: '#374151',
    },
    input: {
        fontSize: 16,
        color: '#111827',
        paddingVertical: 12,
        paddingHorizontal: 0,
    },
    separator: {
        height: 1,
        backgroundColor: '#E5E7EB',
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
        color: '#6B7280',
    },
    textArea: {
        minHeight: 100,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    button: {
        backgroundColor: '#007C7B',
        padding: 16,
        borderRadius: 8,
        marginTop: 10,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: 'white',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
    },
    errorText: {
        color: '#dc2626',
        fontSize: 12,
        marginTop: 4,
    },
    generalError: {
        color: '#dc2626',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 10,
        padding: 10,
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
    },
    inputError: {
        borderColor: '#dc2626',
    },
    errorBorder: {
        borderWidth: 1,
        borderColor: '#dc2626',
    },
    checkingText: {
        color: '#6B7280',
        fontSize: 12,
        marginTop: 4,
        fontStyle: 'italic',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 15,
        color: '#111827',
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
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    tagSelected: {
        backgroundColor: '#007C7B',
        borderColor: '#007C7B',
    },
    tagText: {
        fontSize: 14,
        color: '#374151',
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
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    optionButtonSelected: {
        backgroundColor: '#CCFBF1',
        borderColor: '#007C7B',
    },
    optionText: {
        fontSize: 14,
        color: '#374151',
    },
    optionTextSelected: {
        color: '#007C7B',
        fontWeight: '500',
    },
    helperText: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 12,
    },
    optionalLabel: {
        fontSize: 14,
        fontWeight: '400' as const,
        color: '#9CA3AF',
    },
});

export default CreateProfileScreen;