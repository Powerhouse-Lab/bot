import { Linking, Platform } from 'react-native';
import { JellyfinItem } from '../types';

const MPV_ANDROID_PACKAGE = 'is.xyz.mpv';

function getStreamMimeType(item: JellyfinItem): string {
  return item.MediaType === 'Audio' || item.Type === 'Audio' ? 'audio/*' : 'video/*';
}

function encodeIntentValue(value: string): string {
  return encodeURIComponent(value).replace(/'/g, '%27');
}

export function getMpvAndroidIntentUrl(streamUrl: string, item: JellyfinItem): string {
  const parsedUrl = new URL(streamUrl);
  const scheme = parsedUrl.protocol.replace(':', '');
  const intentPath = `${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;
  const title = encodeIntentValue(item.Name);
  const mimeType = getStreamMimeType(item);

  return `intent://${intentPath}#Intent;scheme=${scheme};action=android.intent.action.VIEW;type=${mimeType};package=${MPV_ANDROID_PACKAGE};S.title=${title};end`;
}

export async function openWithMpvAndroid(streamUrl: string, item: JellyfinItem): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openURL(streamUrl);
    return;
  }

  try {
    await Linking.openURL(getMpvAndroidIntentUrl(streamUrl, item));
  } catch {
    await Linking.openURL(streamUrl);
  }
}
