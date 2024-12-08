import RecordingProgress from '@/components/recordingProgress';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isRecording, setIsRecording] = useState(false)
  const cameraRef = useRef<CameraView>(null);
  const [cameraMode, setCameraMode] = useState(true)
  const [elapsedTime, setElapsedTime] = useState(0);

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
        console.log(video?.uri);
      } finally {
        setIsRecording(false); // This ensures isRecording is set to false after recording
      }
    }
    

  };

  const takePicture = async () => {
    const picture = await cameraRef.current?.takePictureAsync();
    console.log(picture?.uri)

  }

  return ((cameraMode? (<CameraView mode="picture" ref={cameraRef} style={{ flex: 1}} facing={facing}>
    <View className='flex-1 justify-end'>
    <View className='flex-row items-center justify-around mb-10'>
    <TouchableOpacity className='items-end justify-end' onPress={()=> setCameraMode(false)}>
        <Ionicons name='videocam' size={50} color="white"/>
      </TouchableOpacity>
    <TouchableOpacity className='items-end justify-end' onPress={()=> takePicture()}>
        <Ionicons name='radio-button-on' size={100} color="white"/>
      </TouchableOpacity>
      <TouchableOpacity className='items-end justify-end' onPress={toggleCameraFacing}>
        <Ionicons name='camera-reverse' size={50} color="white"/>
      </TouchableOpacity>
      </View>
    </View>
  </CameraView>): (<CameraView mode="video" ref={cameraRef} style={{ flex: 1}} facing={facing}>
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
        <TouchableOpacity className='items-end justify-end' onPress={()=> setCameraMode(true)} disabled={isRecording} style={{ opacity: isRecording ? 0.5 : 1 }}>
            <Ionicons name='camera' size={50} color="white"/>
          </TouchableOpacity>
          <View style={{ position: 'relative' }}>
          <RecordingProgress 
          isRecording={isRecording}
          size={100}
          maxDuration={5000} 
        />
        <TouchableOpacity className='items-end justify-end' onPress={()=> recordVideo()}>
            {!isRecording?<Ionicons name='radio-button-on' size={100} color="red"/>:<Ionicons name='stop-circle-outline' size={100} color="red"/> }
          </TouchableOpacity>
          </View>
          <TouchableOpacity className='items-end justify-end' onPress={toggleCameraFacing} disabled={isRecording} style={{ opacity: isRecording ? 0.5 : 1 }}>
            <Ionicons name='camera-reverse' size={50} color="white"/>
          </TouchableOpacity>
          </View>
        </View>
      </CameraView>)
      
  ));
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
