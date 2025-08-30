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
  // Media dimensions when overlay was created
  media_width?: number;
  media_height?: number;
  screen_width?: number;
  screen_height?: number;
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
  tapPosition?: { x: number; y: number } | null;
  onClearTapPosition?: () => void;
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
  tapPosition,
  onClearTapPosition,
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
    // Calculate center points
    const containerCenterX = containerWidth / 2;
    const containerCenterY = containerHeight / 2;
    
    // Convert absolute position to percentage offset from center
    const positionXPercent = containerWidth > 0 ? 
      Math.round(((translateX.value - containerCenterX) / containerWidth) * 100 * 100) / 100 : 0;
    const positionYPercent = containerHeight > 0 ? 
      Math.round(((translateY.value - containerCenterY) / containerHeight) * 100 * 100) / 100 : 0;
    
    const updateData = {
      id,
      text,
      position_x: positionXPercent, // percent offset from center (-50 to +50)
      position_y: positionYPercent, // percent offset from center (-50 to +50)
      scale: scale.value,
      rotation: rotation.value,
      fontSize: containerHeight > 0 ? Math.round(((fontSize / containerHeight) * 100) * 100) / 100 : 10, // percent of container height
      // Store media dimensions and screen dimensions for cross-device compatibility
      media_width: containerWidth,
      media_height: containerHeight,
      screen_width: SCREEN_WIDTH,
      screen_height: SCREEN_HEIGHT
    };
    
    console.log('[TextOverlayManager] Center-anchor overlay created:', {
      absolute: { x: translateX.value, y: translateY.value },
      center: { x: containerCenterX, y: containerCenterY },
      relative: { x: positionXPercent, y: positionYPercent }
    });
    
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
        // Calculate center points
        const containerCenterX = containerWidth / 2;
        const containerCenterY = containerHeight / 2;
        
        // Convert center-relative percentages back to absolute positions
        translateX.value = containerCenterX + (initialOverlay.position_x / 100) * containerWidth;
        translateY.value = containerCenterY + (initialOverlay.position_y / 100) * containerHeight;
        scale.value = initialOverlay.scale ?? 1;
        rotation.value = initialOverlay.rotation ?? 0;
        // Convert font size percent-of-height to pixels
        const pxFontSize = (initialOverlay.fontSize / 100) * containerHeight;
        runOnJS(setText)(initialOverlay.text ?? '');
        runOnJS(setFontSize)(pxFontSize > 0 ? pxFontSize : initialFontSize);
      } else if (tapPosition) {
        // Use tap position for new overlay
        translateX.value = tapPosition.x;
        translateY.value = tapPosition.y;
        console.log('[DraggableText] Created overlay at tap position:', tapPosition);
        // Clear tap position after using it
        if (onClearTapPosition) {
          runOnJS(onClearTapPosition)();
        }
      } else {
        // Default position: slightly left of center (for Aa button)
        translateX.value = containerWidth * 0.25;
        translateY.value = containerHeight * 0.5;
      }
      hasInitializedPosition.current = true;
      handleTransformUpdate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerWidth, containerHeight, initialOverlay, tapPosition]);

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
              textAlign="left"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              onBlur={handleBlur}
              
            />
          ) : (
            <Animated.Text style={[styles.text, { fontSize, textAlign: 'left' }]}>{text}</Animated.Text>
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
  mediaWidth?: number;  // Add media dimensions
  mediaHeight?: number;
}

export const TextOverlayManager = ({ containerStyle, onDragStateChange, onOverlaysUpdate, video, initialOverlays, mediaWidth, mediaHeight  }: TextOverlayManagerProps) => {
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
  

  const addNewText = (tapPosition?: { x: number; y: number }) => {
    const newId = Date.now().toString();
    setTextElements(prev => [...prev, newId]);
    setEditingId(newId);
    
    // Store tap position for initial overlay placement
    if (tapPosition) {
      setTapPosition(tapPosition);
    }
  };

  const [tapPosition, setTapPosition] = useState<{ x: number; y: number } | null>(null);

  
  const backgroundPress = () => {
    if (editingId) {
      setEditingId(null);
    }
  };

  const handleTapToCreate = (event: any) => {
    // If currently editing, unfocus instead of creating new overlay
    if (editingId) {
      setEditingId(null);
    } else {
      // Create new overlay
      const tapX = event.absoluteX || event.x;
      const tapY = event.absoluteY || event.y;
      addNewText({ x: tapX, y: tapY });
    }
  };

  // Tap gesture for creating overlays anywhere OR unfocusing when editing
  const tapToCreateGesture = Gesture.Tap()
    .onEnd((event) => {
      runOnJS(handleTapToCreate)(event);
    });

  return (
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
      {/* Transparent tap layer for creating overlays OR unfocusing when editing */}
      <GestureDetector gesture={tapToCreateGesture}>
        <View style={styles.tapLayer} pointerEvents="box-only" />
      </GestureDetector>

      {/* Text overlays layer */}
      <View style={styles.backgroundLayer} pointerEvents="box-none">
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
            tapPosition={tapPosition}
            onClearTapPosition={() => setTapPosition(null)}
          />
        ))}
      </View>

      {/* UI Controls layer - highest z-index */}
      <View style={styles.uiControlsLayer} pointerEvents="box-none">
        <TouchableOpacity 
          style={!video? styles.addButton : styles.addVideoButton } 
          onPress={() => addNewText()}
        >
          <Ionicons name="text" size={40} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  tapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
  },
  uiControlsLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
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
  },

  addVideoButton: {
    position: 'absolute',
    top: 90,
    right: 20,
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