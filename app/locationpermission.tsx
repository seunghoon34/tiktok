import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { requestLocationPermission } from '@/utils/location';

export default function LocationPermissionScreen() {
  const router = useRouter();

  const handleRequestPermission = async () => {
    const granted = await requestLocationPermission();
    
    if (granted) {
      // Permission granted, go back to feed
      router.back();
    } else {
      // Still denied, prompt to open settings
      console.log('[LocationPermission] Permission still denied');
    }
  };

  const handleOpenSettings = () => {
    // Open app settings
    Linking.openSettings();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="location" size={80} color="#007C7B" />
        </View>

        {/* Title */}
        <Text style={styles.title}>Location Required</Text>

        {/* Description */}
        <Text style={styles.description}>
          We need your location to show you nearby stories from other users in your area.
        </Text>

        <Text style={styles.subdescription}>
          Your exact location is never shared with other users.
        </Text>

        {/* Buttons */}
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={handleRequestPermission}
        >
          <Ionicons name="location-outline" size={24} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.primaryButtonText}>Enable Location</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={handleOpenSettings}
        >
          <Ionicons name="settings-outline" size={20} color="#007C7B" style={{ marginRight: 8 }} />
          <Text style={styles.secondaryButtonText}>Open Settings</Text>
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            Location is only used to find stories near you. We don't track your movements.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  subdescription: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
    fontStyle: 'italic',
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#007C7B',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#007C7B',
    width: '100%',
    marginBottom: 24,
  },
  secondaryButtonText: {
    color: '#007C7B',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
    marginTop: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 12,
    lineHeight: 18,
  },
});
