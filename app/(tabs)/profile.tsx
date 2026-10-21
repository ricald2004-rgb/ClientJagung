import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { INDONESIA_REGIONS, PROVINCES_LIST } from '../../constants/indonesiaRegions';
import { useTheme } from '../../context/ThemeContext';
import { FarmerProfile, getFarmerProfile, saveFarmerProfile } from '../../services/profileService';
import { formatRegionLabel } from '../../services/regionService';
import {
  getBackendUrl,
  resetCustomServerUrl,
  setCustomServerUrl,
  syncFarmerProfileToServer,
  syncPendingDiagnoses,
  testServerConnection,
} from '../../services/syncService';

type PickerType = 'provinsi' | 'kabupaten' | null;

export default function ProfileScreen() {
  const { isDark } = useTheme();
  const styles = getStyles(isDark);

  // Profile data from storage
  const [profile, setProfile] = useState<FarmerProfile | null>(null);
  // Mode: jika profil sudah pernah disimpan maka default ke mode Detail (false), jika belum ada profil maka langsung mode Form (true)
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Form State
  const [nama, setNama] = useState<string>('');
  const [noHp, setNoHp] = useState<string>('');
  const [kelompokTani, setKelompokTani] = useState<string>('');
  const [provinsi, setProvinsi] = useState<string>('');
  const [kabupaten, setKabupaten] = useState<string>('');
  const [kecamatan, setKecamatan] = useState<string>('');
  const [desa, setDesa] = useState<string>('');
  const [tipeDesa, setTipeDesa] = useState<'Desa' | 'Kelurahan'>('Desa');

  // Sub-picker Modal State
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Server URL & Connection State
  const [serverUrl, setServerUrl] = useState<string>(getBackendUrl());
  const [showServerModal, setShowServerModal] = useState<boolean>(false);
  const [inputServerUrl, setInputServerUrl] = useState<string>('');
  const [testingConnection, setTestingConnection] = useState<boolean>(false);

  const handleTestServer = async (targetUrl?: string) => {
    setTestingConnection(true);
    const active = targetUrl || serverUrl;
    const res = await testServerConnection(active);
    setTestingConnection(false);
    if (res.success) {
      const count = await syncPendingDiagnoses().catch(() => 0);
      if (count > 0) {
        Alert.alert('✅ Terhubung!', `Koneksi berhasil!\n${count} data riwayat tertunda berhasil otomatis disinkronkan ke website.`);
      } else {
        Alert.alert('✅ Terhubung!', 'Koneksi ke website monitoring aktif & siap menerima data diagnosa.');
      }
    } else {
      Alert.alert('❌ Gagal Terhubung', `${res.message}\n\nPastikan URL server benar dan server di laptop aktif.`);
    }
  };

  const handleSaveServerUrl = async () => {
    if (!inputServerUrl.trim()) {
      await resetCustomServerUrl();
      const def = getBackendUrl();
      setServerUrl(def);
      setShowServerModal(false);
      Alert.alert('Server Direset', 'URL server dikembalikan ke default:\n' + def);
      return;
    }
    await setCustomServerUrl(inputServerUrl.trim());
    const newUrl = getBackendUrl();
    setServerUrl(newUrl);
    setShowServerModal(false);
    handleTestServer(newUrl);
  };

  const handleManualSync = async () => {
    setTestingConnection(true);
    try {
      const count = await syncPendingDiagnoses();
      if (count > 0) {
        Alert.alert('🎉 Sinkronisasi Berhasil!', `${count} riwayat diagnosa berhasil dikirim ke website monitoring.`);
      } else {
        Alert.alert('Informasi', 'Seluruh riwayat diagnosa di HP sudah tersinkron ke website monitoring.');
      }
    } catch (err: any) {
      Alert.alert('Gagal Sinkron', err.message || 'Server belum dapat dijangkau.');
    } finally {
      setTestingConnection(false);
    }
  };

  // Muat data profil saat halaman pertama dibuka
  useEffect(() => {
    async function loadData() {
      const data = await getFarmerProfile();
      if (data && data.nama && data.provinsi) {
        setProfile(data);
        populateForm(data);
        setIsEditing(false); // Sudah ada profil -> tampilkan Mode Detail
        syncFarmerProfileToServer(data).catch(() => {});
      } else {
        setIsEditing(true); // Belum ada profil -> langsung tampilkan Form
      }
    }
    loadData();
  }, []);

  const populateForm = (data: FarmerProfile) => {
    setNama(data.nama || '');
    setNoHp(data.noHp || '');
    setKelompokTani(data.kelompokTani || '');
    setProvinsi(data.provinsi || '');
    setKabupaten(data.kabupaten || '');
    setKecamatan(data.kecamatan || '');
    setDesa(data.desa || '');
    if (data.tipeDesa) {
      setTipeDesa(data.tipeDesa);
    } else if (data.kabupaten && data.kabupaten.toLowerCase().includes('kota')) {
      setTipeDesa('Kelurahan');
    } else {
      setTipeDesa('Desa');
    }
  };

  const handleStartEdit = () => {
    if (profile) {
      populateForm(profile);
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (profile) {
      populateForm(profile);
      setIsEditing(false);
    }
  };

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
    // Otomatis deteksi: jika Kota -> Kelurahan, jika Kabupaten -> Desa
    if (kab.toLowerCase().includes('kota')) {
      setTipeDesa('Kelurahan');
    } else {
      setTipeDesa('Desa');
    }
    setActivePicker(null);
    setSearchQuery('');
  };

  const handleSave = async () => {
    if (!nama.trim()) {
      Alert.alert('Perhatian', 'Nama petani wajib diisi.');
      return;
    }
    if (!provinsi || !kabupaten) {
      Alert.alert('Perhatian', 'Silakan pilih Provinsi dan Kabupaten / Kota terlebih dahulu.');
      return;
    }

    setSaving(true);
    try {
      const profileData: FarmerProfile = {
        nama: nama.trim(),
        noHp: noHp.trim() || undefined,
        kelompokTani: kelompokTani.trim() || undefined,
        provinsi,
        kabupaten,
        kecamatan: kecamatan.trim() || undefined,
        desa: desa.trim() || undefined,
        tipeDesa,
      };

      await saveFarmerProfile(profileData);
      setProfile(profileData);
      setIsEditing(false); // Setelah disimpan, beralih ke Mode Detail

      // Sinkronkan data profil petani ke web dashboard
      syncFarmerProfileToServer(profileData).catch(() => {});

      Alert.alert(
        'Profil Tersimpan!',
        'Data identitas dan wilayah kebun jagung Anda berhasil disimpan.'
      );
    } catch (err: any) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan profil: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const detailRegionSummary = profile
    ? formatRegionLabel({
        provinsi: profile.provinsi,
        kabupaten: profile.kabupaten,
        kecamatan: profile.kecamatan,
        desa: profile.desa,
        tipeDesa: profile.tipeDesa,
      })
    : '';

  const formRegionSummary = formatRegionLabel({
    provinsi,
    kabupaten,
    kecamatan: kecamatan.trim() || undefined,
    desa: desa.trim() || undefined,
    tipeDesa,
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER IDENTITAS TETAP / STICKY */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="account-circle" size={38} color="#34D399" />
        <View style={styles.headerTextWrap}>
          <Text style={styles.appName}>Profil Petani</Text>
          <Text style={styles.appSlogan}>Identitas & Wilayah Lahan Jagung</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ========================================================= */}
          {/* 1. MODE DETAIL: TAMPIL JIKA PROFIL SUDAH DIISI & DISIMPAN */}
          {/* ========================================================= */}
          {!isEditing && profile ? (
            <View style={styles.detailContainer}>
              {/* KARTU UTAMA IDENTITAS PETANI */}
              <View style={styles.avatarCard}>
                <View style={styles.avatarCircle}>
                  <Ionicons name="person" size={44} color="#fff" />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.avatarName} numberOfLines={1}>
                    {profile.nama}
                  </Text>
                  <Text style={styles.avatarRole}>
                    {profile.kelompokTani ? `Kelompok Tani: ${profile.kelompokTani}` : 'Petani Jagung'}
                  </Text>
                  <View style={styles.locationBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#059669" />
                    <Text style={styles.locationBadgeText} numberOfLines={1}>
                      Data Profil Lengkap
                    </Text>
                  </View>
                </View>
              </View>

              {/* CARD RINCIAN IDENTITAS */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="person-outline" size={20} color="#059669" style={{ marginRight: 8 }} />
                  <Text style={styles.sectionTitle}>Identitas Pribadi</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nama Lengkap</Text>
                  <Text style={styles.detailValue}>{profile.nama}</Text>
                </View>

                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nomor HP / WA</Text>
                  <Text style={styles.detailValue}>{profile.noHp || '-'}</Text>
                </View>

                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Kelompok Tani</Text>
                  <Text style={styles.detailValue}>{profile.kelompokTani || 'Petani Mandiri'}</Text>
                </View>
              </View>

              {/* CARD RINCIAN WILAYAH LAHAN */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="map-outline" size={20} color="#059669" style={{ marginRight: 8 }} />
                  <Text style={styles.sectionTitle}>Wilayah Lahan Pertanian</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Provinsi</Text>
                  <Text style={styles.detailValue}>{profile.provinsi}</Text>
                </View>

                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Kabupaten / Kota</Text>
                  <Text style={styles.detailValue}>{profile.kabupaten}</Text>
                </View>

                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Kecamatan</Text>
                  <Text style={styles.detailValue}>{profile.kecamatan || '-'}</Text>
                </View>

                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{profile.tipeDesa || 'Desa / Kelurahan'}</Text>
                  <Text style={styles.detailValue}>{profile.desa || '-'}</Text>
                </View>

                <View style={styles.summaryBox}>
                  <Ionicons name="location-sharp" size={20} color="#059669" style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryTitle}>Alamat Terdaftar:</Text>
                    <Text style={styles.summaryText}>{detailRegionSummary}</Text>
                  </View>
                </View>
              </View>

              {/* TOMBOL UBAH PROFIL */}
              <TouchableOpacity
                style={styles.editBtn}
                activeOpacity={0.8}
                onPress={handleStartEdit}
              >
                <Ionicons name="create-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.editBtnText}>UBAH PROFIL</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ========================================================= */
            /* 2. MODE FORM: TAMPIL JIKA MENGISI AWAL ATAU TEKAN UBAH    */
            /* ========================================================= */
            <View>
              {/* BANNER INFO FORM */}
              <View style={styles.formInfoBanner}>
                <Ionicons name="information-circle" size={20} color="#059669" style={{ marginRight: 8 }} />
                <Text style={styles.formInfoText}>
                  Silakan lengkapi formulir di bawah ini. Setelah disimpan, halaman ini akan menampilkan rincian data profil Anda.
                </Text>
              </View>

              {/* SECTION 1: DATA IDENTITAS PETANI */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="person-circle-outline" size={20} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitle}>Identitas Petani</Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Nama Lengkap *</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="person-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={nama}
                      onChangeText={setNama}
                      placeholder=""
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Nomor HP / WhatsApp (Opsional)</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="call-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={noHp}
                      onChangeText={setNoHp}
                      keyboardType="phone-pad"
                      placeholder=""
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Nama Kelompok Tani (Opsional)</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="people-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={kelompokTani}
                      onChangeText={setKelompokTani}
                      placeholder=""
                    />
                  </View>
                </View>
              </View>

              {/* SECTION 2: DATA WILAYAH LAHAN PERTANIAN */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="map-outline" size={20} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitle}>Wilayah Lahan Pertanian</Text>
                </View>

                {/* 1. PROVINSI */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>1. Provinsi *</Text>
                  <TouchableOpacity
                    style={styles.dropdownBtn}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSearchQuery('');
                      setActivePicker('provinsi');
                    }}
                  >
                    <View style={styles.dropdownLeft}>
                      <Ionicons name="map" size={18} color={provinsi ? '#059669' : (isDark ? '#9CA3AF' : '#6B7280')} style={styles.inputIcon} />
                      <Text style={[styles.dropdownText, !provinsi && styles.placeholderText]}>
                        {provinsi || 'Pilih Provinsi...'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                </View>

                {/* 2. KABUPATEN / KOTA */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>2. Kabupaten / Kota *</Text>
                  <TouchableOpacity
                    style={[styles.dropdownBtn, !provinsi && styles.dropdownDisabled]}
                    activeOpacity={0.7}
                    disabled={!provinsi}
                    onPress={() => {
                      setSearchQuery('');
                      setActivePicker('kabupaten');
                    }}
                  >
                    <View style={styles.dropdownLeft}>
                      <Ionicons name="business" size={18} color={kabupaten ? '#059669' : (isDark ? '#9CA3AF' : '#6B7280')} style={styles.inputIcon} />
                      <Text style={[styles.dropdownText, !kabupaten && styles.placeholderText]}>
                        {!provinsi ? 'Pilih Provinsi terlebih dahulu' : kabupaten || 'Pilih Kabupaten / Kota...'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                </View>

                {/* 3. KECAMATAN */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>3. Kecamatan</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="location-outline" size={18} color={kecamatan ? '#059669' : (isDark ? '#9CA3AF' : '#6B7280')} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={kecamatan}
                      onChangeText={setKecamatan}
                      placeholder=""
                    />
                    {kecamatan.length > 0 && (
                      <TouchableOpacity onPress={() => setKecamatan('')}>
                        <Ionicons name="close-circle" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* 4. DESA / KELURAHAN (DINAMIS SESUAI KABUPATEN/KOTA) */}
                <View style={styles.formGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={styles.label}>4. {tipeDesa}</Text>
                    {/* Switch Chip Desa vs Kelurahan */}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => setTipeDesa('Desa')}
                        style={{
                          paddingHorizontal: 9,
                          paddingVertical: 3,
                          borderRadius: 6,
                          backgroundColor: tipeDesa === 'Desa' ? '#059669' : (isDark ? '#374151' : '#E5E7EB'),
                        }}
                      >
                        <Text style={{
                          fontSize: 11,
                          fontWeight: 'bold',
                          color: tipeDesa === 'Desa' ? '#fff' : (isDark ? '#D1D5DB' : '#4B5563')
                        }}>
                          Desa
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setTipeDesa('Kelurahan')}
                        style={{
                          paddingHorizontal: 9,
                          paddingVertical: 3,
                          borderRadius: 6,
                          backgroundColor: tipeDesa === 'Kelurahan' ? '#059669' : (isDark ? '#374151' : '#E5E7EB'),
                        }}
                      >
                        <Text style={{
                          fontSize: 11,
                          fontWeight: 'bold',
                          color: tipeDesa === 'Kelurahan' ? '#fff' : (isDark ? '#D1D5DB' : '#4B5563')
                        }}>
                          Kelurahan
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputWrap}>
                    <Ionicons name="home-outline" size={18} color={desa ? '#059669' : (isDark ? '#9CA3AF' : '#6B7280')} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={desa}
                      onChangeText={setDesa}
                      placeholder=""
                    />
                    {desa.length > 0 && (
                      <TouchableOpacity onPress={() => setDesa('')}>
                        <Ionicons name="close-circle" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* PREVIEW KOTAK ALAMAT LENGKAP */}
                {provinsi && kabupaten ? (
                  <View style={styles.summaryBox}>
                    <Ionicons name="checkmark-circle" size={20} color="#059669" style={{ marginRight: 8, marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.summaryTitle}>Alamat Terdaftar:</Text>
                      <Text style={styles.summaryText}>{formRegionSummary}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* ACTION BUTTONS ROW */}
              <View style={styles.formActionRow}>
                {profile && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={handleCancelEdit}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={isDark ? '#D1D5DB' : '#4B5563'} style={{ marginRight: 6 }} />
                    <Text style={styles.cancelBtnText}>BATAL</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.7 }, profile ? { flex: 2 } : { flex: 1 }]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <Ionicons name="save-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.saveBtnText}>{saving ? 'Menyimpan...' : 'SIMPAN PROFIL'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ========================================================= */}
          {/* SECTION SERVER WEBSITE MONITORING                         */}
          {/* ========================================================= */}
          <View style={[styles.sectionCard, { marginTop: 16 }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cloud-upload-outline" size={20} color="#059669" style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Website Monitoring</Text>
            </View>

            <Text style={{ fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280', marginBottom: 10 }}>
              Koneksi untuk sinkronisasi data riwayat diagnosa tanaman jagung ke website dashboard.
            </Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Alamat Server</Text>
              <Text style={[styles.detailValue, { fontSize: 11, flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                {serverUrl}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: '#059669', flex: 1 }]}
                onPress={() => handleTestServer()}
                disabled={testingConnection}
                activeOpacity={0.8}
              >
                {testingConnection ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="flash-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.smallActionBtnText}>Tes Koneksi</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: isDark ? '#374151' : '#E5E7EB', flex: 1 }]}
                onPress={() => {
                  setInputServerUrl(serverUrl);
                  setShowServerModal(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="settings-outline" size={16} color={isDark ? '#F9FAFB' : '#1F2937'} style={{ marginRight: 4 }} />
                <Text style={[styles.smallActionBtnText, { color: isDark ? '#F9FAFB' : '#1F2937' }]}>Ubah Server</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.syncNowBtn}
              onPress={handleManualSync}
              disabled={testingConnection}
              activeOpacity={0.8}
            >
              <Ionicons name="sync-outline" size={16} color="#059669" style={{ marginRight: 6 }} />
              <Text style={styles.syncNowBtnText}>Sinkronkan Riwayat Sekarang</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL PICKER PROVINSI / KABUPATEN */}
      <Modal visible={activePicker !== null} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActivePicker(null)} style={{ padding: 6 }}>
              <Ionicons name="arrow-back" size={24} color={isDark ? '#F9FAFB' : '#1F2937'} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Pilih {activePicker === 'provinsi' ? 'Provinsi' : 'Kabupaten / Kota'}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          {/* SEARCH BAR */}
          <View style={styles.searchBarWrap}>
            <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* DAFTAR PILIHAN */}
          <FlatList
            data={filteredList}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = activePicker === 'provinsi' ? item === provinsi : item === kabupaten;
              return (
                <TouchableOpacity
                  style={[styles.listItem, isSelected && styles.listItemSelected]}
                  onPress={() => {
                    if (activePicker === 'provinsi') {
                      handleSelectProvinsi(item);
                    } else {
                      handleSelectKabupaten(item);
                    }
                  }}
                >
                  <Text style={[styles.listItemText, isSelected && styles.listItemTextSelected]}>
                    {item}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={20} color="#059669" />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
                <Text style={styles.emptyText}>Tidak ditemukan hasil untuk "{searchQuery}"</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* MODAL UBAH SERVER MONITORING */}
      <Modal visible={showServerModal} animationType="fade" transparent={true}>
        <View style={styles.serverModalOverlay}>
          <View style={styles.serverModalContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="server-outline" size={24} color="#059669" style={{ marginRight: 8 }} />
              <Text style={styles.serverModalTitle}>Pengaturan Server Monitoring</Text>
            </View>

            <Text style={styles.serverModalDesc}>
              Masukkan alamat HTTPS Tunnel atau IP lokal backend dashboard monitoring:
            </Text>

            <TextInput
              style={styles.serverModalInput}
              value={inputServerUrl}
              onChangeText={setInputServerUrl}
              placeholder="https://... atau http://..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.serverModalBtn, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}
                onPress={() => setShowServerModal(false)}
              >
                <Text style={[styles.serverModalBtnText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.serverModalBtn, { backgroundColor: '#F59E0B' }]}
                onPress={() => {
                  setInputServerUrl('');
                }}
              >
                <Text style={styles.serverModalBtnText}>Reset Default</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.serverModalBtn, { backgroundColor: '#059669', flex: 1.2 }]}
                onPress={handleSaveServerUrl}
              >
                <Text style={styles.serverModalBtnText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#111827' : '#F3F4F6',
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
    headerTextWrap: {
      marginLeft: 12,
      flex: 1,
    },
    appName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    appSlogan: {
      color: '#A7F3D0',
      fontSize: 12,
      marginTop: 2,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 40,
    },
    detailContainer: {
      width: '100%',
    },
    avatarCard: {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    avatarCircle: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: '#059669',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? '#F9FAFB' : '#111827',
      marginBottom: 3,
    },
    avatarRole: {
      fontSize: 13,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginBottom: 6,
    },
    locationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      alignSelf: 'flex-start',
    },
    locationBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#059669',
      marginLeft: 4,
    },
    formInfoBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ECFDF5',
      borderLeftWidth: 4,
      borderLeftColor: '#059669',
      padding: 12,
      borderRadius: 8,
      marginBottom: 14,
    },
    formInfoText: {
      fontSize: 12,
      color: isDark ? '#D1FAE5' : '#065F46',
      flex: 1,
      lineHeight: 18,
    },
    sectionCard: {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#F3F4F6',
      paddingBottom: 8,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: 'bold',
      color: isDark ? '#F9FAFB' : '#111827',
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    detailLabel: {
      fontSize: 13,
      color: isDark ? '#9CA3AF' : '#6B7280',
      flex: 1,
    },
    detailValue: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#F9FAFB' : '#1F2937',
      textAlign: 'right',
      flex: 1.5,
    },
    detailDivider: {
      height: 1,
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      marginVertical: 2,
    },
    formGroup: {
      marginBottom: 12,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#D1D5DB' : '#374151',
      marginBottom: 6,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#111827' : '#F9FAFB',
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#D1D5DB',
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 46,
    },
    inputIcon: {
      marginRight: 8,
    },
    textInput: {
      flex: 1,
      fontSize: 14,
      color: isDark ? '#F9FAFB' : '#111827',
      height: '100%',
    },
    dropdownBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#111827' : '#F9FAFB',
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#D1D5DB',
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 46,
    },
    dropdownLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    dropdownText: {
      fontSize: 14,
      color: isDark ? '#F9FAFB' : '#111827',
    },
    placeholderText: {
      color: isDark ? '#6B7280' : '#9CA3AF',
    },
    dropdownDisabled: {
      opacity: 0.5,
    },
    summaryBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ECFDF5',
      borderRadius: 10,
      padding: 12,
      marginTop: 10,
      borderWidth: 1,
      borderColor: isDark ? '#065F46' : '#A7F3D0',
    },
    summaryTitle: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#059669',
      marginBottom: 2,
    },
    summaryText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#D1FAE5' : '#064E3B',
      lineHeight: 18,
    },
    editBtn: {
      backgroundColor: '#059669',
      borderRadius: 12,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
      elevation: 2,
      shadowColor: '#059669',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
    },
    editBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: 'bold',
      letterSpacing: 0.5,
    },
    formActionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    cancelBtn: {
      flex: 1,
      backgroundColor: isDark ? '#374151' : '#E5E7EB',
      borderRadius: 12,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: {
      color: isDark ? '#D1D5DB' : '#4B5563',
      fontSize: 14,
      fontWeight: 'bold',
    },
    saveBtn: {
      backgroundColor: '#059669',
      borderRadius: 12,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 2,
      shadowColor: '#059669',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
    },
    saveBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: 'bold',
      letterSpacing: 0.5,
    },
    modalSafeArea: {
      flex: 1,
      backgroundColor: isDark ? '#111827' : '#FFFFFF',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#E5E7EB',
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: isDark ? '#F9FAFB' : '#111827',
    },
    searchBarWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
      borderRadius: 10,
      margin: 16,
      paddingHorizontal: 12,
      height: 44,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: isDark ? '#F9FAFB' : '#111827',
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#1F2937' : '#F3F4F6',
    },
    listItemSelected: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ECFDF5',
    },
    listItemText: {
      fontSize: 14,
      color: isDark ? '#F9FAFB' : '#1F2937',
    },
    listItemTextSelected: {
      fontWeight: 'bold',
      color: '#059669',
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 13,
      color: '#9CA3AF',
      marginTop: 10,
      textAlign: 'center',
    },
    smallActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
    },
    smallActionBtnText: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    syncNowBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: '#059669',
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.1)' : '#ECFDF5',
    },
    syncNowBtnText: {
      color: '#059669',
      fontSize: 13,
      fontWeight: 'bold',
    },
    serverModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    serverModalContent: {
      width: '100%',
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderRadius: 16,
      padding: 20,
      elevation: 6,
    },
    serverModalTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: isDark ? '#F9FAFB' : '#111827',
    },
    serverModalDesc: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginBottom: 12,
      lineHeight: 18,
    },
    serverModalInput: {
      height: 46,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#D1D5DB',
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 13,
      color: isDark ? '#F9FAFB' : '#111827',
      backgroundColor: isDark ? '#111827' : '#F9FAFB',
    },
    serverModalBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    serverModalBtnText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
  });
