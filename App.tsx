import { StatusBar } from 'expo-status-bar';
import { clearVideoCacheAsync, getCurrentVideoCacheSize, setVideoCacheSizeAsync, useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  Switch,
  TextInput,
  View,
} from 'react-native';
import {
  authenticate,
  formatProgress,
  formatRuntime,
  getLatestItems,
  getLibraries,
  getLibraryItems,
  getPrimaryImageUrl,
  getPublicSystemInfo,
  getResumeItems,
  getStreamUrl,
  searchItems,
  setFavorite,
} from './src/api/jellyfin';
import { Button } from './src/components/Button';
import { EmptyState } from './src/components/EmptyState';
import { clearSession, loadSession, saveSession } from './src/storage/session';
import { defaultSettings, loadSettings, saveSettings } from './src/storage/settings';
import { colors, spacing } from './src/theme';
import { AppSettings, JellyfinItem, JellyfinLibrary, JellyfinSession, PublicSystemInfo } from './src/types';

type Loadable<T> = {
  data: T;
  loading: boolean;
  error?: string;
};

type HomeSection = 'home' | 'library' | 'search' | 'settings';

const initialLibraries: Loadable<JellyfinLibrary[]> = { data: [], loading: false };
const initialItems: Loadable<JellyfinItem[]> = { data: [], loading: false };

