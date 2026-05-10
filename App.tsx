import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { authenticate, formatRuntime, getLatestItems, getLibraries, getPrimaryImageUrl, getPublicSystemInfo } from './src/api/jellyfin';
import { Button } from './src/components/Button';
import { EmptyState } from './src/components/EmptyState';
import { clearSession, loadSession, saveSession } from './src/storage/session';
import { colors, spacing } from './src/theme';
import { JellyfinItem, JellyfinLibrary, JellyfinSession, PublicSystemInfo } from './src/types';

type Loadable<T> = {
  data: T;
  loading: boolean;
  error?: string;
};

const initialLibraries: Loadable<JellyfinLibrary[]> = { data: [], loading: false };
const initialLatest: Loadable<JellyfinItem[]> = { data: [], loading: false };

export default function App() {
  const [session, setSession] = useState<JellyfinSession>();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [systemInfo, setSystemInfo] = useState<PublicSystemInfo>();
  const [loginError, setLoginError] = useState<string>();
  const [isBooting, setIsBooting] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [libraries, setLibraries] = useState<Loadable<JellyfinLibrary[]>>(initialLibraries);
  const [latestItems, setLatestItems] = useState<Loadable<JellyfinItem[]>>(initialLatest);

  const canSubmit = useMemo(
    () => serverUrl.trim().length > 0 && username.trim().length > 0 && password.length > 0,
    [password, serverUrl, username],
  );

  useEffect(() => {
    let isMounted = true;

    loadSession()
      .then((storedSession) => {
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

  const refreshHome = useCallback(async (activeSession: JellyfinSession) => {
    setLibraries((current: Loadable<JellyfinLibrary[]>) => ({ ...current, loading: true, error: undefined }));
    setLatestItems((current: Loadable<JellyfinItem[]>) => ({ ...current, loading: true, error: undefined }));

    const [librariesResult, latestResult] = await Promise.allSettled([
      getLibraries(activeSession.serverUrl, activeSession.userId, activeSession.accessToken),
      getLatestItems(activeSession.serverUrl, activeSession.userId, activeSession.accessToken),
    ]);

    if (librariesResult.status === 'fulfilled') {
      setLibraries({ data: librariesResult.value, loading: false });
    } else {
      setLibraries({ data: [], loading: false, error: librariesResult.reason?.message ?? 'Unable to load libraries.' });
    }

    if (latestResult.status === 'fulfilled') {
      setLatestItems({ data: latestResult.value, loading: false });
    } else {
      setLatestItems({ data: [], loading: false, error: latestResult.reason?.message ?? 'Unable to load latest media.' });
    }
  }, []);

  useEffect(() => {
    if (session) {
      refreshHome(session);
    }
  }, [refreshHome, session]);

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
    setLatestItems(initialLatest);
  }, []);

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

  const isRefreshing = libraries.loading || latestItems.loading;

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

            <Text style={styles.sectionTitle}>Libraries</Text>
            {libraries.error ? <Text style={styles.errorText}>{libraries.error}</Text> : undefined}
            {libraries.data.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.libraryScroller}>
                {libraries.data.map((library: JellyfinLibrary) => (
                  <View key={library.Id} style={styles.libraryPill}>
                    <Text style={styles.libraryName}>{library.Name}</Text>
                    <Text style={styles.libraryType}>{library.CollectionType ?? library.Type ?? 'Library'}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <EmptyState title="No libraries yet" message="Your Jellyfin libraries will appear here after the app can reach your server." />
            )}

            <Text style={styles.sectionTitle}>Recently added</Text>
            {latestItems.error ? <Text style={styles.errorText}>{latestItems.error}</Text> : undefined}
          </View>
        }
        contentContainerStyle={styles.homeContent}
        data={latestItems.data}
        keyExtractor={(item: JellyfinItem) => item.Id}
        numColumns={2}
        refreshControl={<RefreshControl refreshing={isRefreshing} tintColor={colors.primary} onRefresh={() => refreshHome(session)} />}
        renderItem={({ item }: { item: JellyfinItem }) => <MediaCard accessToken={session.accessToken} item={item} serverUrl={session.serverUrl} />}
        ListEmptyComponent={
          latestItems.loading ? undefined : <EmptyState title="Nothing recent" message="Recently added movies, episodes, and songs will show up here." />
        }
      />
    </SafeAreaView>
  );
}

function MediaCard({ accessToken, item, serverUrl }: { accessToken: string; item: JellyfinItem; serverUrl: string }) {
  const runtime = formatRuntime(item.RunTimeTicks);
  const imageUrl = getPrimaryImageUrl(serverUrl, item, accessToken);

  return (
    <View style={styles.mediaCard}>
      <View style={styles.poster}>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.posterImage} /> : <Text style={styles.posterFallback}>JF</Text>}
      </View>
      <Text numberOfLines={2} style={styles.mediaTitle}>{item.Name}</Text>
      <Text numberOfLines={1} style={styles.mediaMeta}>
        {[item.Type, item.ProductionYear, runtime].filter(Boolean).join(' • ')}
      </Text>
      {item.Overview ? <Text numberOfLines={3} style={styles.overview}>{item.Overview}</Text> : undefined}
    </View>
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
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  flex: {
    flex: 1,
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
    flex: 1,
    margin: spacing.sm,
    overflow: 'hidden',
    paddingBottom: spacing.md,
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
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: spacing.md,
    marginTop: spacing.xl,
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
  title: {
    color: colors.text,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginTop: spacing.xs,
  },
});
