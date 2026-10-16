import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { INDONESIA_REGIONS, PROVINCES_LIST } from '../constants/indonesiaRegions';
import { useTheme } from '../context/ThemeContext';
import { formatRegionLabel, getUserRegion, saveUserRegion, UserRegion } from '../services/regionService';

interface RegionSelectModalProps {
  visible: boolean;
  canDismiss?: boolean;
  onClose?: () => void;
  onSaved: (region: UserRegion) => void;
}

type PickerType = 'provinsi' | 'kabupaten' | null;

export default function RegionSelectModal({
  visible,
  canDismiss = true,
  onClose,
  onSaved,
}: RegionSelectModalProps) {
  const { isDark } = useTheme();
  const styles = getStyles(isDark);

  const [selectedProvinsi, setSelectedProvinsi] = useState<string>('');
  const [selectedKabupaten, setSelectedKabupaten] = useState<string>('');
  const [kecamatan, setKecamatan] = useState<string>('');
  const [desa, setDesa] = useState<string>('');
  const [tipeDesa, setTipeDesa] = useState<'Desa' | 'Kelurahan'>('Desa');

  // Sub-picker state
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Muat wilayah tersimpan jika ada saat modal dibuka
  useEffect(() => {
    if (visible) {
      getUserRegion().then((current) => {
        if (current) {
          setSelectedProvinsi(current.provinsi || '');
          setSelectedKabupaten(current.kabupaten || '');
          setKecamatan(current.kecamatan || '');
          setDesa(current.desa || '');
          if (current.tipeDesa) {
            setTipeDesa(current.tipeDesa);
          } else if (current.kabupaten && current.kabupaten.toLowerCase().includes('kota')) {
            setTipeDesa('Kelurahan');
          } else {
            setTipeDesa('Desa');
          }
        } else {
          setSelectedProvinsi('');
          setSelectedKabupaten('');
          setKecamatan('');
          setDesa('');
          setTipeDesa('Desa');
        }
        setActivePicker(null);
        setSearchQuery('');
      });
    }
  }, [visible]);

  // Daftar Kabupaten berdasarkan Provinsi yang dipilih
  const availableKabupaten = selectedProvinsi && INDONESIA_REGIONS[selectedProvinsi]
    ? INDONESIA_REGIONS[selectedProvinsi]
    : [];

  // Filter daftar untuk picker aktif
  const currentList = activePicker === 'provinsi' ? PROVINCES_LIST : availableKabupaten;
  const filteredList = currentList.filter((item) =>
    item.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleSelectProvinsi = (prov: string) => {
    setSelectedProvinsi(prov);
    setSelectedKabupaten(''); // Reset kabupaten jika provinsi berganti
    setDesa('');
    setActivePicker(null);
    setSearchQuery('');
  };

  const handleSelectKabupaten = (kab: string) => {
    setSelectedKabupaten(kab);
    // Otomatis deteksi: jika nama mengandung 'Kota', set Kelurahan; jika Kabupaten, set Desa
    if (kab.toLowerCase().includes('kota')) {
      setTipeDesa('Kelurahan');
    } else {
      setTipeDesa('Desa');
    }
    setActivePicker(null);
    setSearchQuery('');
  };

  const handleSave = async () => {
    if (!selectedProvinsi || !selectedKabupaten) return;

    const newRegion: UserRegion = {
      provinsi: selectedProvinsi,
      kabupaten: selectedKabupaten,
      kecamatan: kecamatan.trim() ? kecamatan.trim() : undefined,
      desa: desa.trim() ? desa.trim() : undefined,
      tipeDesa: tipeDesa,
    };

    await saveUserRegion(newRegion);
    onSaved(newRegion);
    if (onClose) onClose();
  };

  const previewLabel = formatRegionLabel({
    provinsi: selectedProvinsi,
    kabupaten: selectedKabupaten,
    kecamatan: kecamatan.trim() || undefined,
    desa: desa.trim() || undefined,
    tipeDesa: tipeDesa,
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        if (activePicker !== null) {
          setActivePicker(null);
        } else if (canDismiss && onClose) {
          onClose();
        }
      }}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* JIKA SUB-PICKER AKTIF: TAMPILKAN PENCARIAN WILAYAH */}
        {activePicker !== null ? (
          <View style={{ flex: 1 }}>
            {/* SEARCH HEADER */}
            <View style={styles.pickerHeader}>
              <TouchableOpacity
                onPress={() => setActivePicker(null)}
                style={styles.pickerBackBtn}
              >
                <Ionicons name="arrow-back" size={24} color={isDark ? '#F3F4F6' : '#111827'} />
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>
                {activePicker === 'provinsi' ? 'Pilih Provinsi' : 'Pilih Kabupaten / Kota'}
              </Text>
            </View>

            {/* SEARCH INPUT */}
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={
                  activePicker === 'provinsi'
                    ? 'Cari nama provinsi...'
                    : 'Cari kabupaten atau kota...'
                }
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </TouchableOpacity>
              )}
            </View>

            {/* LIST DAFTAR WILAYAH */}
            <FlatList
              data={filteredList}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
              ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
              renderItem={({ item }) => {
                const isSelected =
                  activePicker === 'provinsi'
                    ? item === selectedProvinsi
                    : item === selectedKabupaten;

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
                    <Text
                      style={[
                        styles.listItemText,
                        isSelected && styles.listItemTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color="#059669" />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
                  <Text style={styles.emptyText}>{'Tidak ditemukan "' + searchQuery + '"'}</Text>
                </View>
              )}
            />
          </View>
        ) : (
          /* JIKA SUB-PICKER TIDAK AKTIF: TAMPILKAN FORM UTAMA */
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            {/* HEADER */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Atur Wilayah Pertanian</Text>
                <Text style={styles.subtitle}>
                  Data lokasi dipakai untuk pemetaan sebaran penyakit jagung nasional.
                </Text>
              </View>
              {canDismiss && onClose && (
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color={isDark ? '#F3F4F6' : '#374151'} />
                </TouchableOpacity>
              )}
            </View>

            {/* FORM PILIH WILAYAH */}
            <View style={styles.content}>
              {/* 1. PILIH PROVINSI */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>1. Provinsi</Text>
                <TouchableOpacity
                  style={styles.dropdownBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSearchQuery('');
                    setActivePicker('provinsi');
                  }}
                >
                  <View style={styles.dropdownContent}>
                    <Ionicons
                      name="map-outline"
                      size={20}
                      color={selectedProvinsi ? '#059669' : isDark ? '#9CA3AF' : '#6B7280'}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      style={[
                        styles.dropdownText,
                        !selectedProvinsi && styles.dropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedProvinsi || 'Pilih Provinsi...'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </TouchableOpacity>
              </View>

              {/* 2. PILIH KABUPATEN / KOTA */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>2. Kabupaten / Kota</Text>
                <TouchableOpacity
                  style={[
                    styles.dropdownBtn,
                    !selectedProvinsi && styles.dropdownDisabled,
                  ]}
                  activeOpacity={0.7}
                  disabled={!selectedProvinsi}
                  onPress={() => {
                    setSearchQuery('');
                    setActivePicker('kabupaten');
                  }}
                >
                  <View style={styles.dropdownContent}>
                    <Ionicons
                      name="business-outline"
                      size={20}
                      color={selectedKabupaten ? '#059669' : isDark ? '#9CA3AF' : '#6B7280'}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      style={[
                        styles.dropdownText,
                        !selectedKabupaten && styles.dropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {!selectedProvinsi
                        ? 'Pilih Provinsi terlebih dahulu'
                        : selectedKabupaten || 'Pilih Kabupaten / Kota...'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </TouchableOpacity>
              </View>

              {/* 3. INPUT KECAMATAN */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>3. Kecamatan</Text>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="location-outline"
                    size={20}
                    color={kecamatan ? '#059669' : isDark ? '#9CA3AF' : '#6B7280'}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nama kecamatan"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={kecamatan}
                    onChangeText={setKecamatan}
                  />
                  {kecamatan.length > 0 && (
                    <TouchableOpacity onPress={() => setKecamatan('')}>
                      <Ionicons name="close-circle" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.helperText}>
                  Tulis nama kecamatan kebun jagung Anda agar data lebih spesifik.
                </Text>
              </View>

              {/* 4. INPUT DESA / KELURAHAN (OTOMATIS SESUAI KABUPATEN/KOTA) */}
              <View style={styles.fieldGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.fieldLabel}>4. {tipeDesa}</Text>
                  {/* Pilihan Toggle Chip Desa / Kelurahan */}
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setTipeDesa('Desa')}
                      style={{
                        paddingHorizontal: 8,
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
                        paddingHorizontal: 8,
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

                <View style={styles.inputContainer}>
                  <Ionicons
                    name="home-outline"
                    size={20}
                    color={desa ? '#059669' : isDark ? '#9CA3AF' : '#6B7280'}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder=""
                    value={desa}
                    onChangeText={setDesa}
                  />
                  {desa.length > 0 && (
                    <TouchableOpacity onPress={() => setDesa('')}>
                      <Ionicons name="close-circle" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.helperText}>
                  Tulis nama {tipeDesa.toLowerCase()} lokasi kebun jagung Anda.
                </Text>
              </View>

              {/* PREVIEW KOTAK */}
              {selectedProvinsi && selectedKabupaten ? (
                <View style={styles.previewBox}>
                  <Ionicons name="checkmark-circle" size={22} color="#059669" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewHeading}>Lokasi Terpilih:</Text>
                    <Text style={styles.previewText}>{previewLabel}</Text>
                  </View>
                </View>
              ) : null}

              <View style={{ flex: 1 }} />

              {/* TOMBOL SIMPAN */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!selectedProvinsi || !selectedKabupaten) && styles.saveButtonDisabled,
                ]}
                disabled={!selectedProvinsi || !selectedKabupaten}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Simpan Wilayah</Text>
              </TouchableOpacity>

              {canDismiss && onClose && (
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: isDark ? '#111827' : '#F9FAFB',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#E5E7EB',
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? '#F9FAFB' : '#111827',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: isDark ? '#9CA3AF' : '#6B7280',
      lineHeight: 18,
    },
    closeBtn: {
      padding: 6,
      borderRadius: 20,
      backgroundColor: isDark ? '#1F2937' : '#E5E7EB',
      marginLeft: 10,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    fieldGroup: {
      marginBottom: 18,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#E5E7EB' : '#374151',
      marginBottom: 8,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    badgeOptional: {
      fontSize: 11,
      color: isDark ? '#9CA3AF' : '#6B7280',
      backgroundColor: isDark ? '#374151' : '#E5E7EB',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginLeft: 8,
    },
    dropdownBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderWidth: 1.5,
      borderColor: isDark ? '#374151' : '#E5E7EB',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    dropdownDisabled: {
      opacity: 0.5,
      backgroundColor: isDark ? '#111827' : '#F3F4F6',
    },
    dropdownContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 8,
    },
    dropdownText: {
      fontSize: 15,
      fontWeight: '500',
      color: isDark ? '#F9FAFB' : '#111827',
    },
    dropdownPlaceholder: {
      color: isDark ? '#6B7280' : '#9CA3AF',
      fontWeight: 'normal',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderWidth: 1.5,
      borderColor: isDark ? '#374151' : '#E5E7EB',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    textInput: {
      flex: 1,
      fontSize: 15,
      color: isDark ? '#F9FAFB' : '#111827',
      padding: 0,
    },
    helperText: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginTop: 6,
      marginLeft: 4,
    },
    previewBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ECFDF5',
      borderWidth: 1,
      borderColor: '#059669',
      borderRadius: 12,
      padding: 14,
      marginTop: 8,
      marginBottom: 16,
    },
    previewHeading: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#34D399' : '#059669',
      marginBottom: 2,
    },
    previewText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: isDark ? '#F9FAFB' : '#065F46',
    },
    saveButton: {
      flexDirection: 'row',
      backgroundColor: '#059669',
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 2,
      shadowColor: '#059669',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    saveButtonDisabled: {
      backgroundColor: isDark ? '#374151' : '#D1D5DB',
      elevation: 0,
      shadowOpacity: 0,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
    cancelBtn: {
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    cancelBtnText: {
      fontSize: 15,
      color: isDark ? '#9CA3AF' : '#6B7280',
      fontWeight: '500',
    },
    // Sub-Picker styles
    pickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#E5E7EB',
    },
    pickerBackBtn: {
      padding: 6,
      marginRight: 12,
    },
    pickerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? '#F9FAFB' : '#111827',
    },
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
      borderRadius: 10,
      margin: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: isDark ? '#F9FAFB' : '#111827',
      padding: 0,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    listItemSelected: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
    },
    listItemText: {
      fontSize: 15,
      color: isDark ? '#E5E7EB' : '#1F2937',
      flex: 1,
    },
    listItemTextSelected: {
      fontWeight: 'bold',
      color: isDark ? '#34D399' : '#059669',
    },
    listSeparator: {
      height: 1,
      backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
    },
    emptyContainer: {
      paddingVertical: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      marginTop: 12,
      fontSize: 14,
      color: isDark ? '#9CA3AF' : '#6B7280',
    },
  });

