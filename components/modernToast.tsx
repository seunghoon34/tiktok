import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ModernToastProps {
  text1: string;
  text2?: string;
  type: 'success' | 'error' | 'info';
  onHide?: () => void;
}

const ModernToast: React.FC<ModernToastProps> = ({ text1, text2, type, onHide }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const getToastConfig = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: 'rgba(34, 197, 94, 0.95)',
          icon: 'checkmark-circle' as const,
        };
      case 'error':
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.95)',
          icon: 'close-circle' as const,
        };
      case 'info':
        return {
          backgroundColor: 'rgba(59, 130, 246, 0.95)',
          icon: 'information-circle' as const,
        };
      default:
        return {
          backgroundColor: 'rgba(59, 130, 246, 0.95)',
          icon: 'information-circle' as const,
        };
    }
  };

  const config = getToastConfig();

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide after 3 seconds
    const hideTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onHide?.();
      });
    }, 3000);

    return () => clearTimeout(hideTimer);
  }, [fadeAnim, scaleAnim, onHide]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
        backgroundColor: config.backgroundColor,
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 200,
        maxWidth: Dimensions.get('window').width - 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <Ionicons name={config.icon} size={24} color="white" style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: 'white',
            fontSize: 16,
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          {text1}
        </Text>
        {text2 && (
          <Text
            style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: 14,
              marginTop: 4,
              textAlign: 'center',
            }}
          >
            {text2}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

export default ModernToast;
