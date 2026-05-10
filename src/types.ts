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

export type JellyfinItem = {
  Id: string;
  Name: string;
  Type?: string;
  MediaType?: string;
  ProductionYear?: number;
  Overview?: string;
  RunTimeTicks?: number;
  SeriesName?: string;
  AlbumArtist?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  ImageTags?: Record<string, string>;
  UserData?: JellyfinUserData;
};

export type ItemListResponse<T> = {
  Items: T[];
  TotalRecordCount: number;
};
