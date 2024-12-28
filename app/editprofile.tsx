import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';


const CreateProfileScreen = () => {
  const [image, setImage] = useState(null);
  const scrollViewRef = useRef(null);
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    birthdate: new Date(),
    aboutme: '',
  });

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
      setImage(result.assets[0].uri);
    }
  };

  const onDateChange = (event, selectedDate) => {
    if (selectedDate) {
      setFormData(prev => ({ ...prev, birthdate: selectedDate }));
    }
  };

  const handleSubmit = () => {
    console.log('Form submitted:', { ...formData, image });
  };

  return (
    <SafeAreaView style={{ flex: 1, minHeight: '100%', backgroundColor: 'white'}}>

<KeyboardAwareScrollView
  style={styles.container}
  contentContainerStyle={styles.content}
  enableOnAndroid={true}
  extraScrollHeight={10}  // Increased from 150
  keyboardShouldPersistTaps="handled"
  enableAutomaticScroll={true}
  scrollEnabled={true}     // Add this
  bounces={false}         // Add this
  enableResetScrollToCoords={false}  // Add this
  scrollToOverflowEnabled={true}     // Add this
 
>
        <View style={styles.content}>
          <Text style={styles.title}>Edit Your Profile</Text>

          {/* Profile Picture */}
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

          {/* Form Fields */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={formData.username}
              onChangeText={(text) => setFormData(prev => ({ ...prev, username: text }))}
              placeholder="Enter your username"
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.separator} />
          </View>

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
            style={styles.button}
            onPress={handleSubmit}
            
          >
            <Text style={styles.buttonText}>Create Profile</Text>
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
    backgroundColor: '#3B82F6',
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
});

export default CreateProfileScreen;