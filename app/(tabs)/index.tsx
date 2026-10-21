import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as tf from '@tensorflow/tfjs';
import { bundleResourceIO } from '../../utils/bundleResourceIO';
import { Buffer } from 'buffer';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useFocusEffect, useRouter } from 'expo-router';
import * as jpeg from 'jpeg-js';
import '../../utils/tfPlatform';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Image,
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { saveHistory } from '../../services/historyService';
import { formatRegionLabel, getUserRegion, UserRegion } from '../../services/regionService';
import axios from 'axios';
import {
  getBackendUrl,
  syncDiagnosisToServer,
  syncPendingDiagnoses,
} from '../../services/syncService';

let cachedModel: any = null;
let modelLoadingPromise: Promise<any> | null = null;

async function getOrLoadModel(): Promise<any> {
  if (cachedModel) return cachedModel;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    try {
      await tf.setBackend('cpu');
      await tf.ready();
      const modelJson = require('../../assets/model/model.json');
      const loadedModel = await tf.loadGraphModel(bundleResourceIO(modelJson));
      cachedModel = loadedModel;
      return loadedModel;
    } catch (err) {
      console.warn("Pemuatan model offline gagal:", err);
      modelLoadingPromise = null;
      throw err;
    }
  })();

  return modelLoadingPromise;
}

