/**
 * iOS Design System
 * Based on Apple Human Interface Guidelines
 */

// MARK: - Colors
export const Colors = {
  // Primary Brand Color
  primary: {
    DEFAULT: '#FF6B6B', // Lighter, more pleasant red
    light: '#FF8787',
    dark: '#FA5252',
  },

  // Semantic Colors (iOS Standard)
  semantic: {
    blue: '#007AFF',
    green: '#34C759',
    indigo: '#5856D6',
    orange: '#FF9500',
    pink: '#FF2D55',
    purple: '#AF52DE',
    red: '#FF3B30',
    teal: '#5AC8FA',
    yellow: '#FFCC00',
  },

  // Neutral Colors
  neutral: {
    white: '#FFFFFF',
    black: '#000000',
  },

  // Gray Scale (iOS Standard)
  gray: {
    50: '#F9FAFB',
    100: '#F2F2F7',   // iOS systemGray6
    200: '#E5E5EA',   // iOS systemGray5
    300: '#D1D1D6',   // iOS systemGray4
    400: '#C7C7CC',   // iOS systemGray3
    500: '#AEAEB2',   // iOS systemGray2
    600: '#8E8E93',   // iOS systemGray
    700: '#636366',
    800: '#48484A',
    900: '#3A3A3C',
  },

  // Labels (Dynamic for Light/Dark mode)
  label: {
    primary: '#000000',     // Light mode primary text
    secondary: '#3C3C43',   // Light mode secondary text (60% opacity)
    tertiary: '#3C3C4399',  // Light mode tertiary text (30% opacity)
    quaternary: '#3C3C4326', // Light mode quaternary text (18% opacity)
  },

  // Fills (for backgrounds)
  fill: {
    primary: '#78788033',   // 20% opacity
    secondary: '#78787829', // 16% opacity
    tertiary: '#7676801F',  // 12% opacity
    quaternary: '#74748014', // 8% opacity
  },

  // System Backgrounds
  background: {
    primary: '#FFFFFF',
    secondary: '#F2F2F7',
    tertiary: '#FFFFFF',
    grouped: '#F2F2F7',
  },

  // Grouped Content Backgrounds
  groupedBackground: {
    primary: '#F2F2F7',
    secondary: '#FFFFFF',
    tertiary: '#F2F2F7',
  },

  // Separators
  separator: {
    opaque: '#C6C6C8',
    nonOpaque: '#3C3C4349', // 29% opacity
  },
} as const;

// MARK: - Typography
export const Typography = {
  // iOS Type Scale (in points)
  size: {
    largeTitle: 34,   // Large Title (iOS)
    title1: 28,       // Title 1
    title2: 22,       // Title 2
    title3: 20,       // Title 3
    headline: 17,     // Headline (semibold)
    body: 17,         // Body (regular)
    callout: 16,      // Callout
    subhead: 15,      // Subhead
    footnote: 13,     // Footnote
    caption1: 12,     // Caption 1
    caption2: 11,     // Caption 2
  },

  // Font Weights
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
    black: '900',
  },

  // Line Heights (iOS uses tight leading)
  lineHeight: {
    largeTitle: 41,
    title1: 34,
    title2: 28,
    title3: 25,
    headline: 22,
    body: 22,
    callout: 21,
    subhead: 20,
    footnote: 18,
    caption1: 16,
    caption2: 13,
  },
} as const;

// MARK: - Spacing
export const Spacing = {
  // iOS uses 4pt grid system
  0: 0,
  1: 4,    // 4pt
  2: 8,    // 8pt
  3: 12,   // 12pt
  4: 16,   // 16pt (standard screen edge padding)
  5: 20,   // 20pt
  6: 24,   // 24pt
  8: 32,   // 32pt
  10: 40,  // 40pt
  12: 48,  // 48pt
  16: 64,  // 64pt
  20: 80,  // 80pt
  24: 96,  // 96pt

  // Named spacing for consistency
  screenPadding: 16,      // Standard screen edge padding
  groupedPadding: 16,     // Grouped list padding
  sectionSpacing: 24,     // Space between sections
  itemSpacing: 12,        // Space between list items
  cardPadding: 16,        // Card internal padding
} as const;

// MARK: - Border Radius
export const BorderRadius = {
  none: 0,
  xs: 4,      // Small elements
  sm: 6,      // Small buttons
  base: 8,    // Default buttons
  md: 10,     // Medium buttons (iOS standard)
  lg: 12,     // Cards
  xl: 16,     // Large cards
  '2xl': 20,  // Modals/Sheets
  '3xl': 24,  // Large modals
  full: 9999, // Circular (avatars, badges)
} as const;

// MARK: - Shadows
export const Shadows = {
  // iOS-style shadows
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

// MARK: - Component Sizes
export const ComponentSizes = {
  // Avatar sizes
  avatar: {
    xs: 24,    // Extra small
    sm: 32,    // Small
    base: 40,  // Default
    md: 48,    // Medium
    lg: 64,    // Large
    xl: 80,    // Extra large
    '2xl': 96, // Double extra large
  },

  // Button heights
  button: {
    sm: 32,    // Small button
    base: 44,  // Standard iOS tap target
    lg: 50,    // Large button
  },

  // Input heights
  input: {
    base: 44,  // Standard iOS input
    lg: 50,    // Large input
  },

  // Icon sizes
  icon: {
    xs: 16,
    sm: 20,
    base: 24,
    md: 28,
    lg: 32,
    xl: 40,
  },

  // Tab bar
  tabBar: {
    height: 49, // iOS standard tab bar height
    iconSize: 28,
  },

  // Navigation bar
  navBar: {
    height: 44, // iOS standard nav bar height
  },
} as const;

// MARK: - Animation Durations
export const Animation = {
  // iOS standard durations
  duration: {
    fast: 200,      // 0.2s - Quick transitions
    normal: 300,    // 0.3s - Standard (iOS default)
    slow: 400,      // 0.4s - Slower transitions
  },

  // Easing curves
  easing: {
    standard: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;

// MARK: - Opacity
export const Opacity = {
  disabled: 0.4,    // Disabled state
  pressed: 0.6,     // Pressed state (iOS standard)
  hover: 0.8,       // Hover state (for web)
  dimmed: 0.5,      // Dimmed content
  subtle: 0.3,      // Very subtle elements
} as const;

// MARK: - Layout
export const Layout = {
  // Standard iOS dimensions
  maxContentWidth: 428,  // iPhone 14 Pro Max width
  
  // Safe area insets (default values, should be dynamic)
  safeArea: {
    top: 47,     // Status bar + notch
    bottom: 34,  // Home indicator
  },

  // List item heights
  listItem: {
    base: 44,    // Standard list item
    subtitle: 60, // List item with subtitle
    large: 80,   // Large list item with avatar
  },
} as const;

// Export all as a single theme object
export const Theme = {
  colors: Colors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows,
  sizes: ComponentSizes,
  animation: Animation,
  opacity: Opacity,
  layout: Layout,
} as const;

export default Theme;
