import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import Constants from 'expo-constants';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import {
  getHistory,
  getPendingSyncItems,
  markHistoryAsSynced
} from './historyService';
import { UserRegion } from './regionService';
import { FarmerProfile, getFarmerProfile } from './profileService';

/**
 * =========================================================================
 * KONFIGURASI SERVER CLOUD / TUNNEL (UNTUK DIAKSES ORANG LAIN)
 * =========================================================================
 * Jika Anda menggunakan Cloud Tunnel (cth: 'npx localtunnel --port 5000') 
 * atau deploy backend ke Cloud Hosting (Render/Railway),
 * cukup masukkan URL tersebut di sini, misal:
 * export const CLOUD_SERVER_URL = 'https://milu-jagung.loca.lt';
 *
 * Jika dikosongkan (''), sistem otomatis menggunakan IP laptop developer (Wi-Fi).
 */
export let CLOUD_SERVER_URL: string = '';

const SERVER_URL_STORAGE_KEY = '@milu_sesehati_custom_server_url';
let inMemoryServerUrl: string | null = null;

// Inisialisasi awal server URL dari storage jika ada
AsyncStorage.getItem(SERVER_URL_STORAGE_KEY)
  .then((val) => {
    if (val && val.trim()) {
      inMemoryServerUrl = val.trim();
    }
  })
  .catch(() => {});

export async function setCustomServerUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  inMemoryServerUrl = clean;
  await AsyncStorage.setItem(SERVER_URL_STORAGE_KEY, clean);
}

export async function getCustomServerUrl(): Promise<string | null> {
  if (inMemoryServerUrl) return inMemoryServerUrl;
  return AsyncStorage.getItem(SERVER_URL_STORAGE_KEY);
}

export async function resetCustomServerUrl(): Promise<void> {
  inMemoryServerUrl = null;
  await AsyncStorage.removeItem(SERVER_URL_STORAGE_KEY);
}

/**
 * Otomatis deteksi IP backend:
 * 1. Jika CLOUD_SERVER_URL diisi, prioritaskan itu
 * 2. Web: localhost:5000
 * 3. HP Fisik / Expo Go: Ambil IP host laptop yang terhubung ke Expo Metro bundler
 * 4. Custom Server dari Penyimpanan (jika disetel manual dan bukan IP basi)
 * 5. Fallback: IP Wi-Fi laptop aktif saat ini (http://192.168.1.11:5000)
 */
