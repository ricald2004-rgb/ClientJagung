import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  setupAutoSyncListener,
  startPeriodicPendingSync,
  syncPendingDiagnoses,
} from '../../services/syncService';
import { syncDiseaseInfoFromServer } from '../../services/diseaseService';

export default function TabLayout() {
  const { isDark } = useTheme();

  useEffect(() => {
    // 1. Coba kirim data offline yang tertunda & unduh update materi penyakit saat aplikasi dibuka
    syncPendingDiagnoses();
    syncDiseaseInfoFromServer();

    // 2. Aktifkan background poller antrean diagnosa offline setiap 4 detik (senyap & 0 byte jika antrean kosong)
    startPeriodicPendingSync(4000);

    // 3. Background poller materi edukasi dari dashboard (setiap 3.5 detik)
    const syncInterval = setInterval(() => {
      syncDiseaseInfoFromServer();
    }, 3500);

    // 4. Listener AppState: jika petani kembali membuka aplikasi, langsung sinkronisasi instan
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncDiseaseInfoFromServer();
        syncPendingDiagnoses();
      }
    });

    // 5. Pasang pendengar otomatis: Begitu HP kembali online, auto-sync bertahap data diagnosa & update materi penyakit
    const unsubscribe = setupAutoSyncListener(() => {
      syncDiseaseInfoFromServer();
    });

    return () => {
      clearInterval(syncInterval);
      appStateSub.remove();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[isDark ? 'dark' : 'light'].tint,
        tabBarInactiveTintColor: Colors[isDark ? 'dark' : 'light'].tabIconDefault,
        tabBarStyle: {
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          borderTopColor: isDark ? '#374151' : '#E5E7EB',
        },
        headerShown: false,
        // Mengabaikan peringatan bentrok tipe data efek samping SDK 57
        // @ts-ignore
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          // Menghapus tanda kutip dan mengganti "house" menjadi "home"
          tabBarIcon: ({ color }) => <Ionicons color={color} name="home" size={28} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Informasi',
          // Menghapus tanda kutip agar dikenali sebagai variabel dan angka
          tabBarIcon: ({ color }) => <Ionicons color={color} name="book" size={28} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Riwayat',
          tabBarIcon: ({ color }) => <Ionicons color={color} name="time" size={26} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Ionicons color={color} name="person" size={26} />,
        }}
      />
    </Tabs>
  );
}