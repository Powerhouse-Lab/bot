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

export type JellyfinItem = {
  Id: string;
  Name: string;
  Type?: string;
  ProductionYear?: number;
  Overview?: string;
  RunTimeTicks?: number;
  SeriesName?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  ImageTags?: Record<string, string>;
};

export type ItemListResponse<T> = {
  Items: T[];
  TotalRecordCount: number;
};
