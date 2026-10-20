import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

// Hermes polyfills for TypedArray
if (typeof (globalThis as any).isTypedArray === 'undefined') {
  (globalThis as any).isTypedArray = (value: any) => ArrayBuffer.isView(value) && !(value instanceof DataView);
}
import '../utils/tfPlatform';

import CustomSplashScreen from '../components/CustomSplashScreen';
import OnboardingProfileScreen from '../components/OnboardingProfileScreen';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { hasConfiguredFarmerProfile } from '../services/profileService';

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
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    hasConfiguredFarmerProfile().then((configured) => {
      setHasProfile(configured);
    });
  }, []);

  if (!isSplashDone) {
    return (
      <ThemeProvider>
        <CustomSplashScreen onFinish={() => setIsSplashDone(true)} />
      </ThemeProvider>
    );
  }

  // Jika petani belum melengkapi profil awal, tampilkan layar registrasi ala m-banking
  if (hasProfile === false) {
    return (
      <ThemeProvider>
        <OnboardingProfileScreen onComplete={() => setHasProfile(true)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <RootLayoutNav />
    </ThemeProvider>
  );
}
