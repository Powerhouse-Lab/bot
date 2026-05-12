export type AppSettings = {
  forceDirectPlay: boolean;
  videoCachingEnabled: boolean;
  videoCacheSizeMb: number;
};

export type JellyfinSession = {
  serverUrl: string;
  accessToken: string;
  userId: string;
  username: string;
};

export type PublicSystemInfo = {
  ServerName?: string;
  Version?: string;
  Id?: string;
};

export type AuthenticateResponse = {
  AccessToken: string;
  User: {
    Id: string;
    Name: string;
  };
};

export type JellyfinLibrary = {
  Id: string;
  Name: string;
  CollectionType?: string;
  Type?: string;
};

export type JellyfinUserData = {
  IsFavorite?: boolean;
  Played?: boolean;
  PlaybackPositionTicks?: number;
  PlayCount?: number;
};

export type JellyfinStudio = {
  Id?: string;
  Name: string;
};

export type JellyfinMediaSource = {
  Id?: string;
  Container?: string;
  Name?: string;
  Path?: string;
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  SupportsTranscoding?: boolean;
};

export type JellyfinPlaybackEvent = {
  ItemId: string;
  MediaSourceId?: string;
  PositionTicks: number;
  PlayMethod: 'DirectPlay' | 'DirectStream' | 'Transcode';
  IsPaused: boolean;
  CanSeek: boolean;
};

export type JellyfinItem = {
  Id: string;
  Name: string;
  Type?: string;
  MediaType?: string;
  ProductionYear?: number;
  Overview?: string;
  CommunityRating?: number;
  CriticRating?: number;
  OfficialRating?: string;
  Genres?: string[];
  Studios?: JellyfinStudio[];
  RunTimeTicks?: number;
  SeriesName?: string;
  AlbumArtist?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  ImageTags?: Record<string, string>;
  UserData?: JellyfinUserData;
  MediaSources?: JellyfinMediaSource[];
};

export type ItemListResponse<T> = {
  Items: T[];
  TotalRecordCount: number;
};
