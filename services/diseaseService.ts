import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { DISEASE_DETAILS } from '../constants/diseaseData';
import { EXPLORE_DETAILS } from '../constants/exploreData';
import { getBackendUrl, resolveServerUrlFromRemote } from './syncService';

export interface DiseaseInfoItem {
  id: string;
  nama: string;
  deskripsi: string;
  gejala: string;
  solusi: string;
  penjelasan_edukasi: string;
  updated_at?: string;
}

const DISEASE_CACHE_KEY = '@milu_sesehati_disease_info_cache';
let memoryCache: Record<string, DiseaseInfoItem> | null = null;
let lastSyncSignature = '';

type DiseaseListener = () => void;
const updateListeners: Set<DiseaseListener> = new Set();

/**
 * Berlangganan event pembaruan data penyakit secara realtime.
 * Layar aktif yang berlangganan akan otomatis di-render ulang begitu data di server berubah.
 */
export function subscribeDiseaseUpdates(callback: DiseaseListener): () => void {
  updateListeners.add(callback);
  return () => {
    updateListeners.delete(callback);
  };
}

function notifyUpdateListeners(): void {
  updateListeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.warn('Error listener update:', e);
    }
  });
}

/**
 * Inisialisasi awal cache dari penyimpanan lokal HP
 */
export async function initDiseaseService(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(DISEASE_CACHE_KEY);
    if (raw) {
      memoryCache = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Gagal memuat cache penyakit lokal:', err);
  }
}

// Jalankan inisialisasi awal segera
initDiseaseService().catch(() => {});

/**
 * Sinkronisasi data penjelasan penyakit terbaru dari Web Dashboard / Server
 * - Berjalan senyap di background saat HP online
 * - Jika offline, tetap menggunakan cache lokal tanpa error
 * - Jika ada data baru yang berubah, langsung memicu re-render realtime di layar HP!
 */
export async function syncDiseaseInfoFromServer(): Promise<boolean> {
  await resolveServerUrlFromRemote().catch(() => {});
  const serverUrl = getBackendUrl();
  try {
    const response = await axios.get(`${serverUrl}/api/penyakit-info`, {
      timeout: 3500,
    });

    if (response.data && response.data.success && Array.isArray(response.data.data)) {
      const map: Record<string, DiseaseInfoItem> = {};
      const currentSignature = JSON.stringify(response.data.data);

      response.data.data.forEach((item: DiseaseInfoItem) => {
        map[item.id] = item;
        map[item.nama] = item;
      });

      const isDataChanged = currentSignature !== lastSyncSignature;
      lastSyncSignature = currentSignature;

      memoryCache = map;
      await AsyncStorage.setItem(DISEASE_CACHE_KEY, JSON.stringify(map));

      if (isDataChanged) {
        console.log('🔄 [REALTIME CMS] Konten baru terdeteksi & disinkronkan ke layar!');
        notifyUpdateListeners();
      }
      return true;
    }
    return false;
  } catch (err: any) {
    // Senyap saat offline
    return false;
  }
}

// Mulai poller realtime global setiap 3 detik di background
let globalSyncTimer: any = null;
export function startRealtimeDiseaseSync(intervalMs = 3000): void {
  if (globalSyncTimer) return;
  syncDiseaseInfoFromServer().catch(() => {});
  globalSyncTimer = setInterval(() => {
    syncDiseaseInfoFromServer().catch(() => {});
  }, intervalMs);
}

// Otomatis aktifkan poller segera
startRealtimeDiseaseSync(3000);

/**
 * Ambil detail diagnosa penyakit (deskripsi, gejala, solusi)
 * Prioritas: Cache Server Terbaru di HP -> Fallback Default
 */
export async function getDiseaseDetails(namaPenyakit: string): Promise<{ deskripsi: string; gejala: string; solusi: string }> {
  // 1. Coba dari memory cache
  if (memoryCache && memoryCache[namaPenyakit]) {
    const item = memoryCache[namaPenyakit];
    return {
      deskripsi: item.deskripsi,
      gejala: item.gejala,
      solusi: item.solusi,
    };
  }

  // 2. Coba dari AsyncStorage jika memoryCache belum terisi
  try {
    const raw = await AsyncStorage.getItem(DISEASE_CACHE_KEY);
    if (raw) {
      memoryCache = JSON.parse(raw);
      if (memoryCache && memoryCache[namaPenyakit]) {
        const item = memoryCache[namaPenyakit];
        return {
          deskripsi: item.deskripsi,
          gejala: item.gejala,
          solusi: item.solusi,
        };
      }
    }
  } catch {}

  // 3. Fallback default jika belum pernah tersinkron
  const fallback = DISEASE_DETAILS[namaPenyakit] || DISEASE_DETAILS['Bukan Objek Jagung'];
  return {
    deskripsi: fallback?.deskripsi || 'Penjelasan belum tersedia.',
    gejala: fallback?.gejala || '-',
    solusi: fallback?.solusi || 'Silakan konsultasikan dengan penyuluh pertanian terdekat.',
  };
}

/**
 * Ambil detail edukasi untuk tab Pusat Informasi (Explore)
 */
export async function getExploreDetails(namaPenyakit: string): Promise<{ nama: string; penjelasan: string }> {
  // 1. Coba dari cache
  if (memoryCache && memoryCache[namaPenyakit]) {
    const item = memoryCache[namaPenyakit];
    return {
      nama: item.nama,
      penjelasan: item.penjelasan_edukasi || item.deskripsi,
    };
  }

  try {
    const raw = await AsyncStorage.getItem(DISEASE_CACHE_KEY);
    if (raw) {
      memoryCache = JSON.parse(raw);
      if (memoryCache && memoryCache[namaPenyakit]) {
        const item = memoryCache[namaPenyakit];
        return {
          nama: item.nama,
          penjelasan: item.penjelasan_edukasi || item.deskripsi,
        };
      }
    }
  } catch {}

  // 2. Fallback default
  const fallback = EXPLORE_DETAILS[namaPenyakit];
  return {
    nama: fallback?.nama || namaPenyakit,
    penjelasan: fallback?.penjelasan || 'Informasi sedang diperbarui.',
  };
}

/**
 * Ambil seluruh data edukasi untuk halaman explore
 */
export async function getAllExploreList(): Promise<Array<{ nama: string; penjelasan: string }>> {
  const defaultKeys = ['Jagung Sehat', 'Bercak Daun', 'Hawar Daun', 'Karat Daun'];
  const results = [];
  for (const key of defaultKeys) {
    const item = await getExploreDetails(key);
    results.push(item);
  }
  return results;
}

