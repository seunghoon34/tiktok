import { StyleSheet, View, TextInput, TouchableOpacity, Dimensions, PixelRatio, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { ComposedGesture, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';

const normalizeFont = (size: number) => {
    const scale = scaleFactor;
    const newSize = size * scale;
    if (Platform.OS === 'ios') {
      return Math.round(PixelRatio.roundToNearestPixel(newSize));
    }
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  };


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_SCREEN_WIDTH = 393;
const BASE_SCREEN_HEIGHT = 852;
const INITIAL_FONT_SIZE = 50;

const widthScaleFactor = SCREEN_WIDTH / BASE_SCREEN_WIDTH;
const heightScaleFactor = SCREEN_HEIGHT / BASE_SCREEN_HEIGHT;
const scaleFactor = Math.min(widthScaleFactor, heightScaleFactor);

// Normalize font size based on screen size


interface BinPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DraggableTextProps {
  id: string;
  isEditing: boolean;
  onDelete: (id: string) => void;
  onEdit: () => void;
  onEditComplete: () => void;
  binPosition: BinPosition;
  onOverlayUpdate: (data: any) => void; // Add this

}

const DraggableText = ({
  id,
  isEditing,
  onDelete,
  onEdit,
  onEditComplete,
  binPosition,
  onDragStateChange,
  onOverlayUpdate,

}: DraggableTextProps & { onDragStateChange?: (isDragging: boolean) => void }) => {
  const [text, setText] = useState('');
  const [fontSize] = useState(INITIAL_FONT_SIZE);
  const [elementSize, setElementSize] = useState({ width: 0, height: 0 });

  // Animated values for transformations
  const translateX = useSharedValue((SCREEN_WIDTH * 0.25)); 
  const translateY = useSharedValue(SCREEN_HEIGHT * 0.5); 
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  // Context values for gesture handling
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);
  const contextScale = useSharedValue(1);
  const contextRotation = useSharedValue(0);


  const handleTransformUpdate = () => {
    const updateData = {
      id,
      text,
      position_x: (translateX.value / SCREEN_WIDTH) * 100,
      position_y: (translateY.value / SCREEN_HEIGHT) * 100,
      scale: scale.value * scaleFactor, // Adjust scale based on device
      rotation: rotation.value,
      fontSize: (INITIAL_FONT_SIZE / BASE_SCREEN_HEIGHT) * 100 // Use base height for percentage
    };
    onOverlayUpdate?.(updateData);
  };

  // Modify the useAnimatedReaction to include haptic feedback
  useAnimatedReaction(
    () => {
      const elementX = translateX.value;
      const elementY = translateY.value;

      const overlapsX = elementX + elementSize.width >= binPosition.x &&
        elementX <= binPosition.x + binPosition.width;
      const overlapsY = elementY + elementSize.height >= binPosition.y &&
        elementY <= binPosition.y + binPosition.height;

      return overlapsX && overlapsY;
    },
    (isOverlapping, previous) => {
      if (isOverlapping && !previous) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
      }
      if (isOverlapping) {
        runOnJS(onDelete)(id);
      }
    }
  );


  
  const handleBlur = () => {
    if (text.trim() === '') {
      onDelete(id);
    } else {
        runOnJS(handleTransformUpdate)(); // Add this to ensure initial position is saved

      onEditComplete();
    }
  };

  // Pan gesture for dragging
  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextX.value = translateX.value;
      contextY.value = translateY.value;
      runOnJS(onDragStateChange)(true);
      runOnJS(handleTransformUpdate)(); // Add this to ensure initial position is saved

    })
    .onUpdate((event) => {
      translateX.value = contextX.value + event.translationX;
      translateY.value = contextY.value + event.translationY;
      runOnJS(handleTransformUpdate)(); // Update here
    })
    .onEnd(() => {
      translateX.value = withSpring(translateX.value);
      translateY.value = withSpring(translateY.value);
      runOnJS(onDragStateChange)(false);
      runOnJS(handleTransformUpdate)(); // And here
    });


  // Pinch gesture for scaling
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      contextScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = contextScale.value * event.scale;
      runOnJS(handleTransformUpdate)();
    });

  const rotationGesture = Gesture.Rotation()
    .onStart(() => {
      contextRotation.value = rotation.value;
    })
    .onUpdate((event) => {
      rotation.value = contextRotation.value + event.rotation;
      runOnJS(handleTransformUpdate)();
    });

  // Single tap for editing
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      if (!isEditing) {
        runOnJS(onEdit)();
      }
    });

  // Combine all gestures
  const composed = Gesture.Simultaneous(
    Gesture.Exclusive(panGesture, tapGesture),
    Gesture.Simultaneous(pinchGesture, rotationGesture)
  ) as unknown as ComposedGesture;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value  },  // Match the percentage conversion
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}rad` },
    ],
  }));

 
  

  return (
    <GestureDetector gesture={isEditing ? Gesture.Exclusive() : composed}>
      <Animated.View
        style={[styles.textContainer, animatedStyle]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setElementSize({ width, height });
        }}
      >
        <View style={styles.textWrapper}>
          {isEditing ? (
            <TextInput
              value={text}
              onChangeText={(newText) => {
                setText(newText);
                handleTransformUpdate(); // Update when text changes
              }}              style={[styles.textInput, { fontSize }]}
              autoFocus
              multiline
              placeholder="Enter text"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              onBlur={handleBlur}
              
            />
          ) : (
            <Animated.Text style={[styles.text, { fontSize }]}>{text}</Animated.Text>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

interface TextOverlayManagerProps {
  containerStyle?: object;
  onDragStateChange?: (isDragging: boolean) => void;
  onOverlaysUpdate?: (overlays: any[]) => void; // Add this
  video?: boolean


}

export const TextOverlayManager = ({ containerStyle, onDragStateChange, onOverlaysUpdate, video  }: TextOverlayManagerProps) => {
  const [textElements, setTextElements] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [binPosition, setBinPosition] = useState<BinPosition>({ 
    x: 0, 
    y: SCREEN_HEIGHT - 140, // Position where the checkmark button is
    width: SCREEN_WIDTH,    // Full width to make it easier to hit
    height: 100            // Height of the button area
  });
  const [overlayData, setOverlayData] = useState<Map<string, any>>(new Map());


  useEffect(() => {
    if (onOverlaysUpdate) {
      const overlays = Array.from(overlayData.values());
      onOverlaysUpdate(overlays);
    }
  }, [overlayData]);

  const handleOverlayUpdate = (data: any) => {
    setOverlayData(prev => new Map(prev).set(data.id, data));
  };

  const handleDelete = (id: string) => {
    setTextElements(prev => prev.filter(elementId => elementId !== id));
    setEditingId(null);
    setOverlayData(prev => {
      const newData = new Map(prev);
      newData.delete(id);
      return newData;
    });
    onDragStateChange?.(false);
  };
  

  const addNewText = () => {
    const newId = Date.now().toString();
    setTextElements(prev => [...prev, newId]);
    setEditingId(newId);
  };

  
  const backgroundPress = () => {
    if (editingId) {
      setEditingId(null);
    }
  };

  const containerGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(backgroundPress)();
    });

  return (
    <GestureDetector gesture={containerGesture}>
      <View style={[styles.overlayContainer, containerStyle]}>
        {textElements.map(id => (
          <DraggableText
            key={id}
            id={id}
            isEditing={editingId === id}
            onEdit={() => setEditingId(id)}
            onEditComplete={() => setEditingId(null)}
            onDelete={handleDelete}
            binPosition={binPosition}
            onDragStateChange={onDragStateChange}
            onOverlayUpdate={handleOverlayUpdate}

          />
        ))}
        <TouchableOpacity style={!video? styles.addButton : styles.addVideoButton } onPress={addNewText}>
          <Ionicons name="text" size={40} color="white" />
        </TouchableOpacity>

       
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  textContainer: {
    position: 'absolute',
    minWidth: 100,
    maxWidth: '80%',
  },
  textWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  text: {
    color: 'white',
    
  },
  textInput: {
    color: 'white',
    
    minWidth: 100,
  },
  addButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 999,
  },

  addVideoButton: {
    position: 'absolute',
    top: 90,
    right: 20,
    zIndex: 999,
  },
  binIcon: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  
});