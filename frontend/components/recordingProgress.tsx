import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { CircleProps } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RecordingProgressProps {
  isRecording: boolean;
  size?: number;
  maxDuration?: number; // in milliseconds
  strokeWidth?: number;
}

const RecordingProgress: React.FC<RecordingProgressProps> = ({
  isRecording,
  size = 100,
  maxDuration = 30000, // in milliseconds
  strokeWidth = 6
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    // When recording starts
    if (isRecording) {
      animatedValue.setValue(0);
      animation.current = Animated.timing(animatedValue, {
        toValue: 1,
        duration: maxDuration,
        useNativeDriver: true
      });
      animation.current.start();
    } 
    // When recording stops
    else {
      if (animation.current) {
        animation.current.stop();
      }
      animatedValue.setValue(0);
    }

    return () => {
      if (animation.current) {
        animation.current.stop();
      }
    };
  }, [isRecording, maxDuration]);

  const animatedStrokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0]
  });

  if (!isRecording) return null;  // Don't render when not recording

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg style={{ transform: [{ rotate: '-90deg' }] }}>
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="red"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={animatedStrokeDashoffset}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  }
});

export default RecordingProgress;