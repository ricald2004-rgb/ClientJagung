import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HistoryItem {
  id: string;
  timestamp: number;
  dateFormatted: string;
  imageUri: string;
  imageBase64?: string | null;
  penyakit: string;
  confidence: string;
  top3: Array<{ penyakit: string; confidence: string }>;
  wilayah?: string;
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
  desa?: string;
  isSynced?: boolean; // false jika offline, true jika sudah tersinkron ke dashboard
}

const HISTORY_STORAGE_KEY = '@milu_sesehati_history';
const RETENTION_DAYS_KEY = '@milu_sesehati_retention_days';
export const DEFAULT_RETENTION_DAYS = 30; // Batas waktu default: 30 hari

/**
 * Format tanggal dalam bahasa Indonesia yang ramah (cth: 06 Okt 2026, 14:30)
 */
function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

/**
 * Ambil pengaturan batas hari retensi (auto-delete)
 * Selalu memiliki batas waktu simpan (default: 30 hari)
 */
export async function getRetentionDays(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(RETENTION_DAYS_KEY);
    const parsed = val ? parseInt(val, 10) : DEFAULT_RETENTION_DAYS;
    return parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
  } catch {
    return DEFAULT_RETENTION_DAYS;
  }
}

/**
 * Atur batas hari retensi auto-delete (misal 7, 14, 30, 60, atau 90 hari)
 */
export async function setRetentionDays(days: number): Promise<void> {
  try {
    const validDays = days > 0 ? days : DEFAULT_RETENTION_DAYS;
    await AsyncStorage.setItem(RETENTION_DAYS_KEY, String(validDays));
  } catch (error) {
    console.error('Gagal menyimpan pengaturan batas waktu:', error);
  }
}

/**
 * Ambil seluruh riwayat dengan pembersihan otomatis jika lewat batas waktu
 */
export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const json = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    if (!json) return [];

    let items: HistoryItem[] = JSON.parse(json);
    const retentionDays = await getRetentionDays();

    // Selalu hapus otomatis data diagnosa yang sudah melebihi batas waktu simpan
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const validItems = items.filter((item) => now - item.timestamp <= maxAgeMs);

    // Jika ada item yang kadaluarsa dan terhapus otomatis, simpan data terbaru
    if (validItems.length !== items.length) {
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(validItems));
      items = validItems;
    }

    // Urutkan dari yang paling baru ke paling lama
    return items.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Gagal mengambil riwayat:', error);
    return [];
  }
}

/**
 * Simpan hasil diagnosa baru ke riwayat
 */
export async function saveHistory(
  data: Omit<HistoryItem, 'id' | 'timestamp' | 'dateFormatted'> & { id?: string }
): Promise<HistoryItem> {
  try {
    const current = await getHistory();
    const timestamp = Date.now();
    const newItem: HistoryItem = {
      ...data,
      id: data.id || `hist_${timestamp}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp,
      dateFormatted: formatDate(timestamp),
      isSynced: data.isSynced ?? false,
    };

    const updated = [newItem, ...current];
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return newItem;
  } catch (error) {
    console.error('Gagal menyimpan diagnosa ke riwayat:', error);
    throw error;
  }
}

/**
 * Ambil semua item riwayat yang belum tersinkronisasi ke server (offline queue)
 */
export async function getPendingSyncItems(): Promise<HistoryItem[]> {
  try {
    const items = await getHistory();
    return items.filter((item) => !item.isSynced);
  } catch (error) {
    console.error('Gagal mengambil antrean pending sync:', error);
    return [];
  }
}

/**
 * Tandai satu item riwayat sebagai sudah tersinkronisasi
 */
export async function markHistoryAsSynced(id: string): Promise<void> {
  try {
    const items = await getHistory();
    const updated = items.map((item) => {
      if (item.id === id) {
        return { ...item, isSynced: true };
      }
      return item;
    });
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Gagal menandai item tersinkron:', error);
  }
}

/**
 * Hapus satu item riwayat mandiri
 */
export async function deleteHistoryItem(id: string): Promise<void> {
  try {
    const current = await getHistory();
    const updated = current.filter((item) => item.id !== id);
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Gagal menghapus item riwayat:', error);
  }
}

/**
 * Hapus beberapa item riwayat yang dipilih (pilih beberapa)
 */
export async function deleteSelectedHistory(ids: string[]): Promise<void> {
  try {
    const current = await getHistory();
    const setIds = new Set(ids);
    const updated = current.filter((item) => !setIds.has(item.id));
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Gagal menghapus item-item riwayat terpilih:', error);
  }
}

/**
 * Hapus seluruh riwayat sekaligus (hapus semua sekalian)
 */
export async function clearAllHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error('Gagal menghapus seluruh riwayat:', error);
  }
}