export default function App() {
  const [session, setSession] = useState<JellyfinSession>();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [systemInfo, setSystemInfo] = useState<PublicSystemInfo>();
  const [loginError, setLoginError] = useState<string>();
  const [isBooting, setIsBooting] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeSection, setActiveSection] = useState<HomeSection>('home');
  const [libraries, setLibraries] = useState<Loadable<JellyfinLibrary[]>>(initialLibraries);
  const [latestItems, setLatestItems] = useState<Loadable<JellyfinItem[]>>(initialItems);
  const [resumeItems, setResumeItems] = useState<Loadable<JellyfinItem[]>>(initialItems);
  const [selectedLibrary, setSelectedLibrary] = useState<JellyfinLibrary>();
  const [libraryItems, setLibraryItems] = useState<Loadable<JellyfinItem[]>>(initialItems);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Loadable<JellyfinItem[]>>(initialItems);
  const [selectedItem, setSelectedItem] = useState<JellyfinItem>();
  const [playbackItem, setPlaybackItem] = useState<JellyfinItem>();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [detailError, setDetailError] = useState<string>();

  const canSubmit = useMemo(
    () => serverUrl.trim().length > 0 && username.trim().length > 0 && password.length > 0,
    [password, serverUrl, username],
  );

  useEffect(() => {
    let isMounted = true;

    Promise.all([loadSession(), loadSettings()])
      .then(([storedSession, storedSettings]) => {
        if (isMounted) {
          setSettings(storedSettings);
        }
        if (isMounted && storedSession) {
          setSession(storedSession);
          setServerUrl(storedSession.serverUrl);
          setUsername(storedSession.username);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsBooting(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isBooting) {
      saveSettings(settings);
    }
  }, [isBooting, settings]);

  useEffect(() => {
    if (playbackItem) {
      return;
    }

    setVideoCacheSizeAsync(settings.videoCachingEnabled ? settings.videoCacheSizeMb * 1024 * 1024 : 0).catch(() => {
      // Cache sizing depends on native video support and can fail before the player module is ready.
    });
  }, [playbackItem, settings.videoCacheSizeMb, settings.videoCachingEnabled]);

  const refreshHome = useCallback(async (activeSession: JellyfinSession) => {
    setLibraries((current: Loadable<JellyfinLibrary[]>) => ({ ...current, loading: true, error: undefined }));
    setLatestItems((current: Loadable<JellyfinItem[]>) => ({ ...current, loading: true, error: undefined }));
    setResumeItems((current: Loadable<JellyfinItem[]>) => ({ ...current, loading: true, error: undefined }));

    const [librariesResult, latestResult, resumeResult] = await Promise.allSettled([
      getLibraries(activeSession.serverUrl, activeSession.userId, activeSession.accessToken),
      getLatestItems(activeSession.serverUrl, activeSession.userId, activeSession.accessToken),
      getResumeItems(activeSession.serverUrl, activeSession.userId, activeSession.accessToken),
    ]);

    if (librariesResult.status === 'fulfilled') {
      setLibraries({ data: librariesResult.value, loading: false });
      setSelectedLibrary((current: JellyfinLibrary | undefined) => current ?? librariesResult.value[0]);
    } else {
      setLibraries({ data: [], loading: false, error: librariesResult.reason?.message ?? 'Unable to load libraries.' });
    }

    if (latestResult.status === 'fulfilled') {
      setLatestItems({ data: latestResult.value, loading: false });
    } else {
      setLatestItems({ data: [], loading: false, error: latestResult.reason?.message ?? 'Unable to load latest media.' });
    }

    if (resumeResult.status === 'fulfilled') {
      setResumeItems({ data: resumeResult.value, loading: false });
    } else {
      setResumeItems({ data: [], loading: false, error: resumeResult.reason?.message ?? 'Unable to load continue watching.' });
    }
  }, []);

  useEffect(() => {
    if (session) {
      refreshHome(session);
    }
  }, [refreshHome, session]);

  useEffect(() => {
    if (!session || !selectedLibrary) {
      return;
    }

    let isMounted = true;
    setLibraryItems((current: Loadable<JellyfinItem[]>) => ({ ...current, loading: true, error: undefined }));

    getLibraryItems(session.serverUrl, session.userId, session.accessToken, selectedLibrary.Id)
      .then((items) => {
        if (isMounted) {
          setLibraryItems({ data: items, loading: false });
        }
      })
      .catch((error) => {
        if (isMounted) {
          setLibraryItems({ data: [], loading: false, error: error instanceof Error ? error.message : 'Unable to load library.' });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedLibrary, session]);

  const handleProbeServer = useCallback(async () => {
    setLoginError(undefined);
    setSystemInfo(undefined);

    try {
      const info = await getPublicSystemInfo(serverUrl);
      setSystemInfo(info);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to reach Jellyfin server.');
    }
  }, [serverUrl]);

  const handleSignIn = useCallback(async () => {
    setIsSigningIn(true);
    setLoginError(undefined);

    try {
      const response = await authenticate(serverUrl, username, password);
      const nextSession: JellyfinSession = {
        serverUrl: serverUrl.trim().replace(/\/+$/, '').replace(/^(?!https?:\/\/)/i, 'https://'),
        accessToken: response.AccessToken,
        userId: response.User.Id,
        username: response.User.Name,
      };
      await saveSession(nextSession);
      setPassword('');
      setSession(nextSession);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Sign in failed. Check your server and credentials.');
    } finally {
      setIsSigningIn(false);
    }
  }, [password, serverUrl, username]);

  const handleSignOut = useCallback(async () => {
    await clearSession();
    setSession(undefined);
    setLibraries(initialLibraries);
    setLatestItems(initialItems);
    setResumeItems(initialItems);
    setLibraryItems(initialItems);
    setSelectedLibrary(undefined);
    setSearchResults(initialItems);
    setSelectedItem(undefined);
    setPlaybackItem(undefined);
  }, []);

  const handleSearch = useCallback(async () => {
    if (!session || !searchQuery.trim()) {
      return;
    }

    setSearchResults((current: Loadable<JellyfinItem[]>) => ({ ...current, loading: true, error: undefined }));
    try {
      const items = await searchItems(session.serverUrl, session.userId, session.accessToken, searchQuery);
      setSearchResults({ data: items, loading: false });
    } catch (error) {
      setSearchResults({ data: [], loading: false, error: error instanceof Error ? error.message : 'Search failed.' });
    }
  }, [searchQuery, session]);

  const replaceItem = useCallback((updated: JellyfinItem) => {
    const replace = (items: JellyfinItem[]) => items.map((item) => (item.Id === updated.Id ? { ...item, ...updated } : item));
    setLatestItems((current: Loadable<JellyfinItem[]>) => ({ ...current, data: replace(current.data) }));
    setResumeItems((current: Loadable<JellyfinItem[]>) => ({ ...current, data: replace(current.data) }));
    setLibraryItems((current: Loadable<JellyfinItem[]>) => ({ ...current, data: replace(current.data) }));
    setSearchResults((current: Loadable<JellyfinItem[]>) => ({ ...current, data: replace(current.data) }));
    setSelectedItem((current: JellyfinItem | undefined) => (current?.Id === updated.Id ? { ...current, ...updated } : current));
  }, []);

  const handleToggleFavorite = useCallback(async (item: JellyfinItem) => {
    if (!session) {
      return;
    }

    setDetailError(undefined);
    const nextFavorite = !item.UserData?.IsFavorite;
    try {
      const userData = await setFavorite(session.serverUrl, session.userId, session.accessToken, item.Id, nextFavorite);
      replaceItem({ ...item, UserData: userData });
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Unable to update favorite.');
    }
  }, [replaceItem, session]);

  const handlePlayInApp = useCallback((item: JellyfinItem) => {
    setDetailError(undefined);
    setPlaybackItem(item);
  }, []);

  const handlePlayExternal = useCallback(async (item: JellyfinItem) => {
    if (!session) {
      return;
    }

    setDetailError(undefined);
    try {
      await Linking.openURL(getStreamUrl(session.serverUrl, item, session.accessToken, { forceDirectPlay: settings.forceDirectPlay }));
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Unable to open this item for external playback.');
    }
  }, [session, settings.forceDirectPlay]);

  if (isBooting) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.centered}>
          <Text style={styles.title}>Jellyfin Mobile</Text>
          <Text style={styles.subtitle}>Restoring your session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.kicker}>Open media, anywhere</Text>
            <Text style={styles.title}>Jellyfin Mobile</Text>
            <Text style={styles.subtitle}>Connect to your self-hosted Jellyfin server to browse libraries and recently added media.</Text>

            <View style={styles.card}>
              <Text style={styles.label}>Server URL</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                inputMode="url"
                onChangeText={setServerUrl}
                placeholder="https://jellyfin.example.com"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={serverUrl}
              />

              <Text style={styles.label}>Username</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setUsername}
                placeholder="alex"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={username}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.muted}
                secureTextEntry
                style={styles.input}
                value={password}
              />

              {systemInfo ? (
                <Text style={styles.successText}>
                  Found {systemInfo.ServerName ?? 'Jellyfin'} {systemInfo.Version ? `(${systemInfo.Version})` : ''}
                </Text>
              ) : undefined}
              {loginError ? <Text style={styles.errorText}>{loginError}</Text> : undefined}

              <View style={styles.actionStack}>
                <Button disabled={!serverUrl.trim()} label="Test server" onPress={handleProbeServer} variant="secondary" />
                <Button disabled={!canSubmit} label="Sign in" loading={isSigningIn} onPress={handleSignIn} />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const isRefreshing = libraries.loading || latestItems.loading || resumeItems.loading;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <FlatList
        ListHeaderComponent={
          <View style={styles.homeHeader}>
            <View style={styles.headerRow}>
              <View style={styles.flex}>
                <Text style={styles.kicker}>Welcome back</Text>
                <Text style={styles.title}>{session.username}</Text>
                <Text style={styles.subtitle} numberOfLines={1}>{session.serverUrl}</Text>
              </View>
              <Button label="Sign out" onPress={handleSignOut} variant="secondary" />
            </View>

            <View style={styles.tabRow}>
              <Segment label="Home" selected={activeSection === 'home'} onPress={() => setActiveSection('home')} />
              <Segment label="Library" selected={activeSection === 'library'} onPress={() => setActiveSection('library')} />
              <Segment label="Search" selected={activeSection === 'search'} onPress={() => setActiveSection('search')} />
              <Segment label="Settings" selected={activeSection === 'settings'} onPress={() => setActiveSection('settings')} />
            </View>

            {activeSection === 'home' ? (
              <HomeContent
                libraries={libraries}
                latestItems={latestItems}
                resumeItems={resumeItems}
                onOpenItem={setSelectedItem}
                onSelectLibrary={(library) => {
                  setSelectedLibrary(library);
                  setActiveSection('library');
                }}
                serverUrl={session.serverUrl}
                token={session.accessToken}
              />
            ) : undefined}

            {activeSection === 'library' ? (
              <LibraryContent
                libraries={libraries.data}
                libraryItems={libraryItems}
                onOpenItem={setSelectedItem}
                onSelectLibrary={setSelectedLibrary}
                selectedLibrary={selectedLibrary}
                serverUrl={session.serverUrl}
                token={session.accessToken}
              />
            ) : undefined}

            {activeSection === 'search' ? (
              <SearchContent
                onOpenItem={setSelectedItem}
                onSearch={handleSearch}
                searchQuery={searchQuery}
                searchResults={searchResults}
                serverUrl={session.serverUrl}
                setSearchQuery={setSearchQuery}
                token={session.accessToken}
              />
            ) : undefined}

            {activeSection === 'settings' ? (
              <SettingsContent
                onChangeSettings={setSettings}
                settings={settings}
              />
            ) : undefined}
          </View>
        }
        contentContainerStyle={styles.homeContent}
        data={[] as JellyfinItem[]}
        keyExtractor={(item: JellyfinItem) => item.Id}
        refreshControl={<RefreshControl refreshing={isRefreshing} tintColor={colors.primary} onRefresh={() => refreshHome(session)} />}
        renderItem={() => null}
      />

      <ItemDetailsModal
        detailError={detailError}
        item={selectedItem}
        onClose={() => {
          setSelectedItem(undefined);
          setDetailError(undefined);
        }}
        onPlayExternal={handlePlayExternal}
        onPlayInApp={handlePlayInApp}
        onToggleFavorite={handleToggleFavorite}
        serverUrl={session.serverUrl}
        token={session.accessToken}
      />

      {playbackItem ? (
        <InAppPlayerModal
          item={playbackItem}
          key={playbackItem.Id}
          onClose={() => setPlaybackItem(undefined)}
          serverUrl={session.serverUrl}
          settings={settings}
          token={session.accessToken}
        />
      ) : undefined}
    </SafeAreaView>
  );
}

