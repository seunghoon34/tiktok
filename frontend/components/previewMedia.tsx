import { Video, ResizeMode } from 'expo-av';
import { StyleSheet, View, Image, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface PreviewMediaProps {
  uri: string;
  cameraMode: boolean;
  onDelete: () => void;
  onSave: () => void;
}

export default function PreviewMedia({ 
  uri, 
  cameraMode, 
  onDelete, 
  onSave 
}: PreviewMediaProps) {
  if (!uri) return <View style={styles.previewContainer} />;
  
  return (
    <View style={styles.previewContainer}>
      {/* Close button in top-left corner */}
      <View style={styles.closeButtonContainer}>
        <TouchableOpacity onPress={onDelete}>
          <Ionicons name="close-circle" size={40} color="white" />
        </TouchableOpacity>
      </View>

      {/* Media preview */}
      <View style={styles.mediaContainer}>
        {cameraMode ? (
          <Image 
            source={{ uri }} 
            style={styles.preview}
            resizeMode="contain"
          />
        ) : (
          <Video
            source={{ uri }}
            style={styles.preview}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay
          />
        )}
      </View>

      {/* Save button centered at bottom */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity onPress={onSave} style={styles.saveButton}>
          <Ionicons name="checkmark-circle-outline" size={100} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  closeButtonContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 2,
  },
  mediaContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  preview: {
    flex: 1,
    backgroundColor: 'black',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
    zIndex: 2,
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});