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

// Fixed 9:16 aspect ratio for consistent cross-device display (like Snapchat/Instagram)
const ASPECT_RATIO = 9 / 16;

/**
 * Calculate the fixed 9:16 container dimensions for the current screen
 * This ensures all devices display content in the same aspect ratio
 */
export function getFixedContainerDimensions(screenWidth: number, screenHeight: number): {
  width: number;
  height: number;
} {
  const screenRatio = screenWidth / screenHeight;
  
  if (screenRatio > ASPECT_RATIO) {
    // Screen is wider than 9:16, fit by height
    return {
      width: screenHeight * ASPECT_RATIO,
      height: screenHeight,
    };
  } else {
    // Screen is taller than 9:16, fit by width
    return {
      width: screenWidth,
      height: screenWidth / ASPECT_RATIO,
    };
  }
}

/**
 * Convert overlay position from creation context to display context
 * 
 * Uses FIXED ASPECT RATIO positioning (like Snapchat/Instagram):
 * - All content is displayed in a fixed 9:16 aspect ratio container
 * - Position is stored as simple percentage (0-100) of the container
 * - Since all devices use the same 9:16 ratio, text appears at identical positions
 *   relative to the image content (not just the screen)
 */
export function convertOverlayPosition(
  overlay: OverlayData,
  containerWidth: number,
  containerHeight: number
): {
  left: number;
  top: number;
  fontSize: number;
} {
  // Simple percentage-based positioning
  // position_x and position_y are percentages (0-100) of the fixed container
  // Since all devices use the same aspect ratio, this gives identical positioning
  
  const left = (overlay.position_x / 100) * containerWidth;
  const top = (overlay.position_y / 100) * containerHeight;
  
  // Font size is stored as percentage of container height
  const fontSize = (overlay.font_size / 100) * containerHeight;
  
  console.log('[MediaPositioning] Fixed 9:16 container positioning:', {
    overlay: { x: overlay.position_x, y: overlay.position_y, fontSize: overlay.font_size },
    container: { w: containerWidth, h: containerHeight },
    result: { left, top, fontSize }
  });

  return { left, top, fontSize };
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
