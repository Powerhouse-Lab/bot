import { requireNativeComponent, ViewProps } from 'react-native';

export type JellyfinLibMpvPlayerEvent = {
  nativeEvent: {
    type: 'ready' | 'play' | 'pause' | 'progress' | 'ended' | 'error';
    currentTime?: number;
    message?: string;
  };
};

export type JellyfinLibMpvViewProps = ViewProps & {
  sourceUrl: string;
  title?: string;
  paused?: boolean;
  onPlayerEvent?: (event: JellyfinLibMpvPlayerEvent) => void;
};

export default requireNativeComponent<JellyfinLibMpvViewProps>('JellyfinLibMpvView');
