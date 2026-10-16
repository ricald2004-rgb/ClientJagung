import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

import { DISEASE_DETAILS } from '../constants/diseaseData';
import { useTheme } from '../context/ThemeContext';
import { getDiseaseDetails, subscribeDiseaseUpdates } from '../services/diseaseService';

export default function DetailScreen() {
  const router = useRouter();
  const { penyakit } = useLocalSearchParams<{ penyakit: string }>();

  const { isDark } = useTheme();
  const styles = getStyles(isDark);

  const fallback = DISEASE_DETAILS[penyakit] || DISEASE_DETAILS["Bukan Objek Jagung"];
  const [details, setDetails] = useState({
    deskripsi: fallback?.deskripsi || '',
    gejala: fallback?.gejala || '',
    solusi: fallback?.solusi || '',
  });

  useEffect(() => {
    let active = true;
    getDiseaseDetails(penyakit).then((d) => {
      if (active) {
        setDetails(d);
      }
    });
    return () => { active = false; };
  }, [penyakit]);

  // Real-time listener: jika materi diupdate di dashboard saat detail sedang dibuka, langsung perbarui tampilan
  useEffect(() => {
    const unsubscribe = subscribeDiseaseUpdates(() => {
      getDiseaseDetails(penyakit).then((d) => {
        setDetails(d);
        setModalData((prev) => {
          if (!prev.title) return prev;
          let newText = prev.text;
          if (prev.title === 'Deskripsi Penyakit') newText = d.deskripsi;
          else if (prev.title === 'Ciri-ciri & Gejala') newText = d.gejala;
          else if (prev.title.includes('Solusi')) newText = d.solusi;
          return { ...prev, text: newText };
        });
      });
    });
    return () => {
      unsubscribe();
    };
  }, [penyakit]);

  // State untuk Pop-up (Modal)
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState({ title: '', text: '', color: '#000', icon: 'alert' as any });

  const openModal = (title: string, text: string, color: string, icon: any) => {
    setModalData({ title, text, color, icon });
    setModalVisible(true);
  };

  // Komponen Kartu Preview
  const DetailCard = ({ title, icon, color, text }: { title: string, icon: any, color: string, text: string }) => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={[styles.iconBox, { backgroundColor: color + '1A' }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text numberOfLines={3} style={styles.sectionPreview}>
        {text}
      </Text>
      <TouchableOpacity 
        style={[styles.readMoreBtn, { backgroundColor: color }]} 
        onPress={() => openModal(title, text, color, icon)}
      >
        <Text style={styles.readMoreText}>Baca Rincian Penuh</Text>
        <Ionicons name="open-outline" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER NAVIGASI */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#F9FAFB' : '#1F2937'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Laporan Analisis</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* NAMA PENYAKIT (DIAM / STICKY DI ATAS) */}
      <View style={styles.stickyTitleContainer}>
        <Text style={styles.diseaseName}>{penyakit}</Text>
        <View style={styles.divider} />
      </View>

      {/* KONTEN YANG BISA DI-SCROLL */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <DetailCard 
          title="Deskripsi Penyakit" 
          icon="document-text" 
          color="#059669" 
          text={details.deskripsi} 
        />
        
        <DetailCard 
          title="Ciri-ciri & Gejala" 
          icon="leaf" 
          color="#059669" 
          text={details.gejala} 
        />
        
        <DetailCard 
          title="Solusi Penanganan" 
          icon="shield-checkmark" 
          color="#059669" 
          text={details.solusi} 
        />

      </ScrollView>

      {/* POP-UP (MODAL) UNTUK PENJELASAN PANJANG */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <BlurView intensity={25} tint={isDark ? 'dark' : 'light'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {/* Header Modal */}
            <View style={styles.modalHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                <Ionicons name={modalData.icon} size={24} color={modalData.color} style={{marginRight: 8}} />
                <Text style={[styles.modalTitle, {color: modalData.color}]}>{modalData.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            {/* Isi Teks Modal (Bisa discroll jika sangat panjang) */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalText}>{modalData.text}</Text>
            </ScrollView>

            <TouchableOpacity 
              style={[styles.closeModalBtn, {backgroundColor: modalData.color}]} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeModalBtnText}>Tutup Rincian</Text>
            </TouchableOpacity>

          </View>
        </BlurView>
      </Modal>

    </SafeAreaView>
  );
}

function getStyles(isDark: boolean) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#111827' : '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#1F2937' : '#fff',
    paddingHorizontal: 15,
    paddingVertical: 15,
    elevation: 2,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: isDark ? '#9CA3AF' : '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // NAMA PENYAKIT STICKY
  stickyTitleContainer: {
    backgroundColor: isDark ? '#1F2937' : '#fff',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#374151' : '#E5E7EB',
    elevation: 3,
    zIndex: 10, 
  },
  diseaseName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: isDark ? '#F9FAFB' : '#1F2937',
    textAlign: 'center',
  },
  divider: {
    width: 50,
    height: 4,
    backgroundColor: '#059669',
    borderRadius: 2,
    marginTop: 8,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: isDark ? '#1F2937' : '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: isDark ? '#374151' : '#F3F4F6',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: isDark ? '#F9FAFB' : '#374151',
  },
  sectionPreview: {
    fontSize: 14,
    color: isDark ? '#9CA3AF' : '#6B7280',
    lineHeight: 22,
    marginBottom: 15,
  },
  readMoreBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  readMoreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },

  // STYLES UNTUK POP-UP MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: isDark ? '#1F2937' : '#fff',
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#374151' : '#F3F4F6',
    backgroundColor: isDark ? '#111827' : '#F9FAFB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 15,
    color: isDark ? '#D1D5DB' : '#4B5563',
    lineHeight: 26,
    textAlign: 'justify',
  },
  closeModalBtn: {
    margin: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
}
