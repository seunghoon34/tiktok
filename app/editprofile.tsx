import React, { useRef, useState, useEffect } from 'react';
import {
 View,
 Text,
 TextInput,
 TouchableOpacity,
 StyleSheet,
 Image,
 SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { supabase } from '@/utils/supabase';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import * as ImageManipulator from 'expo-image-manipulator';
import Header from '@/components/header';

const EditProfileScreen = () => {
 const [image, setImage] = useState(null);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const { user } = useAuth();
 const [formData, setFormData] = useState({
   name: '',
   birthdate: new Date(),
   aboutme: '',
 });

 useEffect(() => {
   const getProfile = async () => {
     const { data, error } = await supabase
       .from('UserProfile')
       .select('*')
       .eq('user_id', user?.id)
       .single();

     if (data) {
       setFormData({
         name: data.name,
         birthdate: new Date(data.birthdate),
         aboutme: data.aboutme,
       });

       if (data.profilepicture) {
         const { data: urlData } = await supabase.storage
           .from('avatars')
           .createSignedUrl(data.profilepicture, 3600);
         if (urlData) {
           setImage(urlData.signedUrl);
         }
       }
     }
   };

   getProfile();
 }, []);

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
   }
 };

 const onDateChange = (event, selectedDate) => {
   if (selectedDate) {
     setFormData(prev => ({ ...prev, birthdate: selectedDate }));
   }
 };

 const handleSubmit = async () => {
   setIsSubmitting(true);
   try {
     let profilePicturePath = null;

     if (image && !image.startsWith('http')) {
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
           upsert: true
         });

       if (uploadError) throw uploadError;
       profilePicturePath = uploadData?.path;
     }

     const updateData = {
       name: formData.name,
       birthdate: formData.birthdate,
       aboutme: formData.aboutme,
     };

     if (profilePicturePath) {
       updateData.profilepicture = profilePicturePath;
     }

     const { error: profileError } = await supabase
       .from('UserProfile')
       .update(updateData)
       .eq('user_id', user?.id);

     if (profileError) throw profileError;

    

     router.back();
   } catch (error) {
     console.error(error);
     alert('Error updating profile');
   } finally {
     setIsSubmitting(false);
   }
 };

 return (
   <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
     <KeyboardAwareScrollView
       style={styles.container}
       contentContainerStyle={styles.content}
       enableOnAndroid={true}
     >
      <Header title='' color={'black'} goBack={true}/>
       <View style={styles.content}>
         <Text style={styles.title}>Edit Profile</Text>

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
             style={styles.input}
             value={formData.name}
             onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
             placeholder="Enter your full name"
             placeholderTextColor="#9CA3AF"
           />
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
             style={[styles.input, styles.textArea]}
             value={formData.aboutme}
             onChangeText={(text) => {
               if (text.length <= 150) {
                 setFormData(prev => ({ ...prev, aboutme: text }));
               }
             }}
             placeholder="Tell us about yourself..."
             placeholderTextColor="#9CA3AF"
             multiline
             numberOfLines={4}
             textAlignVertical="top"
             maxLength={150}
           />
         </View>

         <TouchableOpacity 
           style={[styles.button, isSubmitting && styles.buttonDisabled]}
           onPress={handleSubmit}
           disabled={isSubmitting}
         >
           <Text style={styles.buttonText}>
             {isSubmitting ? "Saving..." : "Save Changes"}
           </Text>
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
      paddingHorizontal: 10,
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
  buttonText: {
      color: 'white',
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '600',
  },
  buttonDisabled: {
      backgroundColor: '#ff5757',
    }
  });

export default EditProfileScreen;