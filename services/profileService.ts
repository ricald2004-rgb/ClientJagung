import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserRegion, saveUserRegion, UserRegion } from './regionService';

export interface FarmerProfile {
  nama: string;
  noHp?: string;
  kelompokTani?: string;
  provinsi: string;
  kabupaten: string;
  kecamatan?: string;
  desa?: string;
  tipeDesa?: 'Desa' | 'Kelurahan';
}

const PROFILE_STORAGE_KEY = '@milu_sesehati_farmer_profile';

/**
 * Mendapatkan data profil petani dari penyimpanan lokal HP
 */
export async function getFarmerProfile(): Promise<FarmerProfile | null> {
  try {
    const json = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
    if (json) {
      return JSON.parse(json) as FarmerProfile;
    }

    // Jika profil lengkap belum pernah disimpan, coba ambil data wilayah yang ada
    const reg = await getUserRegion();
    if (reg && reg.provinsi && reg.kabupaten) {
      return {
        nama: 'Petani Jagung',
        provinsi: reg.provinsi,
        kabupaten: reg.kabupaten,
        kecamatan: reg.kecamatan,
        desa: reg.desa,
        tipeDesa: reg.tipeDesa,
      };
    }

    return null;
  } catch (err) {
    console.error('Gagal mengambil profil petani:', err);
    return null;
  }
}

/**
 * Menyimpan data profil petani dan menyinkronkan dengan data wilayah
 */
export async function saveFarmerProfile(profile: FarmerProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));

    // Sinkronkan wilayah ke regionService agar HomeScreen dan riwayat langsung terbarui
    const region: UserRegion = {
      provinsi: profile.provinsi,
      kabupaten: profile.kabupaten,
      kecamatan: profile.kecamatan,
      desa: profile.desa,
      tipeDesa: profile.tipeDesa,
    };
    await saveUserRegion(region);
  } catch (err) {
    console.error('Gagal menyimpan profil petani:', err);
    throw err;
  }
}

/**
 * Memeriksa apakah petani sudah pernah mengisi profil awal (Onboarding)
 */
export async function hasConfiguredFarmerProfile(): Promise<boolean> {
  try {
    const json = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
    if (!json) return false;
    const profile = JSON.parse(json) as FarmerProfile;
    return Boolean(
      profile &&
      profile.nama &&
      profile.nama.trim().length > 0 &&
      profile.nama.trim() !== 'Petani Jagung' &&
      profile.provinsi &&
      profile.kabupaten
    );
  } catch {
    return false;
  }
}


