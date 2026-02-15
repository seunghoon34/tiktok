/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}" , "./components/**/*.{js,jsx,ts,tsx}" ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // iOS Color System
      colors: {
        primary: {
          DEFAULT: '#007C7B', // Dark cyan/teal brand color
          light: '#009E9D',
          dark: '#005F5E',
        },
        ios: {
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
        red: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },
        gray: {
          50: '#F9FAFB',
          100: '#F2F2F7',
          200: '#E5E5EA',
          300: '#D1D1D6',
          400: '#C7C7CC',
          500: '#AEAEB2',
          600: '#8E8E93',
          700: '#636366',
          800: '#48484A',
          900: '#3A3A3C',
        },
      },

      // iOS Typography Scale
      fontSize: {
        'ios-large-title': ['34px', { lineHeight: '41px', fontWeight: '700' }],
        'ios-title1': ['28px', { lineHeight: '34px', fontWeight: '700' }],
        'ios-title2': ['22px', { lineHeight: '28px', fontWeight: '700' }],
        'ios-title3': ['20px', { lineHeight: '25px', fontWeight: '600' }],
        'ios-headline': ['17px', { lineHeight: '22px', fontWeight: '600' }],
        'ios-body': ['17px', { lineHeight: '22px', fontWeight: '400' }],
        'ios-callout': ['16px', { lineHeight: '21px', fontWeight: '400' }],
        'ios-subhead': ['15px', { lineHeight: '20px', fontWeight: '400' }],
        'ios-footnote': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'ios-caption1': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'ios-caption2': ['11px', { lineHeight: '13px', fontWeight: '400' }],
      },

      // iOS Spacing (4pt grid)
      spacing: {
        0: '0px',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
        20: '80px',
        24: '96px',
        
        // Named spacing
        'screen-padding': '16px',
        'section': '24px',
        'item': '12px',
      },

      // iOS Border Radius
      borderRadius: {
        none: '0px',
        xs: '4px',
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
        full: '9999px',
      },

      // iOS Shadows
      boxShadow: {
        'ios-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'ios-base': '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
        'ios-md': '0 4px 8px 0 rgba(0, 0, 0, 0.12)',
        'ios-lg': '0 8px 16px 0 rgba(0, 0, 0, 0.15)',
        'ios-xl': '0 12px 24px 0 rgba(0, 0, 0, 0.18)',
      },

      // iOS Component Heights
      height: {
        'button': '44px',     // Standard iOS button/tap target
        'button-sm': '32px',
        'button-lg': '50px',
        'tab-bar': '49px',    // iOS tab bar
        'nav-bar': '44px',    // iOS navigation bar
        'list-item': '44px',
        'avatar-sm': '32px',
        'avatar': '40px',
        'avatar-md': '48px',
        'avatar-lg': '64px',
        'avatar-xl': '80px',
      },

      width: {
        'avatar-sm': '32px',
        'avatar': '40px',
        'avatar-md': '48px',
        'avatar-lg': '64px',
        'avatar-xl': '80px',
      },

      // iOS Animations
      transitionDuration: {
        'fast': '200ms',
        'normal': '300ms',
        'slow': '400ms',
      },

      // iOS Opacity
      opacity: {
        'disabled': '0.4',
        'pressed': '0.6',
        'hover': '0.8',
        'dimmed': '0.5',
        'subtle': '0.3',
      },
    },
  },
  plugins: [],
}