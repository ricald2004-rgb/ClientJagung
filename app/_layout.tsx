import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import 'react-native-reanimated';

// Hermes polyfills for TypedArray
if (typeof (globalThis as any).isTypedArray === 'undefined') {
  (globalThis as any).isTypedArray = (value: any) => ArrayBuffer.isView(value) && !(value instanceof DataView);
}
import '../utils/tfPlatform';

import CustomSplashScreen from '../components/CustomSplashScreen';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { isDark } = useTheme();

  return (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="detail" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [isSplashDone, setIsSplashDone] = useState(false);

  if (!isSplashDone) {
    return (
      <ThemeProvider>
        <CustomSplashScreen onFinish={() => setIsSplashDone(true)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <RootLayoutNav />
    </ThemeProvider>
  );
}
