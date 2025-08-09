import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';

interface SimpleSpinnerProps {
  size?: number;
  color?: string;
  borderWidth?: number;
}

const SimpleSpinner: React.FC<SimpleSpinnerProps> = ({ 
  size = 40, 
  color = '#ff5757', 
  borderWidth = 3 
}) => {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    spinAnimation.start();

    return () => spinAnimation.stop();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: borderWidth,
        borderColor: color,
        borderTopColor: 'transparent',
        transform: [{ rotate: spin }],
      }}
    />
  );
};

export default SimpleSpinner;
