import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isRecording, setIsRecording] = useState(false)
  const cameraRef = useRef<CameraView>(null);
  const [cameraMode, setCameraMode] = useState(true)

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

  const recordVideo = async () =>{
    if(isRecording){
        setIsRecording(false);
        cameraRef.current?.stopRecording();
    }else {
        setIsRecording(true)
        const video = await cameraRef.current?.recordAsync();
        console.log(video?.uri)

    }
  }

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
        <View className='flex-1 justify-end'>
        <View className='flex-row items-center justify-around mb-10'>
        <TouchableOpacity className='items-end justify-end' onPress={()=> setCameraMode(true)}>
            <Ionicons name='camera' size={50} color="white"/>
          </TouchableOpacity>
        <TouchableOpacity className='items-end justify-end' onPress={()=> recordVideo()}>
            {!isRecording?<Ionicons name='radio-button-on' size={100} color="red"/>:<Ionicons name='stop-circle-outline' size={100} color="red"/> }
          </TouchableOpacity>
          <TouchableOpacity className='items-end justify-end' onPress={toggleCameraFacing}>
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