function HomeContent({
  libraries,
  latestItems,
  onOpenItem,
  onSelectLibrary,
  resumeItems,
  serverUrl,
  token,
}: {
  libraries: Loadable<JellyfinLibrary[]>;
  latestItems: Loadable<JellyfinItem[]>;
  onOpenItem: (item: JellyfinItem) => void;
  onSelectLibrary: (library: JellyfinLibrary) => void;
  resumeItems: Loadable<JellyfinItem[]>;
  serverUrl: string;
  token: string;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Libraries</Text>
      {libraries.error ? <Text style={styles.errorText}>{libraries.error}</Text> : undefined}
      {libraries.data.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.libraryScroller}>
          {libraries.data.map((library: JellyfinLibrary) => (
            <Pressable key={library.Id} onPress={() => onSelectLibrary(library)} style={styles.libraryPill}>
              <Text style={styles.libraryName}>{library.Name}</Text>
              <Text style={styles.libraryType}>{library.CollectionType ?? library.Type ?? 'Library'}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <EmptyState title="No libraries yet" message="Your Jellyfin libraries will appear here after the app can reach your server." />
      )}

      <MediaRail error={resumeItems.error} items={resumeItems.data} onOpenItem={onOpenItem} serverUrl={serverUrl} title="Continue watching" token={token} />
      <MediaGrid error={latestItems.error} items={latestItems.data} onOpenItem={onOpenItem} serverUrl={serverUrl} title="Recently added" token={token} />
    </View>
  );
}

function LibraryContent({
  libraries,
  libraryItems,
  onOpenItem,
  onSelectLibrary,
  selectedLibrary,
  serverUrl,
  token,
}: {
  libraries: JellyfinLibrary[];
  libraryItems: Loadable<JellyfinItem[]>;
  onOpenItem: (item: JellyfinItem) => void;
  onSelectLibrary: (library: JellyfinLibrary) => void;
  selectedLibrary?: JellyfinLibrary;
  serverUrl: string;
  token: string;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Browse library</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.libraryScroller}>
        {libraries.map((library) => (
          <Pressable
            key={library.Id}
            onPress={() => onSelectLibrary(library)}
            style={[styles.libraryPill, selectedLibrary?.Id === library.Id ? styles.libraryPillActive : undefined]}
          >
            <Text style={styles.libraryName}>{library.Name}</Text>
            <Text style={styles.libraryType}>{library.CollectionType ?? library.Type ?? 'Library'}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <MediaGrid
        emptyMessage="Pick a library or add media to Jellyfin to browse it here."
        error={libraryItems.error}
        items={libraryItems.data}
        onOpenItem={onOpenItem}
        serverUrl={serverUrl}
        title={selectedLibrary?.Name ?? 'Library items'}
        token={token}
      />
    </View>
  );
}

function SearchContent({
  onOpenItem,
  onSearch,
  searchQuery,
  searchResults,
  serverUrl,
  setSearchQuery,
  token,
}: {
  onOpenItem: (item: JellyfinItem) => void;
  onSearch: () => void;
  searchQuery: string;
  searchResults: Loadable<JellyfinItem[]>;
  serverUrl: string;
  setSearchQuery: (query: string) => void;
  token: string;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Search your server</Text>
      <View style={styles.searchRow}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearchQuery}
          onSubmitEditing={onSearch}
          placeholder="Movies, series, episodes, music…"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={[styles.input, styles.searchInput]}
          value={searchQuery}
        />
        <Button disabled={!searchQuery.trim()} label="Search" loading={searchResults.loading} onPress={onSearch} />
      </View>
      <MediaGrid
        emptyMessage="Search results from movies, shows, episodes, albums, and songs will appear here."
        error={searchResults.error}
        items={searchResults.data}
        onOpenItem={onOpenItem}
        serverUrl={serverUrl}
        title="Results"
        token={token}
      />
    </View>
  );
}


function SettingsContent({
  onChangeSettings,
  settings,
}: {
  onChangeSettings: (settings: AppSettings) => void;
  settings: AppSettings;
}) {
  const [cacheSizeText, setCacheSizeText] = useState('Unknown');
  const updateSetting = useCallback(<Key extends keyof AppSettings,>(key: Key, value: AppSettings[Key]) => {
    onChangeSettings({ ...settings, [key]: value });
  }, [onChangeSettings, settings]);

  const refreshCacheSize = useCallback(() => {
    getCurrentVideoCacheSize()
      .then((bytes: number) => setCacheSizeText(formatBytes(bytes)))
      .catch(() => setCacheSizeText('Unavailable'));
  }, []);

  const clearCache = useCallback(() => {
    clearVideoCacheAsync()
      .then(() => setCacheSizeText('0 MB'))
      .catch(() => setCacheSizeText('Close the player and try again'));
  }, []);

  useEffect(() => {
    refreshCacheSize();
  }, [refreshCacheSize]);

  return (
    <View>
      <Text style={styles.sectionTitle}>Playback settings</Text>
      <SettingsRow
        description="Always request Jellyfin's static original stream. If the device cannot decode the file, playback fails instead of transcoding."
        label="Force direct video"
        onValueChange={(value) => updateSetting('forceDirectPlay', value)}
        value={settings.forceDirectPlay}
      />
      <SettingsRow
        description="Use the embedded video cache for direct streams to reduce repeat network usage."
        label="Cache video"
        onValueChange={(value) => updateSetting('videoCachingEnabled', value)}
        value={settings.videoCachingEnabled}
      />
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Preferred cache size</Text>
        <Text style={styles.settingsDescription}>Current limit: {settings.videoCacheSizeMb} MB</Text>
        <View style={styles.cacheSizeRow}>
          {[512, 1024, 2048].map((sizeMb) => (
            <Pressable
              key={sizeMb}
              onPress={() => updateSetting('videoCacheSizeMb', sizeMb)}
              style={[styles.cacheSizePill, settings.videoCacheSizeMb === sizeMb ? styles.cacheSizePillActive : undefined]}
            >
              <Text style={styles.cacheSizeText}>{sizeMb >= 1024 ? `${sizeMb / 1024} GB` : `${sizeMb} MB`}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Video cache used</Text>
        <Text style={styles.settingsDescription}>{cacheSizeText}</Text>
        <View style={styles.settingsActions}>
          <Button label="Refresh" onPress={refreshCacheSize} variant="secondary" />
          <Button label="Clear cache" onPress={clearCache} variant="secondary" />
        </View>
      </View>
    </View>
  );
}

function SettingsRow({
  description,
  label,
  onValueChange,
  value,
}: {
  description: string;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.settingsCard}>
      <View style={styles.settingsRowHeader}>
        <View style={styles.flex}>
          <Text style={styles.settingsLabel}>{label}</Text>
          <Text style={styles.settingsDescription}>{description}</Text>
        </View>
        <Switch onValueChange={onValueChange} thumbColor={colors.text} trackColor={{ false: colors.border, true: colors.primary }} value={value} />
      </View>
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Segment({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.segment, selected ? styles.segmentActive : undefined]}>
      <Text style={[styles.segmentText, selected ? styles.segmentTextActive : undefined]}>{label}</Text>
    </Pressable>
  );
}

function MediaRail({
  error,
  items,
  onOpenItem,
  serverUrl,
  title,
  token,
}: {
  error?: string;
  items: JellyfinItem[];
  onOpenItem: (item: JellyfinItem) => void;
  serverUrl: string;
  title: string;
  token: string;
}) {
  if (!items.length && !error) {
    return undefined;
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : undefined}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.libraryScroller}>
        {items.map((item) => (
          <View key={item.Id}>
            <MediaCard compact item={item} onPress={() => onOpenItem(item)} serverUrl={serverUrl} token={token} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function MediaGrid({
  emptyMessage = 'Media from your Jellyfin server will show up here.',
  error,
  items,
  onOpenItem,
  serverUrl,
  title,
  token,
}: {
  emptyMessage?: string;
  error?: string;
  items: JellyfinItem[];
  onOpenItem: (item: JellyfinItem) => void;
  serverUrl: string;
  title: string;
  token: string;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : undefined}
      {items.length > 0 ? (
        <View style={styles.grid}>
          {items.map((item) => (
            <View key={item.Id} style={styles.mediaCardWrapper}>
              <MediaCard item={item} onPress={() => onOpenItem(item)} serverUrl={serverUrl} token={token} />
            </View>
          ))}
        </View>
      ) : (
        <EmptyState title="Nothing to show" message={emptyMessage} />
      )}
    </View>
  );
}

function MediaCard({ compact = false, item, onPress, serverUrl, token }: { compact?: boolean; item: JellyfinItem; onPress: () => void; serverUrl: string; token: string }) {
  const runtime = formatRuntime(item.RunTimeTicks);
  const progress = formatProgress(item);
  const imageUrl = getPrimaryImageUrl(serverUrl, item, token);

  return (
    <Pressable onPress={onPress} style={[styles.mediaCard, compact ? styles.mediaCardCompact : undefined]}>
      <View style={styles.poster}>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.posterImage} /> : <Text style={styles.posterFallback}>JF</Text>}
        {item.UserData?.IsFavorite ? <Text style={styles.favoriteBadge}>★</Text> : undefined}
      </View>
      <Text numberOfLines={2} style={styles.mediaTitle}>{item.Name}</Text>
      <Text numberOfLines={1} style={styles.mediaMeta}>
        {[item.Type ?? item.MediaType, item.ProductionYear, runtime].filter(Boolean).join(' • ')}
      </Text>
      {progress ? <Text numberOfLines={1} style={styles.progressText}>{progress}</Text> : undefined}
      {!compact && item.Overview ? <Text numberOfLines={3} style={styles.overview}>{item.Overview}</Text> : undefined}
    </Pressable>
  );
}

function ItemDetailsModal({
  detailError,
  item,
  onClose,
  onPlayExternal,
  onPlayInApp,
  onToggleFavorite,
  serverUrl,
  token,
}: {
  detailError?: string;
  item?: JellyfinItem;
  onClose: () => void;
  onPlayExternal: (item: JellyfinItem) => void;
  onPlayInApp: (item: JellyfinItem) => void;
  onToggleFavorite: (item: JellyfinItem) => void;
  serverUrl: string;
  token: string;
}) {
  if (!item) {
    return undefined;
  }

  const imageUrl = getPrimaryImageUrl(serverUrl, item, token, 720);
  const runtime = formatRuntime(item.RunTimeTicks);
  const progress = formatProgress(item);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(item)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.detailPoster}>
              {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.posterImage} /> : <Text style={styles.posterFallback}>JF</Text>}
            </View>
            <Text style={styles.detailTitle}>{item.Name}</Text>
            <Text style={styles.mediaMeta}>
              {[item.SeriesName, item.Type ?? item.MediaType, item.ProductionYear, runtime, progress].filter(Boolean).join(' • ')}
            </Text>
            {item.Overview ? <Text style={styles.detailOverview}>{item.Overview}</Text> : undefined}
            {detailError ? <Text style={styles.errorText}>{detailError}</Text> : undefined}
            <View style={styles.actionStack}>
              <Button label="Play in app" onPress={() => onPlayInApp(item)} />
              <Button label="Open in external player" onPress={() => onPlayExternal(item)} variant="secondary" />
              <Button
                label={item.UserData?.IsFavorite ? 'Remove favorite' : 'Add favorite'}
                onPress={() => onToggleFavorite(item)}
                variant="secondary"
              />
              <Button label="Close" onPress={onClose} variant="secondary" />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


function InAppPlayerModal({
  item,
  onClose,
  serverUrl,
  settings,
  token,
}: {
  item: JellyfinItem;
  onClose: () => void;
  serverUrl: string;
  settings: AppSettings;
  token: string;
}) {
  const source = useMemo(() => ({
    uri: getStreamUrl(serverUrl, item, token, { forceDirectPlay: settings.forceDirectPlay }),
    useCaching: settings.videoCachingEnabled,
  }), [item, serverUrl, settings.forceDirectPlay, settings.videoCachingEnabled, token]);
  const player = useVideoPlayer(source, (videoPlayer: { play: () => void }) => {
    videoPlayer.play();
  });

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible>
      <SafeAreaView style={styles.playerContainer}>
        <StatusBar style="light" />
        <View style={styles.playerHeader}>
          <View style={styles.flex}>
            <Text style={styles.kicker}>In-app MPV-style player</Text>
            <Text numberOfLines={1} style={styles.playerTitle}>{item.Name}</Text>
          </View>
          <Button label="Done" onPress={onClose} variant="secondary" />
        </View>
        <VideoView
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
          nativeControls
          player={player}
          style={styles.videoPlayer}
        />
        <Text style={styles.playerHint}>
          Streaming directly from Jellyfin with the app's embedded player. Use the external player option if a codec is not supported by this device.
        </Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionStack: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  detailOverview: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: spacing.md,
  },
  detailPoster: {
    alignItems: 'center',
    aspectRatio: 0.72,
    backgroundColor: colors.panelRaised,
    borderRadius: 18,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  detailTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginTop: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  cacheSizePill: {
    backgroundColor: colors.panelRaised,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cacheSizePillActive: {
    borderColor: colors.primary,
  },
  cacheSizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cacheSizeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  favoriteBadge: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 10,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  flex: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  homeContent: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  homeHeader: {
    paddingTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  libraryName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  libraryPill: {
    backgroundColor: colors.panelRaised,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginRight: spacing.md,
    minWidth: 150,
    padding: spacing.md,
  },
  libraryPillActive: {
    borderColor: colors.primary,
  },
  libraryScroller: {
    marginBottom: spacing.md,
  },
  libraryType: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  loginContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  mediaCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: spacing.md,
    width: '100%',
  },
  mediaCardCompact: {
    width: 150,
  },
  mediaCardWrapper: {
    margin: spacing.sm,
    width: '45%',
  },
  mediaMeta: {
    color: colors.muted,
    fontSize: 12,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  mediaTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.58)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: '88%',
    padding: spacing.lg,
  },
  overview: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  poster: {
    alignItems: 'center',
    aspectRatio: 0.68,
    backgroundColor: colors.panelRaised,
    justifyContent: 'center',
    width: '100%',
  },
  posterFallback: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '900',
  },
  posterImage: {
    height: '100%',
    width: '100%',
  },
  playerContainer: {
    backgroundColor: '#05070d',
    flex: 1,
  },
  playerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  playerHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    padding: spacing.md,
  },
  playerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  videoPlayer: {
    backgroundColor: '#000',
    flex: 1,
    width: '100%',
  },
  progressText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  settingsActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  settingsCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  settingsDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  settingsLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  settingsRowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  segment: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm,
  },
  successText: {
    color: '#7ee787',
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginTop: spacing.xs,
  },
});
