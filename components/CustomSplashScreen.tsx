import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    Platform,
    StyleSheet,
    Text,
    View
} from 'react-native';

interface SplashProps {
  onFinish: () => void;
}

const { width } = Dimensions.get('window');

export default function CustomSplashScreen({ onFinish }: SplashProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const notifY = useRef(new Animated.Value(-120)).current; // Mulai dari atas di luar layar

  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    // 1. Cek status koneksi internet secara akurat
    NetInfo.fetch().then((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
    });

    // 2. Animasi logo muncul lembut
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // 3. Notifikasi gaya iPhone turun dari atas setelah 700ms
    const notifInTimer = setTimeout(() => {
      Animated.spring(notifY, {
        toValue: 0,
        friction: 8,
        tension: 45,
        useNativeDriver: true,
      }).start();
    }, 700);

    // 4. Notifikasi naik kembali setelah beberapa detik
    const notifOutTimer = setTimeout(() => {
      Animated.timing(notifY, {
        toValue: -120,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 3200);

    // 5. Total durasi splash screen (3.8 detik agar pengguna sempat melihat)
    const finishTimer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 3800);

    return () => {
      clearTimeout(notifInTimer);
      clearTimeout(notifOutTimer);
      clearTimeout(finishTimer);
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* NOTIFIKASI GAYA IPHONE TURUN DARI ATAS */}
      <Animated.View
        style={[
          styles.notifContainer,
          {
            transform: [{ translateY: notifY }],
          },
        ]}
      >
        <View style={styles.notifPill}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isOnline ? '#ECFDF5' : '#FEF2F2' },
            ]}
          >
            {isOnline ? (
              <Ionicons name="wifi" size={17} color="#059669" />
            ) : (
              <Ionicons name="cloud-offline" size={17} color="#DC2626" />
            )}
          </View>
          <Text style={styles.notifText}>
            {isOnline ? 'Anda sedang online' : 'Anda sedang offline'}
          </Text>
        </View>
      </Animated.View>

      {/* KONTEN UTAMA SPLASH */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* BADGE LOGO */}
        <View style={styles.logoBadge}>
          <Image
            source={require('@/assets/images/logo-splash.png')}
            style={styles.splashLogoImage}
            resizeMode="contain"
          />
        </View>

        {/* NAMA SISTEM */}
        <Text style={styles.title}>MILU SESEHATI</Text>
        <Text style={styles.subtitle}>Asisten Pintar Petani Jagung</Text>
      </Animated.View>

      {/* INDIKATOR LOADING MINIMALIS */}
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#A7F3D0" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#064E3B', // Hijau tua alami agrikultur
    alignItems: 'center',
    justifyContent: 'center',
  },
  // NOTIFIKASI GAYA IPHONE / WHATSAPP BANNER
  notifContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 40,
    width: width,
    alignItems: 'center',
    zIndex: 99,
  },
  notifPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  notifText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 0.2,
  },
  // KONTEN SPLASH
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  splashLogoImage: {
    width: 76,
    height: 76,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#A7F3D0',
    letterSpacing: 0.5,
    textAlign: 'center',
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
});
