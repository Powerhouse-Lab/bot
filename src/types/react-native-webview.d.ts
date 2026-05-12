declare module 'react-native-webview' {
  import { ComponentType } from 'react';
  import { NativeSyntheticEvent, ViewStyle } from 'react-native';

  export type WebViewMessageEvent = NativeSyntheticEvent<{ data: string }>;

  export type WebViewProps = {
    allowsFullscreenVideo?: boolean;
    allowsInlineMediaPlayback?: boolean;
    javaScriptEnabled?: boolean;
    mediaPlaybackRequiresUserAction?: boolean;
    mixedContentMode?: 'never' | 'always' | 'compatibility';
    onMessage?: (event: WebViewMessageEvent) => void;
    originWhitelist?: string[];
    source: { html?: string; uri?: string; baseUrl?: string };
    style?: ViewStyle;
  };

  export const WebView: ComponentType<WebViewProps>;
}
