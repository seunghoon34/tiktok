import { Dimensions } from 'react-native';

interface MediaDimensions {
  width: number;
  height: number;
}

interface OverlayData {
  position_x: number;
  position_y: number;
  scale: number;
  rotation: number;
  font_size: number;
  media_width?: number;
  media_height?: number;
  screen_width?: number;
  screen_height?: number;
}

interface DisplayArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate the actual display area of media when using ResizeMode.COVER
 * This accounts for how React Native scales and crops media to cover the container
 */
export function calculateCoverDisplayArea(
  containerWidth: number,
  containerHeight: number,
  mediaWidth?: number,
  mediaHeight?: number
): DisplayArea {
  // If we don't have media dimensions, assume media fills the entire container
  if (!mediaWidth || !mediaHeight) {
    return {
      x: 0,
      y: 0,
      width: containerWidth,
      height: containerHeight
    };
  }

  const containerAspectRatio = containerWidth / containerHeight;
  const mediaAspectRatio = mediaWidth / mediaHeight;

  let displayWidth: number;
  let displayHeight: number;
  let offsetX: number = 0;
  let offsetY: number = 0;

  if (mediaAspectRatio > containerAspectRatio) {
    // Media is wider than container - height fills container, width is cropped
    displayHeight = containerHeight;
    displayWidth = containerHeight * mediaAspectRatio;
    offsetX = (containerWidth - displayWidth) / 2;
  } else {
    // Media is taller than container - width fills container, height is cropped
    displayWidth = containerWidth;
    displayHeight = containerWidth / mediaAspectRatio;
    offsetY = (containerHeight - displayHeight) / 2;
  }

  return {
    x: offsetX,
    y: offsetY,
    width: displayWidth,
    height: displayHeight
  };
}

/**
 * Convert overlay position from creation context to display context
 * This handles the coordinate system transformation between different devices
 * Uses Instagram's approach: aspect-ratio aware positioning
 */
export function convertOverlayPosition(
  overlay: OverlayData,
  currentScreenWidth: number,
  currentScreenHeight: number
): {
  left: number;
  top: number;
  fontSize: number;
} {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  // If overlay has stored media dimensions, use aspect-ratio aware positioning
  if (overlay.media_width && overlay.media_height && overlay.screen_width && overlay.screen_height) {
    // Calculate the actual media display area on original device
    const originalDisplayArea = calculateCoverDisplayArea(
      overlay.screen_width,
      overlay.screen_height,
      overlay.media_width,
      overlay.media_height
    );
    
    // Calculate the actual media display area on current device
    const currentDisplayArea = calculateCoverDisplayArea(
      screenWidth,
      screenHeight,
      overlay.media_width,
      overlay.media_height
    );

    // Convert original screen coordinates to media-relative coordinates
    const originalScreenX = (overlay.position_x / 100) * overlay.screen_width;
    const originalScreenY = (overlay.position_y / 100) * overlay.screen_height;

    // Calculate position relative to the original media area (0-1 range)
    const mediaRelativeX = (originalScreenX - originalDisplayArea.x) / originalDisplayArea.width;
    const mediaRelativeY = (originalScreenY - originalDisplayArea.y) / originalDisplayArea.height;

    // Apply the same media-relative position to current device's media area
    const currentX = mediaRelativeX * currentDisplayArea.width + currentDisplayArea.x;
    const currentY = mediaRelativeY * currentDisplayArea.height + currentDisplayArea.y;

    // Scale font size based on media area scale
    const mediaScale = Math.min(
      currentDisplayArea.width / originalDisplayArea.width,
      currentDisplayArea.height / originalDisplayArea.height
    );
    const originalFontSize = (overlay.font_size / 100) * overlay.screen_height;
    const currentFontSize = originalFontSize * mediaScale;

    console.log('[MediaPositioning] Conversion:', {
      overlay: { x: overlay.position_x, y: overlay.position_y },
      original: { 
        screen: `${overlay.screen_width}x${overlay.screen_height}`,
        media: `${overlay.media_width}x${overlay.media_height}`,
        area: originalDisplayArea 
      },
      current: { 
        screen: `${screenWidth}x${screenHeight}`,
        area: currentDisplayArea 
      },
      result: { x: currentX, y: currentY, fontSize: currentFontSize }
    });

    return {
      left: currentX,
      top: currentY,
      fontSize: currentFontSize
    };
  }

  // Fallback: use old behavior for overlays without media dimensions
  console.log('[MediaPositioning] Using fallback positioning');
  return {
    left: (overlay.position_x / 100) * screenWidth,
    top: (overlay.position_y / 100) * screenHeight,
    fontSize: (overlay.font_size / 100) * screenHeight
  };
}

/**
 * Calculate scale factor between two media display areas
 * Used for maintaining relative overlay sizes across devices
 */
export function calculateScaleFactor(
  originalMediaArea: DisplayArea,
  currentMediaArea: DisplayArea
): number {
  // Use the smaller dimension scale to maintain proportions
  const widthScale = currentMediaArea.width / originalMediaArea.width;
  const heightScale = currentMediaArea.height / originalMediaArea.height;
  return Math.min(widthScale, heightScale);
}
