import { Video, ResizeMode } from 'expo-av';
import { StyleSheet, View, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { TextOverlayManager } from './textOverlayManager';

interface PreviewMediaProps {
  uri: string;
  cameraMode: boolean;
  onDelete: () => void;
  onSave: (isMuted?: boolean, textOverlays?: any[]) => void; // Updated this
  isUploading: boolean;
}

export default function PreviewMedia({
  uri,
  cameraMode,
  onDelete,
  onSave,
  isUploading
}: PreviewMediaProps) {
  if (!uri) return <View style={styles.previewContainer} />;
  
  const [isMuted, setIsMuted] = useState(false);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [textOverlays, setTextOverlays] = useState<any[]>([]); // Added type

  return (
    <View style={styles.previewContainer}>
      {/* Close button in top-left corner */}
      <View style={styles.closeButtonContainer}>
        <TouchableOpacity onPress={onDelete}>
          <Ionicons name="close-circle" size={40} color="white" />
        </TouchableOpacity>
      </View>

      {!cameraMode && (
        <View style={styles.muteButtonContainer}>
          <TouchableOpacity onPress={() => setIsMuted(!isMuted)}>
            <Ionicons
              name={isMuted ? "volume-mute" : "volume-high"}
              size={40}
              color="white"
            />
          </TouchableOpacity>
        </View>
      )}

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
            useNativeControls={false}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay
            isMuted={isMuted}
          />
        )}
      </View>

      <TextOverlayManager
        onDragStateChange={setIsDraggingText}
        onOverlaysUpdate={setTextOverlays}
        video={!cameraMode}
      />

      {/* Save button centered at bottom */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          onPress={() => onSave(isMuted, textOverlays)}
          style={styles.saveButton}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="large" color="white" />
          ) : isDraggingText ? (
            <Ionicons name="trash-outline" size={100} color="white" />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={100} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ... styles remain the same

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
  muteButtonContainer: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 2,
  },
});