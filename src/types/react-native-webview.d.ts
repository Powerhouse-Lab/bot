declare module 'react-native-webview' {
  import { ComponentType } from 'react';
  import { ViewStyle } from 'react-native';

  export type WebViewProps = {
    allowsFullscreenVideo?: boolean;
    allowsInlineMediaPlayback?: boolean;
    javaScriptEnabled?: boolean;
    mediaPlaybackRequiresUserAction?: boolean;
    originWhitelist?: string[];
    source: { html?: string; uri?: string; baseUrl?: string };
    style?: ViewStyle;
  };

  export const WebView: ComponentType<WebViewProps>;
}
