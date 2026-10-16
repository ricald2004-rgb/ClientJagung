import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import {
  clearAllHistory,
  DEFAULT_RETENTION_DAYS,
  deleteHistoryItem,
  deleteSelectedHistory,
  getHistory,
  getRetentionDays,
  HistoryItem,
  setRetentionDays,
} from '../../services/historyService';
import { subscribeSyncEvents, syncFarmerProfileToServer, syncPendingDiagnoses } from '../../services/syncService';

export default function HistoryScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const styles = getStyles(isDark);

  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retentionDays, setRetentionDaysState] = useState(DEFAULT_RETENTION_DAYS);

  // Mode Pilihan Ganda (Multi-Select)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal Pengaturan Batas Waktu Hapus Otomatis
  const [showRetentionModal, setShowRetentionModal] = useState(false);

  // Ambil data setiap kali tab History dibuka & jalankan sinkronisasi senyap di background
  useFocusEffect(
    useCallback(() => {
      loadData();
      // Sinkronisasi profil petani dan riwayat tertunda di background
      syncFarmerProfileToServer().catch(() => {});
      syncPendingDiagnoses().then((count) => {
        if (count > 0) loadData();
      });
    }, [])
  );

  // Berlangganan event sinkronisasi realtime:
  // Jika ada diagnosa yang tersinkron di background, daftar riwayat otomatis di-refresh
  useEffect(() => {
    const unsub = subscribeSyncEvents(() => {
      getHistory().then((items) => setHistoryList(items));
    });
    return () => unsub();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncPendingDiagnoses();
      const items = await getHistory();
      setHistoryList(items);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const days = await getRetentionDays();
      setRetentionDaysState(days);
      const items = await getHistory();
      setHistoryList(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Toggle pilihan pada 1 item
  const toggleSelectItem = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Pilih semua atau batalkan semua
  const toggleSelectAll = () => {
    if (selectedIds.length === historyList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(historyList.map((item) => item.id));
    }
  };

  // Keluar dari mode multi-select
  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds([]);
  };

  // 1. HAPUS SATUAN (MANDIRI)
  const handleDeleteSingle = (item: HistoryItem) => {
    Alert.alert(
      'Hapus Riwayat',
      `Apakah Anda yakin ingin menghapus hasil diagnosa ${item.penyakit} pada ${item.dateFormatted}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await deleteHistoryItem(item.id);
            setHistoryList((prev) => prev.filter((i) => i.id !== item.id));
          },
        },
      ]
    );
  };

  // 2. HAPUS BEBERAPA PILIHAN (MULTI-DELETE)
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;

    Alert.alert(
      'Hapus Pilihan',
      `Apakah Anda yakin ingin menghapus ${selectedIds.length} riwayat diagnosa yang dipilih?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Terpilih',
          style: 'destructive',
          onPress: async () => {
            await deleteSelectedHistory(selectedIds);
            const remaining = historyList.filter((item) => !selectedIds.includes(item.id));
            setHistoryList(remaining);
            exitSelectMode();
          },
        },
      ]
    );
  };

  // 3. HAPUS SEMUA SEKALIAN
  const handleClearAll = () => {
    if (historyList.length === 0) return;

    Alert.alert(
      'Hapus Semua Riwayat?',
      'Seluruh data riwayat diagnosa di HP Anda akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Semua',
          style: 'destructive',
          onPress: async () => {
            await clearAllHistory();
            setHistoryList([]);
            exitSelectMode();
          },
        },
      ]
    );
  };

  // Ubah batas waktu auto-delete
  const handleChangeRetention = async (days: number) => {
    await setRetentionDays(days);
    setRetentionDaysState(days);
    setShowRetentionModal(false);
    loadData();
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const isSelected = selectedIds.includes(item.id);
    const isHealthy = item.penyakit === 'Jagung Sehat';
    const isUnknown = item.penyakit === 'Bukan Objek Jagung';

    return (
      <TouchableOpacity
        style={[styles.historyCard, isSelected && styles.historyCardSelected]}
        activeOpacity={0.8}
        onPress={() => {
          if (isSelectMode) {
            toggleSelectItem(item.id);
          } else {
            router.push({ pathname: '/detail', params: { penyakit: item.penyakit } });
          }
        }}
        onLongPress={() => {
          if (!isSelectMode) {
            setIsSelectMode(true);
            setSelectedIds([item.id]);
          }
        }}
      >
        {/* CHECKBOX MULTI-SELECT */}
        {isSelectMode && (
          <TouchableOpacity
            style={styles.checkboxTouch}
            onPress={() => toggleSelectItem(item.id)}
          >
            <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
              {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </View>
          </TouchableOpacity>
        )}

        {/* THUMBNAIL GAMBAR */}
        <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />

        {/* DETAIL HASIL */}
        <View style={styles.cardInfo}>
          <View style={styles.cardHeaderRow}>
            <View
              style={[
                styles.badge,
                isHealthy ? styles.badgeSuccess : isUnknown ? styles.badgeGray : styles.badgeDanger,
              ]}
            >
              <Text style={styles.badgeText}>{item.penyakit}</Text>
            </View>
            <Text style={styles.accuracyText}>{item.confidence}</Text>
          </View>

          <View style={{ marginBottom: 3 }}>
            <Text style={styles.dateText}>{item.dateFormatted}</Text>
          </View>

          {/* STATUS SINKRONISASI KE DASHBOARD */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons
              name={item.isSynced ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={13}
              color={item.isSynced ? '#10B981' : '#F59E0B'}
            />
            <Text
              style={{
                fontSize: 11,
                marginLeft: 4,
                color: item.isSynced
                  ? isDark ? '#34D399' : '#059669'
                  : isDark ? '#FBBF24' : '#D97706',
                fontWeight: '600',
              }}
            >
              {item.isSynced ? 'Tersinkron ke Dashboard' : 'Tersimpan di HP (Offline)'}
            </Text>
          </View>

          {/* TOP 3 PREVIEW SINGKAT */}
          {item.top3 && item.top3.length > 1 && (
            <Text style={styles.top3PreviewText} numberOfLines={1}>
              Kemungkinan lain: {item.top3[1]?.penyakit} ({item.top3[1]?.confidence})
            </Text>
          )}
        </View>

        {/* TOMBOL HAPUS MANDIRI SATUAN */}
        {!isSelectMode && (
          <TouchableOpacity
            style={styles.singleDeleteBtn}
            onPress={() => handleDeleteSingle(item)}
          >
            <Ionicons name="trash-outline" size={20} color={isDark ? '#EF4444' : '#DC2626'} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER IDENTITAS TETAP / STICKY */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="history" size={38} color="#34D399" />
        <View style={styles.headerTextWrap}>
          <Text style={styles.appName}>Riwayat Diagnosa</Text>
          <Text style={styles.appSlogan}>
            {historyList.length > 0
              ? `${historyList.length} diagnosa tersimpan di memori HP`
              : 'Hasil diagnosa tersimpan di memori HP'}
          </Text>
        </View>
      </View>

      {/* BANNER RETENSI AUTO-DELETE */}
      <TouchableOpacity
        style={styles.retentionBanner}
        onPress={() => setShowRetentionModal(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="timer-outline" size={18} color="#059669" />
        <Text style={styles.retentionText}>
          Batas simpan otomatis:{' '}
          <Text style={{ fontWeight: 'bold' }}>
            {`${retentionDays} Hari`}
          </Text>
        </Text>
        <Ionicons name="chevron-forward" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
      </TouchableOpacity>

      {/* BAR DAFTAR & TOMBOL PILIH */}
      {!isSelectMode && historyList.length > 0 && (
        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeaderTitle}>Daftar Riwayat</Text>
          <TouchableOpacity
            style={styles.selectBtn}
            onPress={() => setIsSelectMode(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="checkbox-outline" size={15} color={isDark ? '#34D399' : '#059669'} style={{ marginRight: 5 }} />
            <Text style={styles.selectBtnText}>Pilih</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* TOOLBAR MULTI-SELECT SAAT AKTIF */}
      {isSelectMode && historyList.length > 0 && (
        <View style={styles.multiSelectToolbar}>
          <TouchableOpacity style={styles.toolbarCancelBtn} onPress={exitSelectMode}>
            <Ionicons name="close" size={16} color={isDark ? '#F87171' : '#EF4444'} style={{ marginRight: 4 }} />
            <Text style={[styles.toolbarBtnText, { color: isDark ? '#F87171' : '#EF4444' }]}>Batal</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolbarBtn} onPress={toggleSelectAll}>
            <Text style={styles.toolbarBtnText}>
              {selectedIds.length === historyList.length ? 'Batal Semua' : 'Pilih Semua'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolbarDeleteBtn,
              selectedIds.length === 0 && { opacity: 0.5 },
            ]}
            disabled={selectedIds.length === 0}
            onPress={handleDeleteSelected}
          >
            <Ionicons name="trash" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.toolbarDeleteText}>
              Hapus ({selectedIds.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* DAFTAR RIWAYAT / EMPTY STATE */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : historyList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="document-text-outline" size={54} color="#059669" />
          </View>
          <Text style={styles.emptyTitle}>Belum Ada Riwayat Diagnosa</Text>
          <Text style={styles.emptyDesc}>
            Setiap kali Anda mendiagnosa foto daun jagung, hasilnya akan otomatis tersimpan rapi di sini.
          </Text>
          <TouchableOpacity
            style={styles.startDiagnoseBtn}
            onPress={() => router.push('/(tabs)')}
          >
            <FontAwesome5 name="microscope" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.startDiagnoseBtnText}>Mulai Diagnosa Sekarang</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={historyList}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#059669']}
              tintColor="#059669"
            />
          }
        />
      )}

      {/* TOMBOL HAPUS SEMUA DI BAWAH (HANYA KETIKA TIDAK MODE PILIH) */}
      {!isSelectMode && historyList.length > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.clearAllBtn} onPress={handleClearAll}>
            <Ionicons name="trash-bin-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={styles.clearAllText}>Hapus Semua Sekalian</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL PENGATURAN BATAS WAKTU HAPUS OTOMATIS */}
      <Modal
        visible={showRetentionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRetentionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBox}>
              <Ionicons name="time" size={32} color="#059669" />
            </View>
            <Text style={styles.modalTitle}>Batas Waktu Simpan Otomatis</Text>
            <Text style={styles.modalDesc}>
              Riwayat diagnosa yang lebih lama dari batas waktu ini akan otomatis terhapus dengan sendirinya agar memori HP Anda tetap hemat.
            </Text>

            {[7, 14, 30, 60, 90].map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.retentionOption,
                  retentionDays === days && styles.retentionOptionActive,
                ]}
                onPress={() => handleChangeRetention(days)}
              >
                <Text
                  style={[
                    styles.retentionOptionText,
                    retentionDays === days && styles.retentionOptionTextActive,
                  ]}
                >
                  {`${days} Hari`}
                </Text>
                {retentionDays === days && (
                  <Ionicons name="checkmark-circle" size={20} color="#059669" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowRetentionModal(false)}
            >
              <Text style={styles.closeModalBtnText}>Tutup</Text>
            </TouchableOpacity>
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
    retentionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginHorizontal: 16,
      marginTop: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#059669' : '#A7F3D0',
    },
    retentionText: {
      flex: 1,
      fontSize: 12,
      color: isDark ? '#D1D5DB' : '#065F46',
      marginLeft: 8,
    },
    listHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 18,
      marginTop: 12,
      marginBottom: 4,
    },
    listHeaderTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: isDark ? '#E5E7EB' : '#374151',
    },
    selectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#E5E7EB',
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
    },
    selectBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#34D399' : '#059669',
    },
    multiSelectToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      marginHorizontal: 16,
      marginTop: 10,
      marginBottom: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#E5E7EB',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    toolbarCancelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
    },
    toolbarBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
    },
    toolbarBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#E5E7EB' : '#4B5563',
    },
    toolbarDeleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#DC2626',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    toolbarDeleteText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
    },
    historyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#E5E7EB',
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 3,
    },
    historyCardSelected: {
      borderColor: '#059669',
      backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
      borderWidth: 1.5,
    },
    checkboxTouch: {
      marginRight: 8,
      padding: 4,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: isDark ? '#9CA3AF' : '#9CA3AF',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    checkboxActive: {
      backgroundColor: '#059669',
      borderColor: '#059669',
    },
    thumbnail: {
      width: 68,
      height: 68,
      borderRadius: 10,
      backgroundColor: isDark ? '#374151' : '#E5E7EB',
    },
    cardInfo: {
      flex: 1,
      marginLeft: 12,
      justifyContent: 'center',
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    badgeSuccess: {
      backgroundColor: isDark ? '#064E3B' : '#D1FAE5',
    },
    badgeDanger: {
      backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2',
    },
    badgeGray: {
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
    },
    badgeText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: isDark ? '#F9FAFB' : '#111827',
    },
    accuracyText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#059669',
    },
    dateText: {
      fontSize: 11,
      color: isDark ? '#9CA3AF' : '#6B7280',
    },
    top3PreviewText: {
      fontSize: 10,
      color: isDark ? '#9CA3AF' : '#6B7280',
      fontStyle: 'italic',
    },
    singleDeleteBtn: {
      padding: 8,
      marginLeft: 6,
      borderRadius: 8,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 60,
    },
    emptyIconCircle: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: 'bold',
      color: isDark ? '#F9FAFB' : '#1F2937',
      marginBottom: 6,
      textAlign: 'center',
    },
    emptyDesc: {
      fontSize: 13,
      color: isDark ? '#9CA3AF' : '#6B7280',
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    startDiagnoseBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#059669',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    startDiagnoseBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: 'bold',
    },
    bottomBar: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor: isDark ? '#374151' : '#E5E7EB',
      alignItems: 'center',
    },
    clearAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
      borderWidth: 1,
      borderColor: isDark ? '#7F1D1D' : '#FECACA',
    },
    clearAllText: {
      color: isDark ? '#F87171' : '#DC2626',
      fontSize: 13,
      fontWeight: 'bold',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalContent: {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderRadius: 20,
      padding: 22,
      width: '100%',
      maxWidth: 340,
      elevation: 8,
    },
    modalIconBox: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: 'bold',
      color: isDark ? '#F9FAFB' : '#111827',
      textAlign: 'center',
      marginBottom: 6,
    },
    modalDesc: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 16,
    },
    retentionOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      marginBottom: 8,
    },
    retentionOptionActive: {
      backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
      borderWidth: 1,
      borderColor: '#059669',
    },
    retentionOptionText: {
      fontSize: 14,
      color: isDark ? '#D1D5DB' : '#374151',
      fontWeight: '500',
    },
    retentionOptionTextActive: {
      color: '#059669',
      fontWeight: 'bold',
    },
    closeModalBtn: {
      marginTop: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    closeModalBtnText: {
      fontSize: 14,
      color: isDark ? '#9CA3AF' : '#6B7280',
      fontWeight: '600',
    },
  });

