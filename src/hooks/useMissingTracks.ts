import { useState } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface CacheTrack {
  path: string;
  filename: string;
  track_id: string;
  size: number;
  modified: number;
  artist: string;
  title: string;
}

interface SpotifyTrack {
  id: string;
  uri?: string;
  name: string;
  artists: string;
  album: string;
  added_at?: string;
}

interface LocalTracksCache {
  generated: string;
  music_directory: string;
  total_files: number;
  files_with_track_id: number;
  tracks: CacheTrack[];
}

// Custom hook for missing tracks functionality
export function useMissingTracks() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [masterTracks, setMasterTracks] = useState<SpotifyTrack[]>([]);
  const [localTracks, setLocalTracks] = useState<Map<string, CacheTrack>>(new Map());
  const [missingTracks, setMissingTracks] = useState<SpotifyTrack[]>([]);
  const [serverUrl, setServerUrl] = useLocalStorage<string>(
    "tagify:localServerUrl",
    "http://localhost:8765"
  );
  const [serverConnected, setServerConnected] = useState(false);
  const [showConfigInput, setShowConfigInput] = useState(false);

  // Load all tracks in MASTER playlist
  const loadMasterTracks = async () => {
    try {
      // We'll use Spicetify's playlist API to get these
      const playlistId = localStorage.getItem("tagify:masterPlaylistId");

      if (!playlistId) {
        setError("Master playlist ID not set. Please set it in the settings.");
        setIsLoading(false);
        return [];
      }

      // Get playlist tracks
      const response = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`
      );

      if (!response || !response.items) {
        throw new Error("No tracks found in MASTER playlist");
      }

      // Get initial batch of tracks
      let allTracks = response.items;
      let nextUrl = response.next;

      // If there are more tracks, fetch them
      while (nextUrl) {
        const nextResponse = await Spicetify.CosmosAsync.get(nextUrl);
        allTracks = [...allTracks, ...nextResponse.items];
        nextUrl = nextResponse.next;
      }

      // Format tracks in our standardized format
      const formattedTracks = allTracks.map((item: any) => ({
        id: item.track.id,
        name: item.track.name,
        artists: item.track.artists.map((a: any) => a.name).join(", "),
        album: item.track.album?.name || "",
        added_at: item.added_at,
      }));

      setMasterTracks(formattedTracks);
      console.log(`Loaded ${formattedTracks.length} tracks from MASTER playlist`);

      return formattedTracks;
    } catch (error) {
      console.error("Error loading MASTER playlist tracks:", error);
      setError("Failed to load MASTER playlist tracks. See console for details.");
      return [];
    }
  };

  // Load local tracks cache from our local server
  const loadLocalTracksCache = async () => {
    try {
      // Check if server is running
      const statusResponse = await fetch(`${serverUrl}/status`);
      if (!statusResponse.ok) {
        throw new Error(`Server status check failed: ${statusResponse.statusText}`);
      }

      const statusData = await statusResponse.json();
      console.log("Server status:", statusData);
      setServerConnected(true);

      // Get the actual cache data
      const response = await fetch(serverUrl);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: LocalTracksCache = await response.json();

      // Convert to a Map for faster lookups by track_id
      const tracksMap = new Map<string, CacheTrack>();
      data.tracks.forEach((track) => {
        tracksMap.set(track.track_id, track);
      });

      setLocalTracks(tracksMap);
      console.log(`Loaded ${data.tracks.length} local tracks from cache`);

      return tracksMap;
    } catch (error) {
      console.error("Error loading local tracks cache:", error);
      setServerConnected(false);
      setError("Failed to load local tracks cache. Is the local tracks server running?");
      return new Map<string, CacheTrack>();
    }
  };

  // Find missing tracks by comparing Spotify tracks with local cache
  const findMissingTracks = (tracks: SpotifyTrack[], localTracksMap: Map<string, CacheTrack>) => {
    // Filter out local files and tracks already in the local collection
    const missing = tracks.filter((track) => {
      // Skip tracks without an ID (shouldn't happen but just in case)
      if (!track.id) return false;

      // Skip tracks that are local files
      if (track.uri && track.uri.startsWith("spotify:local:")) return false;

      // Skip tracks that are already in the local collection
      return !localTracksMap.has(track.id);
    });

    // Sort by added_at date in reverse order (newest first)
    const sortedMissing = [...missing].sort((a, b) => {
      // If dates are available, sort by date (newest first)
      if (a.added_at && b.added_at) {
        return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
      }
      // If one has a date and the other doesn't, prioritize the one with date
      if (a.added_at) return -1;
      if (b.added_at) return 1;
      // Fallback to alphabetical by artist + title
      return `${a.artists} - ${a.name}`.localeCompare(`${b.artists} - ${b.name}`);
    });

    setMissingTracks(sortedMissing);
    console.log(`Found ${sortedMissing.length} missing tracks (excluding local files)`);
    return sortedMissing;
  };

  // Load all data
  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load from cache first
      const savedServerUrl = localStorage.getItem("tagify:localServerUrl");
      if (savedServerUrl) {
        setServerUrl(savedServerUrl);
      }

      const tracksMap = await loadLocalTracksCache();

      if (tracksMap.size === 0) {
        setShowConfigInput(true);
        setIsLoading(false);
        return;
      }

      const tracks = (await loadMasterTracks()) || [];

      if (tracks && tracks.length > 0 && tracksMap.size > 0) {
        findMissingTracks(tracks, tracksMap);
      } else {
        // Set empty missing tracks if we don't have both data sources
        setMissingTracks([]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setError("An error occurred while loading data. See console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  // Connect to server with new URL
  const connectToServer = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Save server URL to localStorage
      localStorage.setItem("tagify:localServerUrl", serverUrl);

      await loadLocalTracksCache();

      if (serverConnected) {
        setShowConfigInput(false);
        await loadData();
      }
    } catch (error) {
      console.error("Error connecting to server:", error);
      setError("Failed to connect to local tracks server.");
    } finally {
      setIsLoading(false);
    }
  };

  // Set MASTER playlist ID
  const setMasterPlaylistId = () => {
    const id = prompt(
      "Enter your MASTER playlist ID:",
      localStorage.getItem("tagify:masterPlaylistId") || ""
    );
    if (id) {
      localStorage.setItem("tagify:masterPlaylistId", id);
      loadData();
    }
  };

  // Create a playlist with missing tracks
  const createPlaylist = async () => {
    try {
      if (missingTracks.length === 0) {
        Spicetify.showNotification("No missing tracks to add to playlist", true);
        return;
      }

      // Get user ID
      const userProfile = await Spicetify.CosmosAsync.get("https://api.spotify.com/v1/me");
      const userId = userProfile.id;

      // Create playlist
      const date = new Date().toLocaleDateString();
      const playlistResponse = await Spicetify.CosmosAsync.post(
        `https://api.spotify.com/v1/users/${userId}/playlists`,
        {
          name: `Missing Tracks (${date})`,
          description: "Tracks from MASTER playlist that are missing from local files",
          public: false,
        }
      );

      const playlistId = playlistResponse.id;

      // Add tracks in batches
      const trackUris = missingTracks.map((track) => `spotify:track:${track.id}`);

      for (let i = 0; i < trackUris.length; i += 100) {
        const batch = trackUris.slice(i, i + 100);
        await Spicetify.CosmosAsync.post(
          `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
          {
            uris: batch,
          }
        );
      }

      Spicetify.showNotification(`Created playlist with ${missingTracks.length} missing tracks!`);

      // Navigate to the playlist
      Spicetify.Platform.History.push(`/playlist/${playlistId}`);
    } catch (error) {
      console.error("Error creating playlist:", error);
      Spicetify.showNotification("Failed to create playlist", true);
    }
  };

  return {
    isLoading,
    error,
    serverUrl,
    setServerUrl,
    serverConnected,
    showConfigInput,
    setShowConfigInput,
    masterTracks,
    localTracks,
    missingTracks,
    loadData,
    connectToServer,
    setMasterPlaylistId,
    createPlaylist,
  };
}
