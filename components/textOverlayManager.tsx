
// TextOverlayManager.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
 useAnimatedStyle, 
 useSharedValue,
 withSpring 
} from 'react-native-reanimated';
import { 
 Gesture, 
 GestureDetector, 
 GestureHandlerRootView 
} from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

interface TextElement {
 id: string;
 content: string;
 position: { x: number; y: number };
 scale: number;
 rotation: number;  
}

interface DraggableTextProps {
    id: string;
    content: string;
    position: { x: number; y: number };
    onUpdate: (id: string, position: { x: number; y: number }) => void;
    onDelete: (id: string) => void;
  }

interface TextOverlayManagerProps {
    onTextChange?: (texts: TextElement[]) => void;
  }

  const DraggableText = ({ id, content, position, onUpdate, onDelete }: DraggableTextProps) => {
    const translateX = useSharedValue(position.x);
    const translateY = useSharedValue(position.y);
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
  
    const panGesture = Gesture.Pan()
      .onUpdate((e) => {
        translateX.value += e.changeX;
        translateY.value += e.changeY;
      })
      .onEnd(() => {
        onUpdate(id, { x: translateX.value, y: translateY.value });
      });

 const pinchGesture = Gesture.Pinch()
   .onUpdate((e) => {
     scale.value = e.scale;
   });

 const rotateGesture = Gesture.Rotation()
   .onUpdate((e) => {
     rotation.value = e.rotation;
   });

 const gesture = Gesture.Simultaneous(
   panGesture,
   pinchGesture,
   rotateGesture
 );

 const animatedStyle = useAnimatedStyle(() => ({
   transform: [
     { translateX: translateX.value },
     { translateY: translateY.value },
     { scale: scale.value },
     { rotate: `${rotation.value}rad` }
   ]
 }));

 return (
   <GestureDetector gesture={gesture}>
     <Animated.View style={[styles.textContainer, animatedStyle]}>
       <Text style={styles.text}>{content}</Text>
       <TouchableOpacity onPress={() => onDelete(id)} style={styles.deleteButton}>
         <Ionicons name="close-circle" size={20} color="white" />
       </TouchableOpacity>
     </Animated.View>
   </GestureDetector>
 );
};

const TextInputModal = ({ value, onChangeText, onSubmit }) => (
 <View style={styles.inputContainer}>
   <TextInput
     value={value}
     onChangeText={onChangeText}
     onSubmitEditing={onSubmit}
     placeholder="Enter text..."
     placeholderTextColor="#999"
     style={styles.input}
     autoFocus
   />
 </View>
);

const AddTextButton = ({ onPress }) => (
 <TouchableOpacity style={styles.addButton} onPress={onPress}>
   <Ionicons name="text" size={30} color="white" />
 </TouchableOpacity>
);

const TextOverlayManager = ({ onTextChange }: TextOverlayManagerProps) => {
 const [textElements, setTextElements] = useState<TextElement[]>([]);
 const [isAddingText, setIsAddingText] = useState(false);
 const [inputText, setInputText] = useState('');
  
  // Update parent whenever textElements changes
  useEffect(() => {
    onTextChange?.(textElements);
  }, [textElements]);
 
  const handleAddText = () => {
   if (inputText.trim()) {
    const windowWidth = Dimensions.get('window').width;
    const windowHeight = Dimensions.get('window').height;
     setTextElements(prev => [...prev, {
       id: Date.now().toString(),
       content: inputText,
       position: {  x: windowWidth / 2 - 50, // Approximate center, adjust based on text width
        y: windowHeight / 2 - 20  },// Approximate center, adjust based on text height },
       scale: 1,
       rotation: 0
     }]);
     setInputText('');
     setIsAddingText(false);
   }
 };

 const handleDeleteText = (id: string) => {
   setTextElements(prev => prev.filter(text => text.id !== id));
 };

 return (
   <GestureHandlerRootView style={StyleSheet.absoluteFill}>
     {textElements.map(text => (
       <DraggableText 
       key={text.id} 
       {...text} 
       onUpdate={(id, newPosition) => {
         setTextElements(prev => prev.map(t => 
           t.id === id ? { ...t, position: newPosition } : t
         ));
       }}
       onDelete={handleDeleteText}
     />
     ))}
     
     <AddTextButton onPress={() => setIsAddingText(true)} />
     
     {isAddingText && (
       <TextInputModal
         value={inputText}
         onChangeText={setInputText}
         onSubmit={handleAddText}
       />
     )}
   </GestureHandlerRootView>
 );
};

const styles = StyleSheet.create({
 textContainer: {
   position: 'absolute',
   flexDirection: 'row',
   alignItems: 'center',
 },
 text: {
   color: 'white',
   fontSize: 24,
   fontWeight: 'bold',
   textShadowColor: 'rgba(0, 0, 0, 0.75)',
   textShadowOffset: { width: 1, height: 1 },
   textShadowRadius: 3,
 },
 deleteButton: {
   marginLeft: 5,
 },
 inputContainer: {
   position: 'absolute',
   bottom: 100,
   left: 20,
   right: 20,
   backgroundColor: 'rgba(0, 0, 0, 0.5)',
   borderRadius: 10,
   padding: 10,
 },
 input: {
   color: 'white',
   fontSize: 16,
   padding: 10,
 },
 addButton: {
   position: 'absolute',
   top: 40,
   right: 20,
   backgroundColor: 'rgba(0, 0, 0, 0.5)',
   borderRadius: 20,
   padding: 10,
 },
});

export default TextOverlayManager;
