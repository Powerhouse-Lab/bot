import AsyncStorage from '@react-native-async-storage/async-storage';
import { JellyfinSession } from '../types';

const SESSION_KEY = 'jellyfin.session.v1';

export async function loadSession(): Promise<JellyfinSession | undefined> {
  const rawSession = await AsyncStorage.getItem(SESSION_KEY);
  return rawSession ? (JSON.parse(rawSession) as JellyfinSession) : undefined;
}

export async function saveSession(session: JellyfinSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
