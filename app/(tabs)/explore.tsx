import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, LayoutAnimation, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EXPLORE_DETAILS } from '../../constants/exploreData';
import { useTheme } from '../../context/ThemeContext';
import { getExploreDetails, subscribeDiseaseUpdates, syncDiseaseInfoFromServer } from '../../services/diseaseService';

// --- KOMPONEN ACCORDION (Hanya untuk Panduan & Tentang Aplikasi) ---
const AccordionItem = ({ 
  title, icon, color, expanded, onToggle, children 
}: { 
  title: string, icon: any, color: string, expanded: boolean, onToggle: () => void, children: React.ReactNode 
}) => {
  const { isDark } = useTheme();
  const styles = getStyles(isDark);
  const animationController = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animationController, {
      toValue: expanded ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [expanded]);

  const arrowTransform = animationController.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.accordionContainer}>
      <TouchableOpacity 
        style={styles.accordionHeader} 
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons name={icon} size={24} color={color} />
          <Text style={styles.accordionTitle}>{title}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: arrowTransform }] }}>
          <Ionicons name="chevron-down" size={24} color="#6B7280" />
        </Animated.View>
      </TouchableOpacity>
      
      {expanded && (
        <View style={styles.accordionBody}>
          {children}
        </View>
      )}
    </View>
  );
};

