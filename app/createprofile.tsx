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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { supabase } from '@/utils/supabase';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import * as ImageManipulator from 'expo-image-manipulator';

const CreateProfileScreen = () => {
    const [image, setImage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [errors, setErrors] = useState({
        image: '',
        username: '',
        name: '',
        aboutme: ''
    });

    const scrollViewRef = useRef(null);
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        username: '',
        name: '',
        birthdate: new Date(),
        aboutme: '',
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

    const onDateChange = (event, selectedDate) => {
        if (selectedDate) {
            setFormData(prev => ({ ...prev, birthdate: selectedDate }));
        }
    };

    const validateForm = () => {
        const newErrors = {
            image: !image ? 'Profile picture is required' : '',
            username: !formData.username.trim() ? 'Username is required' : '',
            name: !formData.name.trim() ? 'Name is required' : '',
            aboutme: !formData.aboutme.trim() ? 'About me is required' : ''
        };

        setErrors(newErrors);
        return !Object.values(newErrors).some(error => error !== '');
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        const isUsernameAvailable = await checkUsername(formData.username);
        if (!isUsernameAvailable) {
            return;
        }

        setIsSubmitting(true);

        try {
            if (!image) {
                throw new Error("Please select an image");
            }

            const compressed = await ImageManipulator.manipulateAsync(
                image,
                [{ resize: { width: 800 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );

            const fileName = `${user?.id}-${Date.now()}.jpg`;

            const file = {
                type: 'image/jpeg',
                name: fileName,
                uri: compressed.uri
            };
    
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, {
                    cacheControl: '3600000000',
                    upsert: false
                });
    
            if (uploadError) {
                console.error("File upload failed:", uploadError.message);
                throw new Error("Failed to upload the profile picture.");
            }
    
            const { error: userError } = await supabase
                .from('User')
                .update({ username: formData.username })
                .eq('id', user?.id);

            if (userError) {
                console.error("Failed to update username:", userError.message);
                throw new Error("Failed to update username.");
            }

            const { error: profileError } = await supabase
                .from('UserProfile')
                .insert({
                    name: formData.name,
                    birthdate: formData.birthdate,
                    aboutme: formData.aboutme,
                    profilepicture: uploadData?.path,
                    user_id: user?.id
                });
    
            if (profileError) {
                console.error("Failed to insert profile:", profileError.message);
                throw new Error("Failed to save user profile.");
            }
    
            router.push('/(tabs)/profile');
        } catch (error) {
            console.error("An error occurred:", error.message);
            setErrors(prev => ({...prev, general: error.message}));
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasErrors = Object.values(errors).some(error => error !== '');
    const isButtonDisabled = isSubmitting || hasErrors || isCheckingUsername;

    return (
        <SafeAreaView style={{ flex: 1, minHeight: '100%', backgroundColor: 'white'}}>
            <KeyboardAwareScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                enableOnAndroid={true}
                extraScrollHeight={10}
                keyboardShouldPersistTaps="handled"
                enableAutomaticScroll={true}
                scrollEnabled={true}
                bounces={false}
                enableResetScrollToCoords={false}
                scrollToOverflowEnabled={true}
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
                        <View style={styles.separator} />
                    </View>

                    <View style={styles.formGroup}>
                        <View style={styles.aboutMeHeader}>
                            <Text style={styles.label}>About Me</Text>
                            <Text style={styles.characterCount}>{formData.aboutme.length}/150</Text>
                        </View>
                        <TextInput
                            style={[styles.input, styles.textArea, errors.aboutme && styles.inputError]}
                            value={formData.aboutme}
                            onChangeText={(text) => {
                                if (text.length <= 150) {
                                    setFormData(prev => ({ ...prev, aboutme: text }));
                                    setErrors(prev => ({ ...prev, aboutme: '' }));
                                }
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
        backgroundColor: '#ff5757',
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
});

export default CreateProfileScreen;