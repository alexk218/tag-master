export interface SpotifyTrack {
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { name: string };
  duration_ms: number;
}

export interface SpicetifyHistoryLocation {
  pathname: string;
  search?: string;
  state?: {
    trackUri?: string;
    trackUris?: string[];
    [key: string]: any;
  };
}
