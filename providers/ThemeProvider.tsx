import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextType {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themePreference: 'system',
  setThemePreference: () => {},
});

const STORAGE_KEY = '@theme_preference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const { setColorScheme } = useColorScheme();

  // Load saved preference on mount
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemePreferenceState(saved);
          applyTheme(saved);
        } else {
          applyTheme('system');
        }
      } catch {
        applyTheme('system');
      }
    };
    loadPreference();
  }, []);

  // Listen for device theme changes when set to 'system'
  useEffect(() => {
    if (themePreference !== 'system') return;

    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });

    return () => listener.remove();
  }, [themePreference]);

  const applyTheme = (pref: ThemePreference) => {
    if (pref === 'system') {
      const deviceScheme = Appearance.getColorScheme();
      setColorScheme(deviceScheme === 'dark' ? 'dark' : 'light');
    } else {
      setColorScheme(pref);
    }
  };

  const setThemePreference = async (pref: ThemePreference) => {
    setThemePreferenceState(pref);
    applyTheme(pref);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // Silently fail on storage error
    }
  };

  return (
    <ThemeContext.Provider value={{ themePreference, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useThemePreference = () => useContext(ThemeContext);
