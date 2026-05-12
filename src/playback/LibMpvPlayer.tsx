import { requireNativeComponent, ViewProps } from 'react-native';

export type LibMpvPlayerMessage = {
  type: 'ready' | 'play' | 'pause' | 'progress' | 'ended' | 'error';
  currentTime?: number;
  message?: string;
};

type NativeLibMpvPlayerEvent = {
  nativeEvent: LibMpvPlayerMessage;
};

export type LibMpvPlayerProps = ViewProps & {
  sourceUrl: string;
  title?: string;
  paused?: boolean;
  onPlayerEvent?: (event: NativeLibMpvPlayerEvent) => void;
};

export const LibMpvPlayer = requireNativeComponent<LibMpvPlayerProps>('JellyfinLibMpvView');
