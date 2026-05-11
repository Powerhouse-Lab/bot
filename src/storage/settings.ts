import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../types';

const SETTINGS_KEY = 'jellyfin.settings.v1';

export const defaultSettings: AppSettings = {
  forceDirectPlay: true,
  videoCachingEnabled: true,
  videoCacheSizeMb: 1024,
};

export async function loadSettings(): Promise<AppSettings> {
  const rawSettings = await AsyncStorage.getItem(SETTINGS_KEY);
  return rawSettings ? { ...defaultSettings, ...(JSON.parse(rawSettings) as Partial<AppSettings>) } : defaultSettings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