export default function ExploreScreen() {
  const { isDark } = useTheme();
  const styles = getStyles(isDark);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  
  // State untuk pop-up detail penyakit
  const [selectedDisease, setSelectedDisease] = useState<string | null>(null);
  const [diseaseInfo, setDiseaseInfo] = useState<{ nama: string; penjelasan: string } | null>(null);

  useEffect(() => {
    let active = true;
    if (selectedDisease) {
      getExploreDetails(selectedDisease).then((info) => {
        if (active) setDiseaseInfo(info);
      });
    } else {
      setDiseaseInfo(null);
    }
    return () => { active = false; };
  }, [selectedDisease]);

  // Real-time listener: jika admin mengupdate data di dashboard, langsung perbarui modal penjelasan
  useEffect(() => {
    const unsubscribe = subscribeDiseaseUpdates(() => {
      if (selectedDisease) {
        getExploreDetails(selectedDisease).then((info) => {
          setDiseaseInfo(info);
        });
      }
    });
    return () => {
      unsubscribe();
    };
  }, [selectedDisease]);

  // State untuk membuka halaman 'Lihat Semua'
  const [showAllGallery, setShowAllGallery] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncDiseaseInfoFromServer();
      if (selectedDisease) {
        const info = await getExploreDetails(selectedDisease);
        setDiseaseInfo(info);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const toggleMenu = (menuId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveMenu(activeMenu === menuId ? null : menuId);
  };

  const daftarKatalog = Object.keys(EXPLORE_DETAILS);

  const getImageForDisease = (key: string) => {
    switch (key) {
      case 'Bercak Daun':
        return require('../../assets/images/Bercak Daun.jpg');
      case 'Hawar Daun':
        return require('../../assets/images/Hawar daun.jpg');
      case 'Karat Daun':
        return require('../../assets/images/Karat Daun.jpg');
      case 'Jagung Sehat':
        return require('../../assets/images/Jagung Sehat.jpeg');
      default:
        return { uri: 'https://via.placeholder.com/400x200/cccccc/000000?text=FOTO' };
    }
  };

  // Komponen pembantu untuk merender Grid Item agar tidak perlu nulis kode berulang
  const renderGridItem = (key: string, index: number) => {
    const isSehat = key === 'Jagung Sehat';
    return (
      <TouchableOpacity 
        key={index} 
        style={styles.gridItem}
        activeOpacity={0.8}
        onPress={() => setSelectedDisease(key)}
      >
        <Image 
          source={getImageForDisease(key)}
          style={styles.gridImage}
          resizeMode="cover"
        />
        <View style={[styles.gridLabelBadge, isSehat ? {backgroundColor: '#059669'} : {backgroundColor: '#991B1B'}]}>
          <Text style={styles.gridLabelText}>{key}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER IDENTITAS TETAP / STICKY */}
      <View style={styles.mainHeader}>
        <MaterialCommunityIcons name="bookshelf" size={38} color="#34D399" />
        <View style={styles.headerTextWrap}>
          <Text style={styles.appName}>Pusat Informasi</Text>
          <Text style={styles.appSlogan}>Katalog Penyakit & Panduan Diagnosa</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={['#059669']} 
            tintColor={isDark ? '#34D399' : '#059669'} 
          />
        }
      >

        {/* 1. GALERI VISUAL TANAMAN */}
        <View style={styles.sectionTitleRow}>
          <View style={{flex: 1}}>
            <Text style={styles.sectionTitle}>Galeri Visual Tanaman</Text>
            <Text style={{fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 4}}>Cari gambar yang paling mirip dengan kondisi tanaman jagung Anda.</Text>
          </View>
          <TouchableOpacity onPress={() => setShowAllGallery(true)}>
            <Text style={styles.seeAllText}>Lihat Semua</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gridContainer}>
          {daftarKatalog.slice(0, 2).map((key, index) => renderGridItem(key, index))}
        </View>

        <View style={{height: 14}} />

        {/* 2. PANDUAN DIAGNOSA */}
        <AccordionItem 
          title="Panduan Diagnosa" 
          icon="camera-outline" 
          color="#059669"
          expanded={activeMenu === 'panduan'}
          onToggle={() => toggleMenu('panduan')}
        >
          <Text style={styles.textList}>1. Pastikan objek yang difoto adalah bagian tanaman jagung yang bergejala (misal: daun, batang, tongkol).</Text>
          <Text style={styles.textList}>2. Posisikan bagian tersebut agar terlihat jelas di tengah kamera.</Text>
          <Text style={styles.textList}>3. Gunakan pencahayaan yang terang (jangan terlalu gelap/silau).</Text>
          <Text style={styles.textList}>4. Tekan tombol 'Diagnosa Sekarang' dan tunggu hasilnya.</Text>
        </AccordionItem>

        <View style={{height: 10}} />

        {/* 3. TENTANG APLIKASI */}
        <AccordionItem 
          title="Tentang Aplikasi" 
          icon="information-circle-outline" 
          color="#059669"
          expanded={activeMenu === 'tentang'}
          onToggle={() => toggleMenu('tentang')}
        >
          <Text style={styles.aboutText}>
            <Text style={{fontWeight: 'bold'}}>Milu Sesehati</Text> adalah aplikasi berbasis Kecerdasan Buatan (AI) yang dirancang untuk membantu petani mendeteksi berbagai penyakit pada tanaman jagung secara otomatis menggunakan kamera smartphone.
          </Text>
          <View style={{height: 10}} />
          <Text style={styles.aboutText}>Versi: 1.0.0</Text>
          <View style={{height: 10}} />
          <Text style={[styles.aboutText, {fontStyle: 'italic', fontSize: 12, color: '#9CA3AF'}]}>
            *Aplikasi ini dikembangkan oleh Ricaldi Luma untuk keperluan Skripsi / Tugas Akhir.
          </Text>
        </AccordionItem>

        <View style={{height: 20}} />
      </ScrollView>

      <Modal
        visible={showAllGallery}
        animationType="slide"
        onRequestClose={() => setShowAllGallery(false)}>
        <SafeAreaView style={styles.fullGalleryContainer}>
          <View style={styles.fullGalleryHeader}>
            <TouchableOpacity onPress={() => setShowAllGallery(false)} style={{padding: 5}}>
              <Ionicons name="arrow-back" size={26} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.fullGalleryTitle}>Semua Tanaman</Text>
            <View style={{width: 30}} />
          </View>
          <ScrollView contentContainerStyle={{padding: 20}}>
            <View style={styles.gridContainer}>
              {daftarKatalog.map((key, index) => renderGridItem(key, index))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={selectedDisease !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedDisease(null)}>
        <BlurView intensity={25} tint={isDark ? 'dark' : 'light'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedDisease && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {diseaseInfo ? diseaseInfo.nama : (EXPLORE_DETAILS[selectedDisease]?.nama || selectedDisease)}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedDisease(null)} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#4B5563" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <Image 
                    source={getImageForDisease(selectedDisease)}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.modalDescText}>
                    {diseaseInfo ? diseaseInfo.penjelasan : (EXPLORE_DETAILS[selectedDisease]?.penjelasan || '')}
                  </Text>
                </ScrollView>
              </>
            )}
          </View>
        </BlurView>
      </Modal>
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
  mainHeader: {
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
  sectionTitleContainer: {
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 10,
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: isDark ? '#9CA3AF' : '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#059669',
  },
  
  // ACCORDION STYLES
  accordionContainer: {
    backgroundColor: isDark ? '#1F2937' : '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    borderWidth: 1,
    borderColor: isDark ? '#374151' : '#E5E7EB',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: isDark ? '#1F2937' : '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: isDark ? '#F9FAFB' : '#374151',
    marginLeft: 12,
    flexShrink: 1,
  },
  accordionBody: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: isDark ? '#1F2937' : '#fff',
  },
  textList: {
    fontSize: 14,
    color: isDark ? '#D1D5DB' : '#4B5563',
    marginBottom: 8,
    lineHeight: 22,
  },
  aboutText: {
    fontSize: 14,
    color: isDark ? '#D1D5DB' : '#4B5563',
    lineHeight: 22,
  },

  // GRID STYLES
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  gridItem: {
    width: '48%',
    backgroundColor: isDark ? '#1F2937' : '#fff',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    elevation: 3,
  },
  gridImage: {
    width: '100%',
    height: 120,
    backgroundColor: isDark ? '#374151' : '#E5E7EB',
  },
  gridLabelBadge: {
    paddingVertical: 8,
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  gridLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // MODAL STYLES (DETAIL PENYAKIT)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: isDark ? '#1F2937' : '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%',
    padding: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#374151' : '#E5E7EB',
    paddingBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDark ? '#F9FAFB' : '#1F2937',
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    flex: 1,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: isDark ? '#374151' : '#E5E7EB',
  },
  modalDescText: {
    fontSize: 15,
    color: isDark ? '#D1D5DB' : '#4B5563',
    lineHeight: 24,
    textAlign: 'justify',
  },

  // HALAMAN LIHAT SEMUA STYLES
  fullGalleryContainer: {
    flex: 1,
    backgroundColor: isDark ? '#111827' : '#F3F4F6',
  },
  fullGalleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: isDark ? '#1F2937' : '#fff',
    elevation: 2,
  },
  fullGalleryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDark ? '#F9FAFB' : '#1F2937',
  }
});