import { Video, ResizeMode } from 'expo-av';
import { StyleSheet, View, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, useRef } from 'react';
import { TextOverlayManager } from './textOverlayManager';

interface PreviewMediaProps {
  uri: string;
  cameraMode: boolean;
  onDelete: () => void;
  onSave: (isMuted?: boolean, textOverlays?: any[]) => void;
  isUploading: boolean;
  containerWidth: number;  // Fixed 9:16 container width
  containerHeight: number; // Fixed 9:16 container height
}

export default function PreviewMedia({
  uri,
  cameraMode,
  onDelete,
  onSave,
  isUploading,
  containerWidth,
  containerHeight
}: PreviewMediaProps) {
  if (!uri) return <View style={styles.previewContainer} />;
  
  const videoRef = useRef<Video>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [textOverlays, setTextOverlays] = useState<any[]>([]);

  return (
    <View style={[styles.previewContainer, { width: containerWidth, height: containerHeight }]}>
      {/* Top Controls Bar */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 24,
        zIndex: 2
      }}>
        <TouchableOpacity 
          onPress={onDelete}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        
        {!cameraMode && (
          <TouchableOpacity 
            onPress={() => setIsMuted(!isMuted)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: isMuted ? '#007C7B' : 'rgba(0, 0, 0, 0.4)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons
              name={isMuted ? "volume-mute" : "volume-high"}
              size={24}
              color="white"
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Media preview - uses cover within fixed 9:16 container */}
      <View style={styles.mediaContainer}>
        {cameraMode ? (
          <Image
            source={{ uri }}
            style={styles.preview}
            resizeMode="cover"
          />
        ) : (
          <Video
            ref={videoRef}
            source={{ uri }}
            style={styles.preview}
            useNativeControls={false}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isMuted={isMuted}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && status.didJustFinish) {
                videoRef.current?.replayAsync();
              }
            }}
          />
        )}
      </View>

      {/* Bottom Action Buttons */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 40,
        paddingHorizontal: 20,
        zIndex: 2,
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <TouchableOpacity
            onPress={() => onSave(isMuted, textOverlays)}
            disabled={isUploading}
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#007C7B',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: isUploading ? 0.6 : 1,
            }}
          >
            {isUploading ? (
              <ActivityIndicator size="large" color="white" />
            ) : (
              <Ionicons name="checkmark" size={48} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ... styles remain the same

const styles = StyleSheet.create({
  previewContainer: {
    backgroundColor: 'black',
    overflow: 'hidden',
    borderRadius: 24,
  },
  mediaContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  preview: {
    flex: 1,
    backgroundColor: 'black',
  },
});