export const getBackendUrl = (): string => {
  const cloudUrl = String(CLOUD_SERVER_URL || '').trim();
  if (cloudUrl.length > 0) {
    return cloudUrl;
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:5000';
  }

  // 1. Deteksi IP host developer dari berbagai properti Expo SDK (termasuk Expo Go)
  const hostCandidates = [
    Constants.expoConfig?.hostUri,
    (Constants as any).expoGoConfig?.debuggerHost,
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost,
    (Constants as any).manifest2?.extra?.expoClient?.hostUri,
    (Constants as any).manifest?.debuggerHost,
    (Constants as any).linkingUri,
  ];

  for (const candidate of hostCandidates) {
    if (candidate && typeof candidate === 'string') {
      const match = candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (match && match[1] && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:5000`;
      }
    }
  }

  // 2. Fallback IP laptop Wi-Fi aktif saat ini
  return 'http://192.168.101.13:5000';
};

/**
 * Kompres gambar KHUSUS saat akan dikirim ke server dashboard.
 * Ukuran foto asli di HP dipertahankan penuh untuk diagnosa AI,
 * kompresi ini hanya untuk upload agar sangat ringan (<80KB) dan hemat kuota!
 */
export async function compressImageForUpload(imageUri: string): Promise<string | null> {
  try {
    if (!imageUri) return null;
    const manipResult = await manipulateAsync(
      imageUri,
      [{ resize: { width: 640 } }], // Resize maksimal lebar 640px (sangat cukup untuk preview dashboard)
      { compress: 0.6, format: SaveFormat.JPEG, base64: true }
    );
    return manipResult.base64 || null;
  } catch (err: any) {
    console.warn('⚠️ Kompresi upload dilewati:', err.message);
    return null;
  }
}

export const SERVER_BASE_URL = getBackendUrl();

export interface SyncPayload {
  id?: string; // ID unik diagnosa di HP untuk memastikan tidak terjadi duplikasi data di server
  penyakit: string;
  confidence: string;
  top3: Array<{ penyakit: string; confidence: string }>;
  region: UserRegion | null;
  imageUri?: string | null;
  imageBase64?: string | null;
}

// ==========================================
// EVENT SUBSCRIBER SISTEM SINKRONISASI
// ==========================================
type SyncListener = (syncedCount: number) => void;
const syncListeners: Set<SyncListener> = new Set();

export function subscribeSyncEvents(callback: SyncListener): () => void {
  syncListeners.add(callback);
  return () => {
    syncListeners.delete(callback);
  };
}

function notifySyncListeners(count: number): void {
  syncListeners.forEach((cb) => {
    try {
      cb(count);
    } catch (e) {
      console.warn('Error listener sync:', e);
    }
  });
}

/**
 * Sinkronisasi satu hasil diagnosa ke server web dashboard secara otomatis dan senyap (silent)
 * - 'Bukan Objek Jagung' otomatis dikecualikan
 * - Foto otomatis dikompres sebelum dikirim agar cepat & tanpa hambatan
 */
export async function syncDiagnosisToServer(payload: SyncPayload): Promise<boolean> {
  // 1. KECUALIKAN 'Bukan Objek Jagung'
  if (payload.penyakit === 'Bukan Objek Jagung') {
    return false;
  }

  const serverUrl = getBackendUrl();

  // 2. Kompres foto KHUSUS untuk upload
  let uploadBase64 = payload.imageBase64 || null;
  if (payload.imageUri) {
    try {
      const compressed = await compressImageForUpload(payload.imageUri);
      if (compressed) {
        uploadBase64 = compressed;
      }
    } catch {}
  }

  const sendPayload = async (includeImage: boolean, timeoutMs: number = 4000) => {
    let farmerName = 'Petani Jagung';
    let prov = payload.region?.provinsi;
    let kab = payload.region?.kabupaten;
    let kec = payload.region?.kecamatan;
    let des = payload.region?.desa;
    let kelompokTani = '-';
    let noHp = '-';

    // Ambil data profil petani terbaru dari penyimpanan lokal
    try {
      const p = await getFarmerProfile();
      if (p) {
        if (p.nama && p.nama.trim()) farmerName = p.nama.trim();
        if (p.kelompokTani && p.kelompokTani.trim()) kelompokTani = p.kelompokTani.trim();
        if (p.noHp && p.noHp.trim()) noHp = p.noHp.trim();
        if (!prov || prov === 'Tidak Diketahui') prov = p.provinsi;
        if (!kab || kab === 'Tidak Diketahui') kab = p.kabupaten;
        if (!kec || kec === '-') kec = p.kecamatan;
        if (!des || des === '-') des = p.desa;
      }
    } catch {}

    const body = {
      client_id: payload.id || null,
      penyakit: payload.penyakit,
      confidence: payload.confidence,
      top3: payload.top3,
      provinsi: prov || 'Tidak Diketahui',
      kabupaten: kab || 'Tidak Diketahui',
      kecamatan: kec || '-',
      desa: des || '-',
      nama_petani: farmerName,
      kelompok_tani: kelompokTani,
      no_hp: noHp,
      image_url: includeImage && uploadBase64 ? `data:image/jpeg;base64,${uploadBase64}` : null,
    };

    const response = await axios.post(`${serverUrl}/api/diagnosa`, body, {
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return !!(response.data && response.data.success);
  };

  try {
    const ok = await sendPayload(true, 4000);
    if (ok) {
      console.log(`✅ [SYNC ONLINE] Sukses terkirim ke dashboard (${payload.penyakit})!`);
      return true;
    }
  } catch (err: any) {
    // Jika koneksi putus atau server belum bisa dijangkau
    const isNetworkDown =
      err.code === 'ECONNREFUSED' ||
      err.code === 'ENETUNREACH' ||
      err.code === 'ERR_NETWORK' ||
      err.message?.includes('Network Error');

    if (!isNetworkDown) {
      try {
        // Fallback kirim data teks jika payload foto bermasalah/lambat
        const okFallback = await sendPayload(false, 2500);
        if (okFallback) {
          console.log(`✅ [SYNC FALLBACK] Data tersinkron ke dashboard tanpa foto.`);
          return true;
        }
      } catch {}
    }
  }

  return false;
}

/**
 * Sinkronisasi data profil petani ke server web dashboard secara langsung.
 * Memperbarui nama petani, kelompok tani, nomor WA/HP, dan wilayah pada seluruh riwayat diagnosa di dashboard.
 */
export async function syncFarmerProfileToServer(profile?: FarmerProfile | null): Promise<boolean> {
  try {
    const p = profile || (await getFarmerProfile());
    if (!p || !p.nama) return false;

    const serverUrl = getBackendUrl();
    const body = {
      nama_petani: p.nama.trim(),
      kelompok_tani: (p.kelompokTani && p.kelompokTani.trim()) ? p.kelompokTani.trim() : '-',
      no_hp: (p.noHp && p.noHp.trim()) ? p.noHp.trim() : '-',
      provinsi: p.provinsi || 'Tidak Diketahui',
      kabupaten: p.kabupaten || 'Tidak Diketahui',
      kecamatan: p.kecamatan || '-',
      desa: p.desa || '-',
    };

    const res = await axios.post(`${serverUrl}/api/profile/sync`, body, {
      timeout: 3500,
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.data && res.data.success) {
      console.log(`✅ [PROFIL SYNC] Berhasil sinkronisasi profil petani ke dashboard! (${p.nama} - Poktan: ${body.kelompok_tani}, WA: ${body.no_hp})`);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('⚠️ Gagal sinkronisasi profil petani ke server:', err.message);
    return false;
  }
}

let isSyncingInProgress = false;

/**
 * Sinkronisasi seluruh antrean diagnosa offline ke server secara senyap di background.
 * Dilengkapi Mutex Lock (isSyncingInProgress) untuk mencegah duplikasi data jika terpanggil simultan!
 */
export async function syncPendingDiagnoses(): Promise<number> {
  if (isSyncingInProgress) {
    return 0; // Abaikan pemanggilan simultan yang sedang berjalan
  }
  isSyncingInProgress = true;

  try {
    const pendingItems = await getPendingSyncItems();
    if (pendingItems.length === 0) {
      return 0;
    }

    console.log(`📡 [AUTO-SYNC] Menemukan ${pendingItems.length} diagnosa tertunda di HP, mencoba sinkronisasi ke server...`);
    let syncedCount = 0;

    for (const item of pendingItems) {
      // Kecualikan Bukan Objek Jagung: tandai synced agar tidak terus menumpuk di antrean
      if (item.penyakit === 'Bukan Objek Jagung') {
        await markHistoryAsSynced(item.id);
        continue;
      }

      const region: UserRegion = {
        provinsi: item.provinsi || (item.wilayah ? item.wilayah.split(',')[0]?.trim() : 'Tidak Diketahui'),
        kabupaten: item.kabupaten || (item.wilayah ? item.wilayah.split(',')[1]?.trim() : 'Tidak Diketahui'),
        kecamatan: item.kecamatan || undefined,
        desa: item.desa || undefined,
      };

      const success = await syncDiagnosisToServer({
        id: item.id, // Sertakan ID unik agar server dapat mendeteksi & menolak duplikat
        penyakit: item.penyakit,
        confidence: item.confidence,
        top3: item.top3,
        region: region,
        imageUri: item.imageUri,
        imageBase64: item.imageBase64 || null,
      });

      if (success) {
        await markHistoryAsSynced(item.id);
        syncedCount++;
      } else {
        // Jika item pertama gagal (misal server belum online / Wi-Fi belum siap IP),
        // hentikan loop untuk putaran ini agar hemat resource
        console.log(`⏳ [AUTO-SYNC] Server belum merespons, menunda antrean sisa.`);
        break;
      }
    }

    if (syncedCount > 0) {
      console.log(`🎉 [AUTO-SYNC] ${syncedCount} diagnosa berhasil otomatis disinkronkan ke dashboard!`);
      notifySyncListeners(syncedCount);
    }
    return syncedCount;
  } catch (err: any) {
    console.warn('⚠️ [AUTO-SYNC ERROR]:', err.message);
    return 0;
  } finally {
    isSyncingInProgress = false;
  }
}

/**
 * Sinkronisasi seluruh diagnosa (baik pending maupun yang ada di riwayat)
 * Digunakan saat tombol "Sinkronkan Sekarang" ditekan atau saat user ingin memastikan
 * semua data di riwayat HP benar-benar terkirim ke web dashboard!
 */
export async function syncAllHistoryToServer(): Promise<number> {
  if (isSyncingInProgress) {
    return 0;
  }
  isSyncingInProgress = true;

  try {
    const allItems = await getHistory();
    if (allItems.length === 0) return 0;

    let syncedCount = 0;
    for (const item of allItems) {
      if (item.penyakit === 'Bukan Objek Jagung') {
        await markHistoryAsSynced(item.id);
        continue;
      }

      const region: UserRegion = {
        provinsi: item.provinsi || (item.wilayah ? item.wilayah.split(',')[0]?.trim() : 'Tidak Diketahui'),
        kabupaten: item.kabupaten || (item.wilayah ? item.wilayah.split(',')[1]?.trim() : 'Tidak Diketahui'),
        kecamatan: item.kecamatan || undefined,
        desa: item.desa || undefined,
      };

      const success = await syncDiagnosisToServer({
        id: item.id, // ID unik diagnosa
        penyakit: item.penyakit,
        confidence: item.confidence,
        top3: item.top3,
        region: region,
        imageUri: item.imageUri,
        imageBase64: item.imageBase64 || null,
      });

      if (success) {
        await markHistoryAsSynced(item.id);
        syncedCount++;
      }
    }

    if (syncedCount > 0) {
      notifySyncListeners(syncedCount);
    }
    return syncedCount;
  } catch (err) {
    console.warn('Gagal sinkronisasi semua riwayat:', err);
    return 0;
  } finally {
    isSyncingInProgress = false;
  }
}

let autoSyncRetryTimers: any[] = [];

function clearAutoSyncTimers() {
  autoSyncRetryTimers.forEach((t) => clearTimeout(t));
  autoSyncRetryTimers = [];
}

/**
 * Memicu rangkaian auto-sync bertahap (progressive retries):
 * - Percobaan 1: 1.5s
 * - Percobaan 2: 4s (ketika Wi-Fi DHCP biasanya sudah selesai)
 * - Percobaan 3: 8s
 * - Percobaan 4: 12s
 */
export function triggerAutoSyncWithRetry(onSynced?: (count: number) => void) {
  clearAutoSyncTimers();

  const retryDelays = [1500, 4000, 8000, 12000];

  retryDelays.forEach((delay) => {
    const timer = setTimeout(async () => {
      const pending = await getPendingSyncItems();
      if (pending.length === 0) {
        clearAutoSyncTimers();
        return;
      }

      const count = await syncPendingDiagnoses();
      if (count > 0 && onSynced) {
        onSynced(count);
      }
    }, delay);

    autoSyncRetryTimers.push(timer);
  });
}

/**
 * Pasang pendengar otomatis koneksi internet (NetInfo)
 * Begitu HP online kembali, seluruh data otomatis terkirim tanpa tombol apa pun!
 */
export function setupAutoSyncListener(onSynced?: (count: number) => void) {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      triggerAutoSyncWithRetry(onSynced);
    }
  });
}

let periodicSyncTimer: any = null;

/**
 * Background worker yang memeriksa antrean offline secara periodik (setiap 4 detik).
 * Jika ada data yang belum tersinkron, langsung berusaha mengirim ke server.
 * Jika antrean kosong, proses ini menghabiskan 0 byte jaringan & <1ms CPU.
 */
export function startPeriodicPendingSync(intervalMs = 4000): void {
  if (periodicSyncTimer) return;

  periodicSyncTimer = setInterval(async () => {
    try {
      const pending = await getPendingSyncItems();
      if (pending.length > 0 && !isSyncingInProgress) {
        await syncPendingDiagnoses();
      }
    } catch {}
  }, intervalMs);
}

