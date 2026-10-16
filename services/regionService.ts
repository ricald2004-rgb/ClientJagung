import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserRegion {
  provinsi: string;
  kabupaten: string;
  kecamatan?: string;
  desa?: string;
  tipeDesa?: 'Desa' | 'Kelurahan';
}

const REGION_STORAGE_KEY = '@milu_sesehati_user_region';

/**
 * Mendapatkan wilayah yang tersimpan
 */
export async function getUserRegion(): Promise<UserRegion | null> {
  try {
    const json = await AsyncStorage.getItem(REGION_STORAGE_KEY);
    if (!json) return null;
    return JSON.parse(json) as UserRegion;
  } catch (error) {
    console.error('Gagal mengambil wilayah tersimpan:', error);
    return null;
  }
}

/**
 * Menyimpan data wilayah pengguna
 */
export async function saveUserRegion(region: UserRegion): Promise<void> {
  try {
    await AsyncStorage.setItem(REGION_STORAGE_KEY, JSON.stringify(region));
  } catch (error) {
    console.error('Gagal menyimpan wilayah:', error);
    throw error;
  }
}

/**
 * Cek apakah pengguna sudah pernah mengatur wilayah
 */
export async function isRegionConfigured(): Promise<boolean> {
  const reg = await getUserRegion();
  return reg !== null && Boolean(reg.provinsi && reg.kabupaten);
}

/**
 * Menghapus wilayah yang tersimpan
 */
export async function clearUserRegion(): Promise<void> {
  try {
    await AsyncStorage.removeItem(REGION_STORAGE_KEY);
  } catch (error) {
    console.error('Gagal menghapus wilayah:', error);
  }
}

/**
 * Format string tampilan rapi dari wilayah:
 * Contoh: "Desa Dulamayo, Kec. Telaga, Kab. Gorontalo, Gorontalo"
 * Atau: "Kel. Moodu, Kec. Kota Timur, Kota Gorontalo, Gorontalo"
 */
export function formatRegionLabel(region: UserRegion | null | undefined): string {
  if (!region || !region.provinsi || !region.kabupaten) {
    return 'Wilayah Belum Diatur';
  }

  const parts: string[] = [];

  const desa = region.desa?.trim();
  if (desa) {
    const tipe = region.tipeDesa || (region.kabupaten.toLowerCase().includes('kota') ? 'Kelurahan' : 'Desa');
    const prefix = tipe === 'Kelurahan'
      ? (desa.toLowerCase().startsWith('kel') ? '' : 'Kel. ')
      : (desa.toLowerCase().startsWith('desa') ? '' : 'Desa ');
    parts.push(`${prefix}${desa}`);
  }

  const kec = region.kecamatan?.trim();
  if (kec) {
    const prefixKec = kec.toLowerCase().startsWith('kec') ? '' : 'Kec. ';
    parts.push(`${prefixKec}${kec}`);
  }

  parts.push(region.kabupaten);
  parts.push(region.provinsi);

  return parts.join(', ');
}

