import PreviewMedia from '@/components/previewMedia';
import RecordingProgress from '@/components/recordingProgress';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/utils/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
      }, 1000);
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
      try {
        const video = await cameraRef.current?.recordAsync({
          maxDuration: 5 // in seconds
        });
        setUri(video?.uri);

      } finally {
        

        setIsRecording(false); // This ensures isRecording is set to false after recording
      }
    }

    

  };


  const saveUri = async () =>{
    const formData = new FormData;
    const fileName = uri?.split('/').pop()
    formData.append('file',{
        uri: uri,
        type: `video/${fileName?.split('.').pop()}`,
        name: fileName,
    });
    const { data, error } = await supabase.storage.from('videos').upload(fileName, formData, {
        cacheControl: '3600000000',
        upsert: false
    });
    if(error) console.error(error);
    const { error: videoError } = await supabase.from('Video').insert({
        title: "test_title",
        uri: data?.path,
        user_id: user?.id
    })
    if(videoError) console.error(videoError)
    router.back()
    setUri("");


}

const deleteUri = () =>{
    setUri("")
}

  const takePicture = async () => {
    const picture = await cameraRef.current?.takePictureAsync();
    setUri(picture?.uri);



  }

  return (
  <View style={{flex: 1, backgroundColor: 'black' } }>
    {uri ? (
      <PreviewMedia
        uri={uri}
        cameraMode={cameraMode}
        onDelete={deleteUri}
        onSave={saveUri}
      />
    ) : cameraMode ? (
      <CameraView mode="picture" ref={cameraRef} style={{ flex: 1}} facing={facing} mirror={facing === 'front'}>
        <View style={StyleSheet.create({
          deleteContainer: {
            position: 'absolute',
            top: 40,
            left: 20,
            zIndex: 1
          }
        }).deleteContainer}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name='close-circle' size={40} color="white"/>
          </TouchableOpacity>
        </View>
        
        <View className='flex-1 justify-end'>
          <View className='flex-row items-center justify-around mb-10'>
            <TouchableOpacity className='items-end justify-end' onPress={() => setCameraMode(false)}>
              <Ionicons name='videocam' size={50} color="white"/>
            </TouchableOpacity>
            
            <TouchableOpacity className='items-end justify-end' onPress={() => takePicture()}>
              <Ionicons name='radio-button-on' size={100} color="white"/>
            </TouchableOpacity>
            
            <TouchableOpacity className='items-end justify-end' onPress={toggleCameraFacing}>
              <Ionicons name='camera-reverse' size={50} color="white"/>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    ) : (
      <CameraView mode="video" ref={cameraRef} style={{ flex: 1}} facing={facing} mirror={facing === 'front'}>
        <View style={StyleSheet.create({
          deleteContainer: {
            position: 'absolute',
            top: 40,
            left: 20,
            zIndex: 1
          }
        }).deleteContainer}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name='close-circle' size={40} color="white"/>
          </TouchableOpacity>
        </View>

        {isRecording && (
          <View style={StyleSheet.create({
            timerContainer: {
              position: 'absolute',
              top: 60,
              width: '100%',
              alignItems: 'center',
              zIndex: 1
            }
          }).timerContainer}>
            <Text style={StyleSheet.create({
              timerText: {
                color: 'white',
                fontSize: 20,
                fontWeight: 'bold'
              }
            }).timerText}>
              {formatTime(elapsedTime)}
            </Text>
          </View>
        )}

        <View className='flex-1 justify-end'>
          <View className='flex-row items-center justify-around mb-10'>
            <TouchableOpacity 
              className='items-end justify-end' 
              onPress={() => setCameraMode(true)} 
              disabled={isRecording} 
              style={{ opacity: isRecording ? 0.5 : 1 }}
            >
              <Ionicons name='camera' size={50} color="white"/>
            </TouchableOpacity>
            
            <View style={{ position: 'relative' }}>
              <RecordingProgress
                isRecording={isRecording}
                size={100}
                maxDuration={5000}
              />
              <TouchableOpacity
                className='items-end justify-end'
                onPress={recordVideo}
              >
                {!isRecording ? (
                  <Ionicons name='radio-button-on' size={100} color="red"/>
                ) : (
                  <Ionicons name='stop-circle-outline' size={100} color="red"/>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              className='items-end justify-end' 
              onPress={toggleCameraFacing} 
              disabled={isRecording} 
              style={{ opacity: isRecording ? 0.5 : 1 }}
            >
              <Ionicons name='camera-reverse' size={50} color="white"/>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
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
