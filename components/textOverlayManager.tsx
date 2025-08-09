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
import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BinPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OverlayData {
  id: string;
  text: string;
  // Stored as percentages (0-100) of the container dimensions
  position_x: number;
  position_y: number;
  // Raw values
  scale: number;
  rotation: number; // radians
  // Font size stored as percentage of container height (0-100)
  fontSize: number;
}

interface DraggableTextProps {
  id: string;
  isEditing: boolean;
  onDelete: (id: string) => void;
  onEdit: () => void;
  onEditComplete: () => void;
  binPosition: BinPosition;
  onOverlayUpdate: (data: any) => void; // Add this
  containerWidth: number;
  containerHeight: number;
  initialOverlay?: OverlayData;

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
  containerWidth,
  containerHeight,
  initialOverlay,

}: DraggableTextProps & { onDragStateChange?: (isDragging: boolean) => void }) => {
  const [text, setText] = useState('');
  const initialFontSize = Math.min(containerWidth || SCREEN_WIDTH, containerHeight || SCREEN_HEIGHT) * 0.13;
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [elementSize, setElementSize] = useState({ width: 0, height: 0 });

  // Animated values for transformations
  const translateX = useSharedValue(containerWidth ? containerWidth * 0.25 : SCREEN_WIDTH * 0.25); 
  const translateY = useSharedValue(containerHeight ? containerHeight * 0.5 : SCREEN_HEIGHT * 0.5); 
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
      position_x: containerWidth > 0 ? Math.round(((translateX.value / containerWidth) * 100) * 100) / 100 : 50, // percent of container width
      position_y: containerHeight > 0 ? Math.round(((translateY.value / containerHeight) * 100) * 100) / 100 : 50, // percent of container height
      scale: scale.value,
      rotation: rotation.value,
      fontSize: containerHeight > 0 ? Math.round(((fontSize / containerHeight) * 100) * 100) / 100 : 10 // percent of container height
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
  const safeOnDragStateChange = useRef(onDragStateChange ?? (() => {})).current;

  // Initialize position from provided overlay or default when container size becomes available (once)
  const hasInitializedPosition = useRef(false);
  useEffect(() => {
    if (hasInitializedPosition.current) return;
    if (containerWidth > 0 && containerHeight > 0) {
      if (initialOverlay) {
        // Seed from saved percentages
        translateX.value = (initialOverlay.position_x / 100) * containerWidth;
        translateY.value = (initialOverlay.position_y / 100) * containerHeight;
        scale.value = initialOverlay.scale ?? 1;
        rotation.value = initialOverlay.rotation ?? 0;
        // Convert font size percent-of-height to pixels
        const pxFontSize = (initialOverlay.fontSize / 100) * containerHeight;
        runOnJS(setText)(initialOverlay.text ?? '');
        runOnJS(setFontSize)(pxFontSize > 0 ? pxFontSize : initialFontSize);
      } else {
        translateX.value = containerWidth * 0.25;
        translateY.value = containerHeight * 0.5;
      }
      hasInitializedPosition.current = true;
      handleTransformUpdate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerWidth, containerHeight, initialOverlay]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextX.value = translateX.value;
      contextY.value = translateY.value;
      runOnJS(safeOnDragStateChange)(true);
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
      runOnJS(safeOnDragStateChange)(false);
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
  initialOverlays?: OverlayData[];


}

export const TextOverlayManager = ({ containerStyle, onDragStateChange, onOverlaysUpdate, video, initialOverlays  }: TextOverlayManagerProps) => {
  const [textElements, setTextElements] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [binPosition, setBinPosition] = useState<BinPosition>({ 
    x: 0, 
    y: 0,
    width: 0,
    height: 0
  });
  const [overlayData, setOverlayData] = useState<Map<string, any>>(new Map());
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Hydrate from initial overlays if provided
  useEffect(() => {
    if (initialOverlays && initialOverlays.length > 0) {
      const ids = initialOverlays.map(o => o.id);
      setTextElements(ids);
      setEditingId(null);
      setOverlayData(new Map(initialOverlays.map(o => [o.id, o])));
    }
  }, [initialOverlays]);


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
      <View
        style={[styles.overlayContainer, containerStyle]}
        onLayout={({ nativeEvent: { layout } }) => {
          setContainerSize({ width: layout.width, height: layout.height });
          setBinPosition({
            x: 0,
            y: layout.height - 140,
            width: layout.width,
            height: 100,
          });
        }}
      >
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
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            initialOverlay={initialOverlays?.find(o => o.id === id)}

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