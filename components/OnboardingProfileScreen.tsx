import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { INDONESIA_REGIONS, PROVINCES_LIST } from '../constants/indonesiaRegions';
import { useTheme } from '../context/ThemeContext';
import { FarmerProfile, saveFarmerProfile } from '../services/profileService';
import { formatRegionLabel } from '../services/regionService';
import { syncFarmerProfileToServer } from '../services/syncService';

type PickerType = 'provinsi' | 'kabupaten' | null;

interface OnboardingProps {
  onComplete: () => void;
}

export default function OnboardingProfileScreen({ onComplete }: OnboardingProps) {
  const { isDark } = useTheme();
  const styles = getStyles(isDark);

  // Form State
  const [nama, setNama] = useState<string>('');
  const [noHp, setNoHp] = useState<string>('');
  const [kelompokTani, setKelompokTani] = useState<string>('');
  const [provinsi, setProvinsi] = useState<string>('Gorontalo'); // Default disorot ke Gorontalo untuk kemudahan
  const [kabupaten, setKabupaten] = useState<string>('');
  const [kecamatan, setKecamatan] = useState<string>('');
  const [desa, setDesa] = useState<string>('');
  const [tipeDesa, setTipeDesa] = useState<'Desa' | 'Kelurahan'>('Desa');

  // Sub-picker Modal State
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Filter daftar untuk picker provinsi / kabupaten
  const availableKabupaten = provinsi && INDONESIA_REGIONS[provinsi] ? INDONESIA_REGIONS[provinsi] : [];
  const currentList = activePicker === 'provinsi' ? PROVINCES_LIST : availableKabupaten;
  const filteredList = currentList.filter((item) =>
    item.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleSelectProvinsi = (prov: string) => {
    setProvinsi(prov);
    setKabupaten('');
    setDesa('');
    setActivePicker(null);
    setSearchQuery('');
  };

  const handleSelectKabupaten = (kab: string) => {
    setKabupaten(kab);
    if (kab.toLowerCase().includes('kota')) {
      setTipeDesa('Kelurahan');
    } else {
      setTipeDesa('Desa');
    }
    setActivePicker(null);
    setSearchQuery('');
  };

  const handleSaveAndProceed = async () => {
    const cleanNama = nama.trim();
    if (!cleanNama || cleanNama.length < 2) {
      Alert.alert('Perhatian', 'Mohon masukkan Nama Lengkap Petani dengan benar.');
      return;
    }
    if (!provinsi || !kabupaten) {
      Alert.alert('Perhatian', 'Silakan pilih Provinsi dan Kabupaten / Kota lokasi kebun Anda.');
      return;
    }

    setSaving(true);
    try {
      const profileData: FarmerProfile = {
        nama: cleanNama,
        noHp: noHp.trim() || undefined,
        kelompokTani: kelompokTani.trim() || 'Petani Mandiri',
        provinsi,
        kabupaten,
        kecamatan: kecamatan.trim() || undefined,
        desa: desa.trim() || undefined,
        tipeDesa,
      };

      // 1. Simpan ke local storage
      await saveFarmerProfile(profileData);

      // 2. Sinkronkan profil ke server monitoring di latar belakang
      syncFarmerProfileToServer(profileData).catch(() => {});

      // 3. Masuk ke aplikasi utama
      onComplete();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', 'Terjadi kendala saat menyimpan profil: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const regionSummary = formatRegionLabel({
    provinsi,
    kabupaten,
    kecamatan: kecamatan.trim() || undefined,
    desa: desa.trim() || undefined,
    tipeDesa,
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ========================================== */}
          {/* HEADER ONBOARDING ALA M-BANKING           */}
          {/* ========================================== */}
          <View style={styles.headerCard}>
            <View style={styles.badgeWrap}>
              <View style={styles.badgePill}>
                <Ionicons name="shield-checkmark" size={13} color="#047857" />
                <Text style={styles.badgeText}>Registrasi Petani Baru</Text>
              </View>
              <Text style={styles.stepIndicator}>Langkah 1 dari 1</Text>
            </View>

            <View style={styles.headerMain}>
              <Image
                source={require('../assets/images/icon.png')}
                style={styles.logoImg}
                resizeMode="contain"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.welcomeTitle}>MILU SESEHATI</Text>
                <Text style={styles.welcomeSubtitle}>Lengkapi Profil Petani Anda</Text>
              </View>
            </View>

            <Text style={styles.headerDescription}>
              Sebagai standar pendataan resmi, mohon lengkapi identitas Anda satu kali untuk menghubungkan rekam diagnosa penyakit jagung dengan kebun Anda.
            </Text>
          </View>

          {/* ========================================== */}
          {/* SECTION 1: DATA IDENTITAS DIRI PETANI      */}
          {/* ========================================== */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <MaterialCommunityIcons name="account-details" size={20} color="#059669" />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Identitas Petani</Text>
                <Text style={styles.sectionSub}>Data utama pemilik atau pengelola kebun</Text>
              </View>
            </View>

            {/* Nama Lengkap */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Nama Lengkap Petani <Text style={styles.requiredMark}>*</Text>
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={nama}
                  onChangeText={setNama}
                  placeholder="Contoh: Pak Budi Santoso"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  autoCapitalize="words"
                />
              </View>
              <Text style={styles.fieldHint}>Nama ini akan otomatis tertera pada riwayat diagnosa Anda.</Text>
            </View>

            {/* Nomor HP / WhatsApp */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nomor WhatsApp / HP Aktif</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="logo-whatsapp" size={18} color="#10B981" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={noHp}
                  onChangeText={setNoHp}
                  keyboardType="phone-pad"
                  placeholder="Contoh: 081234567890"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                />
              </View>
              <Text style={styles.fieldHint}>Bermanfaat jika petugas penyuluh atau dinas ingin menghubungi Anda.</Text>
            </View>

            {/* Kelompok Tani */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Kelompok Tani (Poktan)</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="people-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={kelompokTani}
                  onChangeText={setKelompokTani}
                  placeholder="Contoh: Karya Bersama (atau ketik Mandiri)"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                />
              </View>
            </View>
          </View>

          {/* ========================================== */}
          {/* SECTION 2: LOKASI KEBUN / LAHAN JAGUNG    */}
          {/* ========================================== */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="location" size={20} color="#059669" />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Lokasi Kebun / Lahan Jagung</Text>
              </View>
            </View>

            {/* 1. Provinsi */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                1. Provinsi <Text style={styles.requiredMark}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                activeOpacity={0.7}
                onPress={() => {
                  setSearchQuery('');
                  setActivePicker('provinsi');
                }}
              >
                <Ionicons name="business-outline" size={18} color={provinsi ? '#059669' : (isDark ? '#9CA3AF' : '#6B7280')} style={styles.inputIcon} />
                <Text style={[styles.dropdownText, !provinsi && styles.placeholderText]}>
                  {provinsi || '-- Pilih Provinsi --'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            {/* 2. Kabupaten / Kota */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                2. Kabupaten / Kota <Text style={styles.requiredMark}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdownBtn, !provinsi && styles.disabledBtn]}
                activeOpacity={0.7}
                disabled={!provinsi}
                onPress={() => {
                  setSearchQuery('');
                  setActivePicker('kabupaten');
                }}
              >
                <Ionicons name="trail-sign-outline" size={18} color={kabupaten ? '#059669' : (isDark ? '#9CA3AF' : '#6B7280')} style={styles.inputIcon} />
                <Text style={[styles.dropdownText, !kabupaten && styles.placeholderText]}>
                  {kabupaten || (!provinsi ? 'Pilih provinsi terlebih dahulu' : '-- Pilih Kabupaten / Kota --')}
                </Text>
                <Ionicons name="chevron-down" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            {/* 3. Kecamatan */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>3. Kecamatan</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="navigate-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={kecamatan}
                  onChangeText={setKecamatan}
                />
              </View>
            </View>

            {/* 4. Desa / Kelurahan */}
            <View style={styles.formGroup}>
              <View style={styles.desaHeaderRow}>
                <Text style={styles.label}>4. Desa / Kelurahan</Text>
                <View style={styles.togglePill}>
                  <TouchableOpacity
                    style={[styles.toggleOpt, tipeDesa === 'Desa' && styles.toggleOptActive]}
                    onPress={() => setTipeDesa('Desa')}
                  >
                    <Text style={[styles.toggleText, tipeDesa === 'Desa' && styles.toggleTextActive]}>
                      Desa
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleOpt, tipeDesa === 'Kelurahan' && styles.toggleOptActive]}
                    onPress={() => setTipeDesa('Kelurahan')}
                  >
                    <Text style={[styles.toggleText, tipeDesa === 'Kelurahan' && styles.toggleTextActive]}>
                      Kelurahan
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="home-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={desa}
                  onChangeText={setDesa}
                />
              </View>
            </View>

            {/* Preview Ringkasan Wilayah */}
            {Boolean(provinsi && kabupaten) && (
              <View style={styles.regionSummaryCard}>
                <Ionicons name="location-sharp" size={18} color="#059669" style={{ marginRight: 8, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.regionSummaryTitle}>Ringkasan Wilayah Kebun:</Text>
                  <Text style={styles.regionSummaryText}>{regionSummary}</Text>
                </View>
              </View>
            )}
          </View>

          {/* ========================================== */}
          {/* SECTION 3: PRIVASI & KEAMANAN ALA M-BANKING */}
          {/* ========================================== */}
          <View style={styles.privacyCard}>
            <Ionicons name="lock-closed" size={18} color="#047857" style={{ marginRight: 8, marginTop: 2 }} />
            <Text style={styles.privacyText}>
              Data Anda disimpan secara aman di perangkat HP Anda dan disinkronkan ke server pemantauan pertanian untuk keperluan rekam medis tanaman jagung. Anda tetap dapat memperbarui profil ini kapan saja di menu <Text style={{ fontWeight: 'bold' }}>Profil</Text>.
            </Text>
          </View>

          {/* ========================================== */}
          {/* TOMBOL SUBMIT BESAR ALA M-BANKING         */}
          {/* ========================================== */}
          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
            activeOpacity={0.85}
            onPress={handleSaveAndProceed}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>SIMPAN & MASUK KE APLIKASI</Text>
                <Ionicons name="arrow-forward-circle" size={24} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ========================================== */}
      {/* MODAL SEARCH PICKER PROVINSI / KABUPATEN   */}
      {/* ========================================== */}
      <Modal
        visible={activePicker !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActivePicker(null)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header Modal */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {activePicker === 'provinsi' ? 'Pilih Provinsi Lahan' : `Kabupaten / Kota di ${provinsi}`}
                </Text>
                <Text style={styles.modalSubTitle}>
                  {filteredList.length} wilayah ditemukan
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setActivePicker(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={isDark ? '#E5E7EB' : '#374151'} />
              </TouchableOpacity>
            </View>

            {/* Input Pencarian */}
            <View style={styles.searchBarWrap}>
              <Ionicons name="search" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Ketik untuk mencari wilayah..."
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </TouchableOpacity>
              )}
            </View>

            {/* Daftar Wilayah */}
            <FlatList
              data={filteredList}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const isSelected = activePicker === 'provinsi' ? provinsi === item : kabupaten === item;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      if (activePicker === 'provinsi') {
                        handleSelectProvinsi(item);
                      } else {
                        handleSelectKabupaten(item);
                      }
                    }}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'location-outline'}
                      size={20}
                      color={isSelected ? '#059669' : (isDark ? '#9CA3AF' : '#6B7280')}
                      style={{ marginRight: 12 }}
                    />
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="alert-circle-outline" size={36} color="#9CA3AF" />
                  <Text style={styles.emptyText}>Wilayah tidak ditemukan.</Text>
                </View>
              }
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0B1315' : '#F3F6F5',
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 40,
    },
    headerCard: {
      backgroundColor: isDark ? '#062E25' : '#ECFDF5',
      borderRadius: 24,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? '#064E3B' : '#A7F3D0',
    },
    badgeWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    badgePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#064E3B' : '#D1FAE5',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 5,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#6EE7B7' : '#047857',
    },
    stepIndicator: {
      fontSize: 11,
      fontWeight: '600',
      color: isDark ? '#9CA3AF' : '#6B7280',
    },
    headerMain: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 12,
    },
    logoImg: {
      width: 48,
      height: 48,
    },
    welcomeTitle: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 1,
      color: isDark ? '#6EE7B7' : '#047857',
      textTransform: 'uppercase',
    },
    welcomeSubtitle: {
      fontSize: 18,
      fontWeight: '800',
      color: isDark ? '#FFFFFF' : '#064E3B',
      marginTop: 2,
    },
    headerDescription: {
      fontSize: 12,
      lineHeight: 18,
      color: isDark ? '#D1D5DB' : '#374151',
      marginTop: 4,
    },
    sectionCard: {
      backgroundColor: isDark ? '#141E22' : '#FFFFFF',
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? '#1F2E35' : '#E5E7EB',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 10,
    },
    sectionIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: isDark ? '#064E3B40' : '#D1FAE5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    sectionSub: {
      fontSize: 11,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginTop: 1,
    },
    formGroup: {
      marginBottom: 14,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#E5E7EB' : '#374151',
      marginBottom: 6,
    },
    requiredMark: {
      color: '#EF4444',
      fontWeight: 'bold',
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1B272C' : '#F9FAFB',
      borderWidth: 1,
      borderColor: isDark ? '#2D3E46' : '#D1D5DB',
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 48,
    },
    inputIcon: {
      marginRight: 8,
    },
    textInput: {
      flex: 1,
      fontSize: 13,
      color: isDark ? '#FFFFFF' : '#111827',
      paddingVertical: 0,
    },
    fieldHint: {
      fontSize: 10,
      color: isDark ? '#6B7280' : '#9CA3AF',
      marginTop: 4,
      marginLeft: 4,
    },
    dropdownBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1B272C' : '#F9FAFB',
      borderWidth: 1,
      borderColor: isDark ? '#2D3E46' : '#D1D5DB',
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 48,
    },
    disabledBtn: {
      opacity: 0.5,
    },
    dropdownText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    placeholderText: {
      color: isDark ? '#6B7280' : '#9CA3AF',
      fontWeight: '400',
    },
    desaHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    togglePill: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#1B272C' : '#E5E7EB',
      borderRadius: 14,
      padding: 2,
    },
    toggleOpt: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
    },
    toggleOptActive: {
      backgroundColor: '#059669',
    },
    toggleText: {
      fontSize: 10,
      fontWeight: '600',
      color: isDark ? '#9CA3AF' : '#6B7280',
    },
    toggleTextActive: {
      color: '#FFFFFF',
    },
    regionSummaryCard: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#064E3B20' : '#ECFDF5',
      borderWidth: 1,
      borderColor: isDark ? '#064E3B' : '#A7F3D0',
      borderRadius: 12,
      padding: 12,
      marginTop: 4,
    },
    regionSummaryTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#6EE7B7' : '#065F46',
      marginBottom: 2,
    },
    regionSummaryText: {
      fontSize: 11,
      color: isDark ? '#D1FAE5' : '#047857',
      lineHeight: 16,
    },
    privacyCard: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#0F1A1C' : '#F0FDF4',
      borderWidth: 1,
      borderColor: isDark ? '#1E3236' : '#DCFCE7',
      borderRadius: 14,
      padding: 14,
      marginBottom: 20,
    },
    privacyText: {
      flex: 1,
      fontSize: 11,
      lineHeight: 16,
      color: isDark ? '#9CA3AF' : '#4B5563',
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#059669',
      borderRadius: 16,
      height: 54,
      shadowColor: '#059669',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
      gap: 10,
    },
    submitButtonDisabled: {
      opacity: 0.7,
    },
    submitButtonText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },

    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: isDark ? '#141E22' : '#FFFFFF',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: '85%',
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    modalSubTitle: {
      fontSize: 11,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginTop: 2,
    },
    modalCloseBtn: {
      padding: 6,
      borderRadius: 16,
      backgroundColor: isDark ? '#1B272C' : '#F3F4F6',
    },
    searchBarWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1B272C' : '#F3F4F6',
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 44,
      marginBottom: 14,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: isDark ? '#FFFFFF' : '#111827',
    },
    modalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#1F2E35' : '#F3F4F6',
    },
    modalItemSelected: {
      backgroundColor: isDark ? '#064E3B30' : '#ECFDF5',
      borderRadius: 10,
      paddingHorizontal: 8,
    },
    modalItemText: {
      fontSize: 13,
      color: isDark ? '#E5E7EB' : '#374151',
      fontWeight: '500',
    },
    modalItemTextSelected: {
      color: '#059669',
      fontWeight: '700',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: 8,
    },
    emptyText: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
    },
  });

