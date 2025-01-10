import { StyleSheet, View, TextInput, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { ComposedGesture, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const INITIAL_FONT_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.1;

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
}

const DraggableText = ({
  id,
  isEditing,
  onDelete,
  onEdit,
  onEditComplete,
  binPosition,
  onDragStateChange,
}: DraggableTextProps & { onDragStateChange?: (isDragging: boolean) => void }) => {
  const [text, setText] = useState('');
  const [fontSize] = useState(INITIAL_FONT_SIZE);
  const [elementSize, setElementSize] = useState({ width: 0, height: 0 });

  // Animated values for transformations
  const translateX = useSharedValue((SCREEN_WIDTH - 100) / 2);
  const translateY = useSharedValue((SCREEN_HEIGHT - 100) / 2);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  // Context values for gesture handling
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);
  const contextScale = useSharedValue(1);
  const contextRotation = useSharedValue(0);

  const [isOverBin, setIsOverBin] = useState(false);

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
    (isOverlapping) => {
      if (isOverlapping && !isOverBin) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
        runOnJS(setIsOverBin)(true);
      } else if (!isOverlapping && isOverBin) {
        runOnJS(setIsOverBin)(false);
      }
      if (isOverlapping) {
        runOnJS(onDelete)(id);
      }
    },
    [elementSize, binPosition, isOverBin]
  );

  
  const handleBlur = () => {
    if (text.trim() === '') {
      onDelete(id);
    } else {
      onEditComplete();
    }
  };

  // Pan gesture for dragging
  const panGesture = Gesture.Pan()
  .onStart(() => {
    contextX.value = translateX.value;
    contextY.value = translateY.value;
    runOnJS(onDragStateChange)(true); // Add this
  })
  .onUpdate((event) => {
    translateX.value = contextX.value + event.translationX;
    translateY.value = contextY.value + event.translationY;
  })
  .onEnd(() => {
    translateX.value = withSpring(translateX.value);
    translateY.value = withSpring(translateY.value);
    runOnJS(onDragStateChange)(false); // Add this
  });


  // Pinch gesture for scaling
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      contextScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = contextScale.value * event.scale;
    });

  // Rotation gesture
  const rotationGesture = Gesture.Rotation()
    .onStart(() => {
      contextRotation.value = rotation.value;
    })
    .onUpdate((event) => {
      rotation.value = contextRotation.value + event.rotation;
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
      { translateX: translateX.value },
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
              onChangeText={setText}
              style={[styles.textInput, { fontSize }]}
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

}

export const TextOverlayManager = ({ containerStyle, onDragStateChange }: TextOverlayManagerProps) => {
  const [textElements, setTextElements] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [binPosition, setBinPosition] = useState<BinPosition>({ 
    x: 0, 
    y: SCREEN_HEIGHT - 140, // Position where the checkmark button is
    width: SCREEN_WIDTH,    // Full width to make it easier to hit
    height: 100            // Height of the button area
  });

  const handleDelete = (id: string) => {
    setTextElements(prev => prev.filter(elementId => elementId !== id));
    setEditingId(null);
    onDragStateChange?.(false); // Reset drag state after deletion
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
          />
        ))}
        <TouchableOpacity style={styles.addButton} onPress={addNewText}>
          <Ionicons name="add-circle" size={40} color="white" />
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
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
    padding: 10,
  },
  textInput: {
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
    padding: 10,
    minWidth: 100,
  },
  addButton: {
    position: 'absolute',
    top: 60,
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