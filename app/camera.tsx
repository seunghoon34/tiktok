import PreviewMedia from '@/components/previewMedia';
import RecordingProgress from '@/components/recordingProgress';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import { feedCache } from '@/utils/feedCache';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, CameraType, useCameraPermissions, FlashMode } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';

// Fixed 9:16 aspect ratio for consistent cross-device display (like Snapchat/Instagram)
const ASPECT_RATIO = 9 / 16;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Calculate container dimensions to fit 9:16 ratio within screen
const getMediaContainerDimensions = () => {
  const screenRatio = SCREEN_WIDTH / SCREEN_HEIGHT;
  
  if (screenRatio > ASPECT_RATIO) {
    // Screen is wider than 9:16, fit by height
    return {
      width: SCREEN_HEIGHT * ASPECT_RATIO,
      height: SCREEN_HEIGHT,
    };
  } else {
    // Screen is taller than 9:16, fit by width
    return {
      width: SCREEN_WIDTH,
      height: SCREEN_WIDTH / ASPECT_RATIO,
    };
  }
};

const MEDIA_CONTAINER = getMediaContainerDimensions();

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isRecording, setIsRecording] = useState(false)
  const cameraRef = useRef<CameraView>(null);
  const [cameraMode, setCameraMode] = useState(true)
  const [elapsedTime, setElapsedTime] = useState(0);
  const [uri, setUri] = useState("")
  const { user } = useAuth() 
  const router = useRouter()
  const [isUploading, setIsUploading] = useState(false);
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [isTorchOn, setIsTorchOn] = useState(false);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isRecording) {
      setElapsedTime(0); // Reset timer when starting recording
          intervalId = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000) as any;
    } else {
      setElapsedTime(0); // Reset timer when stopping
    }
  
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRecording]);

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const recordVideo = async () => {
    if (isRecording) {
      setIsRecording(false);
      cameraRef.current?.stopRecording();
    } else {
      setIsRecording(true);
      setIsTorchOn(true)
      try {
        const video = await cameraRef.current?.recordAsync({
          maxDuration: 5, // in seconds
        });
        setUri(video?.uri || "");
      } finally {
        setIsRecording(false);
        setIsTorchOn(false)

      }
    }
  };


  const saveUri = async (isMuted: boolean = false, textOverlays: any[] = []) => {
    setIsUploading(true);
    try {
      // Determine if it's a video or image based on camera mode
      const fileExt = uri?.split('.').pop()?.toLowerCase();
      const isVideo = !cameraMode || fileExt === 'mov' || fileExt === 'mp4';
      
      // Upload media file
      const formData = new FormData;
      const fileName = uri?.split('/').pop()
      formData.append('file', {
        uri: uri,
        type: isVideo ? `video/${fileExt}` : `image/${fileExt}`,
        name: fileName,
      } as any);
      
      const { data, error } = await supabase.storage
        .from('videos') // Using same bucket for both videos and images
        .upload(fileName || "", formData, {
          cacheControl: '3600000000',
          upsert: false
        });
      
      if(error) throw error;
  
      // Insert media record and get its ID
      const { data: videoData, error: videoError } = await supabase
        .from('Video')
        .insert({
          title: "test_title",
          uri: data?.path,
          user_id: user?.id,
          is_muted: isVideo ? isMuted : false, // Images don't have mute state
        })
        .select()
        .single();
  
      if(videoError) throw videoError;
  
      // Save text overlays
      // TODO: Text overlay feature temporarily disabled
      /*
      if (textOverlays.length > 0) {
        const { error: textError } = await supabase
          .from('TextOverlay')
          .insert(
            textOverlays.map(overlay => ({
              video_id: videoData.id,
              text: overlay.text,
              position_x: overlay.position_x,
              position_y: overlay.position_y,
              scale: overlay.scale,
              rotation: overlay.rotation,
              font_size: overlay.fontSize,
              media_width: overlay.media_width,
              media_height: overlay.media_height,
              screen_width: overlay.screen_width,
              screen_height: overlay.screen_height
            }))
          );
        if(textError) throw textError;
      }
      */

      // Invalidate user's story cache since we created a new story
      if (user?.id) {
        await feedCache.invalidateUserStories(user.id);
        console.log('[Camera] Invalidated user stories cache after creating new story');
      }
  
      router.back();
      setUri("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

const deleteUri = () =>{
    setUri("")
}

  const takePicture = async () => {
    const picture = await cameraRef.current?.takePictureAsync();
    setUri(picture?.uri || "");
  }

  const toggleFlash = () => {
   
      setFlashMode(current => current === 'off' ? 'on' : 'off');
    
  };

  return (
  <View style={{flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' } }>
    {uri ? (
      <PreviewMedia
        uri={uri}
        cameraMode={cameraMode}
        onDelete={deleteUri}
        onSave={saveUri}
        isUploading={isUploading}
        containerWidth={MEDIA_CONTAINER.width}
        containerHeight={MEDIA_CONTAINER.height}
      />
    ) : cameraMode ? (
      <View style={{ width: MEDIA_CONTAINER.width, height: MEDIA_CONTAINER.height, overflow: 'hidden', borderRadius: 24 }}>
      <CameraView mode="picture" ref={cameraRef} style={{ flex: 1}} facing={facing} mirror={facing === 'front'} flash={flashMode}>
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
          zIndex: 1
        }}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name='close' size={28} color="white"/>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={toggleFlash}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: flashMode === 'on' ? '#FF6B6B' : 'rgba(0, 0, 0, 0.4)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons 
              name={flashMode === 'off' ? 'flash-off' : 'flash'} 
              size={24} 
              color="white"
            />
          </TouchableOpacity>
        </View>
        
        {/* Bottom Controls */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: 40,
          paddingHorizontal: 20,
        }}>
          {/* Mode Indicator */}
          <View style={{
            alignItems: 'center',
            marginBottom: 20,
          }}>
            <View style={{
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
            }}>
              <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>PHOTO</Text>
            </View>
          </View>

          {/* Control Buttons */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <TouchableOpacity 
              onPress={() => setCameraMode(false)}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name='videocam' size={32} color="white"/>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => takePicture()}
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: 'white',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 4,
                borderColor: 'rgba(255, 255, 255, 0.3)',
              }}
            >
              <View style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: 'white',
              }} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={toggleCameraFacing}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name='camera-reverse' size={32} color="white"/>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
      </View>
    ) : (
      <View style={{ width: MEDIA_CONTAINER.width, height: MEDIA_CONTAINER.height, overflow: 'hidden', borderRadius: 24 }}>
      <CameraView mode="video" ref={cameraRef} style={{ flex: 1}} facing={facing} mirror={facing === 'front'} enableTorch={isTorchOn && flashMode == 'on'}>
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
          zIndex: 1
        }}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name='close' size={28} color="white"/>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={toggleFlash}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: flashMode === 'on' ? '#FF6B6B' : 'rgba(0, 0, 0, 0.4)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons 
              name={flashMode === 'off' ? 'flash-off' : 'flash'} 
              size={24} 
              color="white"
            />
          </TouchableOpacity>
        </View>

        {/* Recording Timer */}
        {isRecording && (
          <View style={{
            position: 'absolute',
            top: 24,
            width: '100%',
            alignItems: 'center',
            zIndex: 1
          }}>
            <View style={{
              backgroundColor: '#FF6B6B',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}>
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: 'white',
              }} />
              <Text style={{
                color: 'white',
                fontSize: 16,
                fontWeight: 'bold'
              }}>
                {formatTime(elapsedTime)}
              </Text>
            </View>
          </View>
        )}

        {/* Flash Overlay for Front Camera */}
        {facing === 'front' && flashMode == "on" && isRecording && (
          <View 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#E8F0FF',
              opacity: 0.5,
              zIndex: 999
            }}
            pointerEvents="none"
          />
        )}

        {/* Bottom Controls */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: 40,
          paddingHorizontal: 20,
        }}>
          {/* Mode Indicator */}
          <View style={{
            alignItems: 'center',
            marginBottom: 20,
          }}>
            <View style={{
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
            }}>
              <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>VIDEO</Text>
            </View>
          </View>

          {/* Control Buttons */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <TouchableOpacity 
              onPress={() => setCameraMode(true)} 
              disabled={isRecording}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: isRecording ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.4)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name='camera' size={32} color="white"/>
            </TouchableOpacity>
            
            <View style={{ 
              position: 'relative',
              width: 80,
              height: 80,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <RecordingProgress
                isRecording={isRecording}
                size={80}
                maxDuration={5000}
              />
              <TouchableOpacity
                onPress={recordVideo}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  justifyContent: 'center',
                  alignItems: 'center',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              >
                {!isRecording ? (
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: '#FF6B6B',
                    borderWidth: 4,
                    borderColor: 'white',
                  }} />
                ) : (
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    backgroundColor: '#FF6B6B',
                  }} />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              onPress={toggleCameraFacing} 
              disabled={isRecording}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: isRecording ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.4)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name='camera-reverse' size={32} color="white"/>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
      </View>
    )}
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 64,
  },
  button: {
    flex: 1,
    alignSelf: 'flex-end',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
});