export default function HomeScreen() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const styles = getStyles(isDark);
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<any>(null);

  // State Wilayah Pengguna (Diambil di latar belakang untuk sinkronisasi hasil diagnosa)
  const [userRegion, setUserRegion] = useState<UserRegion | null>(null);

  // Ambil wilayah pengguna dari penyimpanan lokal secara senyap
  useEffect(() => {
    async function checkRegion() {
      const reg = await getUserRegion();
      setUserRegion(reg);
    }
    checkRegion();
  }, []);

  // Selalu perbarui label wilayah jika pengguna baru saja mengubah profil di tab Profil
  // & periksa antrean sinkronisasi setiap kali tab Home dibuka
  useFocusEffect(
    useCallback(() => {
      getUserRegion().then((reg) => {
        if (reg) setUserRegion(reg);
      });
      syncPendingDiagnoses();
    }, [])
  );

  useEffect(() => {
    getOrLoadModel()
      .then((m) => {
        if (m) setModel(m);
      })
      .catch((e) => {
        console.warn("Inisialisasi model offline di latar belakang:", e);
      });
  }, []);


  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
      setResult(null); 
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.granted === false) {
      Alert.alert("Izin Ditolak", "Aplikasi butuh izin kamera!");
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
      setResult(null);
    }
  };

  const analyzeImage = async () => {
    if (!image || !imageBase64) {
      Alert.alert("Perhatian", "Silakan pilih foto daun jagung terlebih dahulu.");
      return;
    }
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 150));

    // 1. JALUR UTAMA: MODEL OFFLINE LANGSUNG DI PERANGKAT
    let activeModel = model || cachedModel;
    if (!activeModel) {
      try {
        activeModel = await getOrLoadModel();
        if (activeModel) setModel(activeModel);
      } catch (loadErr) {
        console.warn("Pemuatan model on-demand:", loadErr);
      }
    }

    if (activeModel) {
      try {
        // Kompres & resize gambar langsung ke 224x224 via native Android (<20ms, tanpa beban RAM)
        const manipResult = await manipulateAsync(
          image,
          [{ resize: { width: 224, height: 224 } }],
          { format: SaveFormat.JPEG, base64: true }
        );

        const imgB64 = manipResult.base64 || imageBase64;
        const imageBuffer = new Uint8Array(Buffer.from(imgB64, 'base64'));
        const { data } = jpeg.decode(imageBuffer, { useTArray: true });
        
        const targetSize = 224;
        const buffer = new Float32Array(targetSize * targetSize * 3);
        let bufIdx = 0;

        for (let i = 0; i < targetSize * targetSize; i++) {
          const offset = i * 4;
          buffer[bufIdx++] = data[offset] / 255.0;
          buffer[bufIdx++] = data[offset + 1] / 255.0;
          buffer[bufIdx++] = data[offset + 2] / 255.0;
        }

        const inputTensor = tf.tidy(() => {
          return tf.tensor3d(buffer, [targetSize, targetSize, 3]).expandDims();
        });

        let predictions: any = null;
        let predData: Float32Array | Int32Array | Uint8Array;
        try {
          predictions = activeModel.predict(inputTensor);
          const predTensor = Array.isArray(predictions) ? predictions[0] : predictions;
          predData = await predTensor.data();
        } finally {
          try { inputTensor.dispose(); } catch {}
          if (Array.isArray(predictions)) {
            predictions.forEach((p: any) => { try { p?.dispose?.(); } catch {} });
          } else if (predictions && typeof predictions.dispose === 'function') {
            try { predictions.dispose(); } catch {}
          }
        }

        const CLASSES = ["Bercak Daun", "Bukan Objek Jagung", "Hawar Daun", "Jagung Sehat", "Karat Daun"];
        const dataArray = Array.from(predData) as number[];
        const mapped = dataArray.map((prob: number, index: number) => ({
          penyakit: CLASSES[index],
          probability: prob,
          score: prob,
          confidence: (prob * 100).toFixed(2) + "%"
        }));

        mapped.sort((a: any, b: any) => b.probability - a.probability);

        const UNCERTAINTY_THRESHOLD = 0.40;
        let topPenyakit = mapped[0].penyakit;
        if (mapped[0].score < UNCERTAINTY_THRESHOLD && mapped[0].penyakit !== "Bukan Objek Jagung") {
          topPenyakit = "Bukan Objek Jagung";
        }

        try {
          const currentRegion = await getUserRegion();
          const regionLabel = formatRegionLabel(currentRegion);
          const histId = `hist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          let isSynced = false;
          if (topPenyakit !== "Bukan Objek Jagung") {
            isSynced = await syncDiagnosisToServer({
              id: histId,
              penyakit: topPenyakit,
              confidence: mapped[0].confidence,
              top3: mapped.slice(0, 3),
              region: currentRegion,
              imageUri: image,
            });
          }

          const resData = {
            id: histId,
            penyakit: topPenyakit,
            confidence: mapped[0].confidence,
            top3: mapped.slice(0, 3),
            isSynced: isSynced,
          };
          setResult(resData);

          await saveHistory({
            id: histId,
            imageUri: image,
            penyakit: topPenyakit,
            confidence: mapped[0].confidence,
            top3: mapped.slice(0, 3),
            wilayah: regionLabel,
            provinsi: currentRegion?.provinsi,
            kabupaten: currentRegion?.kabupaten,
            kecamatan: currentRegion?.kecamatan,
            desa: currentRegion?.desa,
            isSynced: isSynced,
          });
        } catch (saveErr) {
          console.warn("Gagal menyimpan riwayat:", saveErr);
          setResult({
            penyakit: topPenyakit,
            confidence: mapped[0].confidence,
            top3: mapped.slice(0, 3),
            isSynced: false,
          });
        }
        setLoading(false);
        return;
      } catch (localErr) {
        console.warn("Inisiasi lokal belum selesai, beralih ke server fallback...", localErr);
      }
    }

    // 2. JALUR CADANGAN: SERVER-SIDE INFERENCE (SEKETIKA <1 DETIK)
    try {
      const serverUrl = getBackendUrl();
      const formData = new FormData();
      const filename = image.split('/').pop() || 'daun_jagung.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const fileType = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('image', {
        uri: image,
        name: filename,
        type: fileType,
      } as any);

      const serverRes = await axios.post(`${serverUrl}/predict`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 9000,
      });

      if (serverRes.data && serverRes.data.penyakit) {
        const sData = {
          penyakit: serverRes.data.penyakit,
          confidence: serverRes.data.confidence,
          top3: serverRes.data.top3 || [{ penyakit: serverRes.data.penyakit, confidence: serverRes.data.confidence }],
        };

        try {
          const currentRegion = await getUserRegion();
          const regionLabel = formatRegionLabel(currentRegion);
          const histId = `hist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          let isSynced = false;
          if (sData.penyakit !== "Bukan Objek Jagung") {
            isSynced = await syncDiagnosisToServer({
              id: histId,
              penyakit: sData.penyakit,
              confidence: sData.confidence,
              top3: sData.top3,
              region: currentRegion,
              imageUri: image,
            });
          }

          setResult({
            ...sData,
            id: histId,
            isSynced: isSynced,
          });

          await saveHistory({
            id: histId,
            imageUri: image,
            penyakit: sData.penyakit,
            confidence: sData.confidence,
            top3: sData.top3,
            wilayah: regionLabel,
            provinsi: currentRegion?.provinsi,
            kabupaten: currentRegion?.kabupaten,
            kecamatan: currentRegion?.kecamatan,
            desa: currentRegion?.desa,
            isSynced: isSynced,
          });
        } catch (saveErr) {
          console.warn("Gagal menyimpan riwayat server:", saveErr);
          setResult({
            ...sData,
            isSynced: false,
          });
        }
        return;
      }
    } catch (serverErr) {
      console.warn("Deteksi server gagal:", serverErr);
      Alert.alert(
        "Gagal Memproses Diagnosa",
        "Silakan coba beberapa saat lagi atau pastikan foto daun jagung terlihat jelas dan memiliki pencahayaan yang cukup."
      );
    } finally {
      setLoading(false);
    }
  };

  // --- FUNGSI TIPS DINAMIS ---
  const getDynamicTip = (top3: any[]) => {
    if (!top3 || top3.length < 2) return "Jika prediksi pertama kurang sesuai, periksa kemungkinan lainnya.";
    
    const p1 = top3[0].penyakit;
    const p2 = top3[1].penyakit;
    
    const isHawarBercak = (p1 === 'Hawar Daun' && p2 === 'Bercak Daun') || (p1 === 'Bercak Daun' && p2 === 'Hawar Daun');
    const hasKarat = (p1 === 'Karat Daun') || (p2 === 'Karat Daun');
    
    if (isHawarBercak) {
      return `Sistem melihat kemiripan antara ${p1} dan ${p2}. Coba perhatikan daunnya: Jika lukanya memanjang besar seperti cerutu, itu Hawar Daun. Jika lukanya berbentuk kotak/persegi panjang kecil, itu Bercak Daun.`;
    }
    
    if (hasKarat) {
      const penyakitLain = p1 === 'Karat Daun' ? p2 : p1;
      return `Sistem mendeteksi adanya Karat Daun dan ${penyakitLain}. Ingat: Karat Daun punya ciri khas bintik serbuk berwarna oranye kemerahan yang menonjol. Jika tidak ada serbuk oranye, kemungkinan itu ${penyakitLain}.`;
    }
    
    return "Jika hasil tebakan pertama (Akurasi Tertinggi) dirasa kurang mirip dengan kondisi daun jagung Anda, silakan cek rincian tebakan penyakit ke-2.";
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER IDENTITAS TETAP / STICKY */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image
            source={require('@/assets/images/logo-home.png')}
            style={styles.headerLogo}
            resizeMode="cover"
          />
          <View style={styles.headerTextWrap}>
            <Text style={styles.appName}>MILU SESEHATI</Text>
            <Text style={styles.appSlogan}>Asisten Pintar Petani Jagung</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerThemeBtn}
          activeOpacity={0.8}
          onPress={toggleTheme}
        >
          <Ionicons
            name={isDark ? "moon" : "sunny"}
            size={20}
            color={isDark ? "#FCD34D" : "#FEF08A"}
          />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex:1}}>
        <ScrollView contentContainerStyle={styles.scrollContent}>

          {/* AREA GAMBAR */}
          <View style={styles.imageCard}>
            {image ? (
              <Image source={{ uri: image }} style={styles.previewImage} />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="image-outline" size={80} color="#ccc" />
                <Text style={styles.placeholderText}>Belum ada foto dipilih</Text>
              </View>
            )}
            
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={takePhoto}>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.btnText}>Kamera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.galleryBtn]} onPress={pickImage}>
                <Ionicons name="images" size={20} color="#fff" />
                <Text style={styles.btnText}>Galeri</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* TOMBOL ANALISA */}
          {image && !result && !loading && (
            <TouchableOpacity 
              style={styles.analyzeBtn} 
              onPress={analyzeImage}
              activeOpacity={0.8}
            >
              <FontAwesome5 name="microscope" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.analyzeText}>DIAGNOSA SEKARANG</Text>
            </TouchableOpacity>
          )}

          {/* ANIMASI LOADING MURNI TANPA TEKS */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#059669" />
            </View>
          )}

          {/* HASIL DIAGNOSA */}
          {result && (
            <View style={styles.resultContainer}>
              {/* Header Hasil */}
              <View style={[
                styles.resultHeader, 
                result.penyakit === "Jagung Sehat" ? styles.bgSuccess : 
                result.penyakit === "Bukan Objek Jagung" ? styles.bgGray : styles.bgDanger
              ]}>
                <Text style={styles.resultTitle}>{result.penyakit}</Text>
                <Text style={styles.confidenceBadge}>Akurasi Tertinggi: {result.confidence}</Text>
              </View>

              {/* TAMPILAN 3 KEMUNGKINAN TERATAS */}
              {result.top3 && (
                <View style={styles.top3Container}>
                  <Text style={styles.top3Title}>Validasi Kemungkinan (Top 3):</Text>
                  {result.top3.map((item: any, idx: number) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={styles.top3Row}
                      activeOpacity={0.7}
                      onPress={() => router.push({ pathname: '/detail', params: { penyakit: item.penyakit } })}
                    >
                      <Text style={styles.top3Name}>{item.penyakit}</Text>
                      <View style={styles.top3BarContainer}>
                        <View style={[styles.top3BarFill, { width: item.confidence }]} />
                      </View>
                      <Text style={styles.top3Score}>{item.confidence}</Text>
                      <Ionicons name="chevron-forward" size={14} color={isDark ? '#9CA3AF' : '#6B7280'} style={{marginLeft: 4}} />
                    </TouchableOpacity>
                  ))}
                  
                  {/* HELPER TEXT UNTUK PETANI (DINAMIS) */}
                  {result.penyakit !== "Bukan Objek Jagung" && result.penyakit !== "Jagung Sehat" && (
                    <View style={styles.helperBox}>
                      <Ionicons name="information-circle" size={18} color="#059669" style={{marginTop: 2}} />
                      <Text style={styles.helperText}>
                        <Text style={{fontWeight: 'bold'}}>Tips Analisis: </Text> 
                        {getDynamicTip(result.top3)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* TOMBOL HALAMAN RINCIAN */}
              <View style={styles.actionBox}>
                <TouchableOpacity 
                  style={styles.detailBtn}
                  onPress={() => router.push({ pathname: '/detail', params: { penyakit: result.penyakit } })}
                >
                  <Text style={styles.detailBtnText}>Lihat Laporan Penanganan</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#111827' : '#F3F4F6',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#065F46' : '#064E3B', 
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.15,
    shadowRadius: 4,
  },
  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  headerTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  appSlogan: {
    color: '#A7F3D0',
    fontSize: 12,
    marginTop: 2,
  },
  imageCard: {
    backgroundColor: isDark ? '#1F2937' : '#fff',
    borderRadius: 20,
    padding: 15,
    alignItems: 'center',
    elevation: 3,
    marginBottom: 15,
  },
  previewImage: {
    width: 250,
    height: 250,
    borderRadius: 15,
    marginBottom: 15,
  },
  placeholder: {
    width: 250,
    height: 250,
    backgroundColor: isDark ? '#374151' : '#F9FAFB',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: isDark ? '#4B5563' : '#E5E7EB',
    borderStyle: 'dashed',
    marginBottom: 15,
  },
  placeholderText: {
    color: isDark ? '#9CA3AF' : '#9CA3AF',
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#059669',
    padding: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  galleryBtn: {
    backgroundColor: isDark ? '#374151' : '#4B5563',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  analyzeBtn: {
    backgroundColor: '#059669',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 4,
  },
  analyzeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  resultContainer: {
    backgroundColor: isDark ? '#1F2937' : '#fff',
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 3,
  },
  resultHeader: {
    padding: 15,
    alignItems: 'center',
  },
  bgSuccess: { backgroundColor: '#059669' },
  bgDanger: { backgroundColor: '#991B1B' },
  bgGray: { backgroundColor: '#757575' },
  resultTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  confidenceBadge: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 5,
    fontSize: 12,
  },
  // STYLES UNTUK TOP 3
  top3Container: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 15,
    backgroundColor: isDark ? '#1F2937' : '#fff',
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#374151' : '#E5E7EB',
  },
  top3Title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: isDark ? '#D1D5DB' : '#374151',
    marginBottom: 10,
  },
  top3Row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  top3Name: {
    flex: 1.5,
    fontSize: 13,
    color: isDark ? '#9CA3AF' : '#4B5563',
  },
  top3BarContainer: {
    flex: 2,
    height: 8,
    backgroundColor: isDark ? '#374151' : '#E5E7EB',
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  top3BarFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 4,
  },
  top3Score: {
    width: 45,
    fontSize: 12,
    fontWeight: 'bold',
    color: isDark ? '#D1D5DB' : '#374151',
    textAlign: 'right',
  },
  
  // STYLES UNTUK HELPER TEXT (TIPS PETANI)
  helperBox: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#374151' : '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
  },
  helperText: {
    flex: 1,
    fontSize: 12,
    color: isDark ? '#D1D5DB' : '#4B5563',
    marginLeft: 8,
    lineHeight: 18,
  },

  actionBox: {
    padding: 20,
    backgroundColor: isDark ? '#1F2937' : '#fff',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  detailBtn: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    elevation: 2,
  },
  detailBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerThemeBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
});