import {
  AuthenticateResponse,
  ItemListResponse,
  JellyfinItem,
  JellyfinLibrary,
  JellyfinUserData,
  PublicSystemInfo,
} from '../types';

const CLIENT_NAME = 'Jellyfin Mobile Client';
const DEVICE_NAME = 'Expo Mobile';
const DEVICE_ID = 'expo-jellyfin-mobile-client';
const VERSION = '0.1.0';

export class JellyfinApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'JellyfinApiError';
  }
}

export function normalizeServerUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new JellyfinApiError('Enter a Jellyfin server URL.');
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function authorizationHeader(token?: string): string {
  const parts = [
    `MediaBrowser Client="${CLIENT_NAME}"`,
    `Device="${DEVICE_NAME}"`,
    `DeviceId="${DEVICE_ID}"`,
    `Version="${VERSION}"`,
  ];

  if (token) {
    parts.push(`Token="${token}"`);
  }

  return parts.join(', ');
}

async function request<T>(serverUrl: string, path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: authorizationHeader(token),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let message = `Jellyfin request failed with status ${response.status}`;
    try {
      const errorBody = (await response.json()) as { message?: string; Message?: string };
      message = errorBody.Message ?? errorBody.message ?? message;
    } catch {
      // Jellyfin does not always return JSON for failures; keep the status message.
    }
    throw new JellyfinApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export async function getPublicSystemInfo(serverUrl: string): Promise<PublicSystemInfo> {
  return request<PublicSystemInfo>(normalizeServerUrl(serverUrl), '/System/Info/Public');
}

export async function authenticate(serverUrl: string, username: string, password: string): Promise<AuthenticateResponse> {
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  return request<AuthenticateResponse>(normalizedServerUrl, '/Users/AuthenticateByName', {
    method: 'POST',
    body: JSON.stringify({ Username: username.trim(), Pw: password }),
  });
}

export async function getLibraries(serverUrl: string, userId: string, token: string): Promise<JellyfinLibrary[]> {
  const response = await request<ItemListResponse<JellyfinLibrary>>(
    serverUrl,
    `/Users/${encodeURIComponent(userId)}/Views`,
    undefined,
    token,
  );
  return response.Items;
}

export async function getLatestItems(serverUrl: string, userId: string, token: string): Promise<JellyfinItem[]> {
  const params = new URLSearchParams({
    Limit: '30',
    Fields: 'Overview,PrimaryImageAspectRatio,ProductionYear,RunTimeTicks,UserData,MediaSources,CommunityRating,CriticRating,OfficialRating,Genres,Studios',
    EnableImageTypes: 'Primary,Backdrop,Thumb',
  });

  return request<JellyfinItem[]>(
    serverUrl,
    `/Users/${encodeURIComponent(userId)}/Items/Latest?${params.toString()}`,
    undefined,
    token,
  );
}

export async function getResumeItems(serverUrl: string, userId: string, token: string): Promise<JellyfinItem[]> {
  const params = new URLSearchParams({
    Limit: '20',
    MediaTypes: 'Video',
    Fields: 'Overview,PrimaryImageAspectRatio,ProductionYear,RunTimeTicks,UserData,MediaSources,CommunityRating,CriticRating,OfficialRating,Genres,Studios',
    EnableImageTypes: 'Primary,Backdrop,Thumb',
  });

  const response = await request<ItemListResponse<JellyfinItem>>(
    serverUrl,
    `/Users/${encodeURIComponent(userId)}/Items/Resume?${params.toString()}`,
    undefined,
    token,
  );
  return response.Items;
}

export async function getLibraryItems(serverUrl: string, userId: string, token: string, parentId: string): Promise<JellyfinItem[]> {
  const params = new URLSearchParams({
    ParentId: parentId,
    Recursive: 'true',
    SortBy: 'SortName',
    SortOrder: 'Ascending',
    Limit: '60',
    Fields: 'Overview,PrimaryImageAspectRatio,ProductionYear,RunTimeTicks,UserData,MediaSources,CommunityRating,CriticRating,OfficialRating,Genres,Studios',
    EnableImageTypes: 'Primary,Backdrop,Thumb',
  });

  const response = await request<ItemListResponse<JellyfinItem>>(
    serverUrl,
    `/Users/${encodeURIComponent(userId)}/Items?${params.toString()}`,
    undefined,
    token,
  );
  return response.Items;
}

export async function searchItems(serverUrl: string, userId: string, token: string, query: string): Promise<JellyfinItem[]> {
  const params = new URLSearchParams({
    SearchTerm: query.trim(),
    Recursive: 'true',
    IncludeItemTypes: 'Movie,Series,Episode,Audio,MusicAlbum',
    Limit: '40',
    Fields: 'Overview,PrimaryImageAspectRatio,ProductionYear,RunTimeTicks,UserData,MediaSources,CommunityRating,CriticRating,OfficialRating,Genres,Studios',
    EnableImageTypes: 'Primary,Backdrop,Thumb',
  });

  const response = await request<ItemListResponse<JellyfinItem>>(
    serverUrl,
    `/Users/${encodeURIComponent(userId)}/Items?${params.toString()}`,
    undefined,
    token,
  );
  return response.Items;
}

export async function setFavorite(
  serverUrl: string,
  userId: string,
  token: string,
  itemId: string,
  favorite: boolean,
): Promise<JellyfinUserData> {
  return request<JellyfinUserData>(
    serverUrl,
    `/Users/${encodeURIComponent(userId)}/FavoriteItems/${encodeURIComponent(itemId)}`,
    { method: favorite ? 'POST' : 'DELETE' },
    token,
  );
}

export function getPrimaryImageUrl(serverUrl: string, item: JellyfinItem, accessToken: string, maxWidth = 360): string | undefined {
  if (!item.ImageTags?.Primary) {
    return undefined;
  }

  const params = new URLSearchParams({
    maxWidth: String(maxWidth),
    quality: '90',
    tag: item.ImageTags.Primary,
    api_key: accessToken,
  });

  return `${serverUrl}/Items/${item.Id}/Images/Primary?${params.toString()}`;
}

export function formatRuntime(ticks?: number): string | undefined {
  if (!ticks) {
    return undefined;
  }

  const minutes = Math.round(ticks / 600_000_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function getPreferredMediaSource(item: JellyfinItem) {
  return item.MediaSources?.find((source) => source.SupportsDirectPlay) ?? item.MediaSources?.[0];
}

function getStreamExtension(container?: string): string {
  const preferredContainer = container?.split(',').map((value) => value.trim()).filter(Boolean)[0];
  if (!preferredContainer) {
    return '';
  }

  const normalizedContainer = preferredContainer.toLowerCase();
  const extensionMap: Record<string, string> = {
    matroska: 'mkv',
    mov: 'mp4',
    mpegts: 'ts',
    quicktime: 'mp4',
  };
  const extension = extensionMap[normalizedContainer] ?? normalizedContainer;
  return `.${encodeURIComponent(extension)}`;
}

export function isPlayableMedia(item: JellyfinItem): boolean {
  return item.MediaType === 'Video' || item.MediaType === 'Audio' || item.Type === 'Audio' || item.Type === 'Video';
}

export function getStreamUrl(
  serverUrl: string,
  item: JellyfinItem,
  accessToken: string,
  options: { forceDirectPlay?: boolean } = {},
): string {
  const forceDirectPlay = options.forceDirectPlay ?? true;
  const mediaSource = getPreferredMediaSource(item);
  const params = new URLSearchParams({
    api_key: accessToken,
  });

  let streamExtension = '';
  if (forceDirectPlay) {
    params.set('Static', 'true');
    params.set('MediaSourceId', mediaSource?.Id ?? item.Id);
    streamExtension = getStreamExtension(mediaSource?.Container);
  }

  const mediaRoute = item.MediaType === 'Audio' || item.Type === 'Audio' ? 'Audio' : 'Videos';

  return `${serverUrl}/${mediaRoute}/${encodeURIComponent(item.Id)}/stream${streamExtension}?${params.toString()}`;
}

export function formatProgress(item: JellyfinItem): string | undefined {
  const position = item.UserData?.PlaybackPositionTicks;
  if (!position || !item.RunTimeTicks) {
    return undefined;
  }

  const percent = Math.min(99, Math.max(1, Math.round((position / item.RunTimeTicks) * 100)));
  return `${percent}% watched`;
}
