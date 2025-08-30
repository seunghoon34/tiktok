import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { convertOverlayPosition, calculateCoverDisplayArea } from '@/utils/mediaPositioning';

interface OverlayDebuggerProps {
  overlay: {
    text: string;
    position_x: number;
    position_y: number;
    scale: number;
    rotation: number;
    font_size: number;
    media_width?: number;
    media_height?: number;
    screen_width?: number;
    screen_height?: number;
  };
  containerWidth: number;
  containerHeight: number;
}

/**
 * Debug component to visualize overlay positioning calculations
 * Use this to understand how overlays are being converted between devices
 */
export const OverlayDebugger: React.FC<OverlayDebuggerProps> = ({
  overlay,
  containerWidth,
  containerHeight
}) => {
  const { width: currentScreenWidth, height: currentScreenHeight } = Dimensions.get('window');
  
  // Calculate old positioning (current broken behavior)
  const oldPosition = {
    left: (overlay.position_x / 100) * currentScreenWidth,
    top: (overlay.position_y / 100) * currentScreenHeight,
    fontSize: (overlay.font_size / 100) * currentScreenHeight
  };

  // Calculate new positioning (fixed behavior)
  const newPosition = convertOverlayPosition(overlay, currentScreenWidth, currentScreenHeight);

  // Calculate media display areas if we have the data
  let originalDisplayArea = null;
  let currentDisplayArea = null;
  
  if (overlay.media_width && overlay.media_height && overlay.screen_width && overlay.screen_height) {
    originalDisplayArea = calculateCoverDisplayArea(
      overlay.screen_width,
      overlay.screen_height,
      overlay.media_width,
      overlay.media_height
    );
    currentDisplayArea = calculateCoverDisplayArea(
      currentScreenWidth,
      currentScreenHeight,
      overlay.media_width,
      overlay.media_height
    );
  }

  return (
    <View style={{
      position: 'absolute',
      top: 10,
      left: 10,
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: 10,
      borderRadius: 5,
      maxWidth: 300,
      zIndex: 999
    }}>
      <Text style={{ color: 'white', fontWeight: 'bold', marginBottom: 5 }}>
        Overlay Debug Info
      </Text>
      
      <Text style={{ color: 'white', fontSize: 12 }}>
        Text: "{overlay.text}"
      </Text>
      
      <Text style={{ color: 'white', fontSize: 12 }}>
        Stored Position: ({overlay.position_x.toFixed(1)}%, {overlay.position_y.toFixed(1)}%)
      </Text>
      
      <Text style={{ color: 'red', fontSize: 12 }}>
        Old Position: ({oldPosition.left.toFixed(0)}, {oldPosition.top.toFixed(0)})
      </Text>
      
      <Text style={{ color: 'green', fontSize: 12 }}>
        New Position: ({newPosition.left.toFixed(0)}, {newPosition.top.toFixed(0)})
      </Text>
      
      <Text style={{ color: 'white', fontSize: 12 }}>
        Current Screen: {currentScreenWidth}x{currentScreenHeight}
      </Text>
      
      {overlay.screen_width && overlay.screen_height && (
        <Text style={{ color: 'white', fontSize: 12 }}>
          Original Screen: {overlay.screen_width}x{overlay.screen_height}
        </Text>
      )}
      
      {overlay.media_width && overlay.media_height && (
        <Text style={{ color: 'white', fontSize: 12 }}>
          Media Dimensions: {overlay.media_width}x{overlay.media_height}
        </Text>
      )}
      
      {currentDisplayArea && originalDisplayArea && (
        <>
          <Text style={{ color: 'yellow', fontSize: 12 }}>
            Original Media Area: {originalDisplayArea.width.toFixed(0)}x{originalDisplayArea.height.toFixed(0)} 
            @ ({originalDisplayArea.x.toFixed(0)}, {originalDisplayArea.y.toFixed(0)})
          </Text>
          <Text style={{ color: 'yellow', fontSize: 12 }}>
            Current Media Area: {currentDisplayArea.width.toFixed(0)}x{currentDisplayArea.height.toFixed(0)} 
            @ ({currentDisplayArea.x.toFixed(0)}, {currentDisplayArea.y.toFixed(0)})
          </Text>
        </>
      )}
    </View>
  );
};
