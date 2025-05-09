import { useState, useEffect } from "react";
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

// Interface for our cached data structure
interface CachedMissingTracksData {
  masterTracks: SpotifyTrack[];
  missingTracks: SpotifyTrack[];
  localTracksCount: number;
  lastUpdated: number; // timestamp
  playlistId: string | null; // store the playlist ID
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
  const [forceRefresh, setForceRefresh] = useState(false);

  // Add a new state for cached data
  const [cachedData, setCachedData] = useLocalStorage<CachedMissingTracksData | null>(
    "tagify:missingTracksCache",
    null
  );

  // Constants for cache expiration
  const CACHE_EXPIRATION_MS = 12 * 60 * 60 * 1000; // 12 hours

  // Check if cache is valid
  const isCacheValid = () => {
    if (!cachedData) return false;

    // Cache is invalid if data is older than expiration time
    const isExpired = Date.now() - cachedData.lastUpdated > CACHE_EXPIRATION_MS;

    // Cache is invalid if master playlist ID changed
    const currentPlaylistId = localStorage.getItem("tagify:masterPlaylistId");
    const playlistChanged = cachedData.playlistId !== currentPlaylistId;

    return !isExpired && !playlistChanged && !forceRefresh;
  };

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

  // Sanitize a URL string by removing extra quotes and escape characters
  const sanitizeUrl = (url: string): string => {
    // First, try to parse it in case it's been JSON stringified multiple times
    let sanitized = url;

    // Check if the URL is wrapped in quotes and/or has JSON escape characters
    const jsonWrappedPattern = /^["']?(\\*["'])*(.+?)(\\*["'])*["']?$/;
    const match = sanitized.match(jsonWrappedPattern);

    if (match && match[2]) {
      sanitized = match[2];
    }

    // Remove any remaining escape characters
    sanitized = sanitized.replace(/\\/g, "");

    // Remove any remaining quotes at the beginning or end
    sanitized = sanitized.replace(/^["']+|["']+$/g, "");

    // Make sure it's a valid URL format
    if (!sanitized.startsWith("http://") && !sanitized.startsWith("https://")) {
      if (sanitized.includes("localhost") || sanitized.match(/^\d+\.\d+\.\d+\.\d+/)) {
        sanitized = "http://" + sanitized;
      }
    }

    return sanitized;
  };
  const loadLocalTracksCache = async () => {
    try {
      // Sanitize the server URL to remove any extra quotes or escape characters
      const sanitizedUrl = sanitizeUrl(serverUrl);

      // If the URL changed after sanitization, update the state and localStorage
      if (sanitizedUrl !== serverUrl) {
        console.log(`Sanitized server URL from "${serverUrl}" to "${sanitizedUrl}"`);
        setServerUrl(sanitizedUrl);
        localStorage.setItem("tagify:localServerUrl", sanitizedUrl);
      }

      // Add a timeout to the fetch requests to avoid long hangs
      const timeout = 8000; // 8 seconds timeout

      // Function to create a promise that rejects after a timeout
      const fetchWithTimeout = async (
        url: string,
        options: RequestInit = {}
      ): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error instanceof Error ? error : new Error(`Request to ${url} failed`);
        }
      };

      // Check if server is running
      const statusResponse = await fetchWithTimeout(`${sanitizedUrl}/status`);
      if (!statusResponse.ok) {
        throw new Error(`Server status check failed: ${statusResponse.statusText}`);
      }

      const statusData = await statusResponse.json();
      console.log("Server status:", statusData);
      setServerConnected(true);

      // Get the actual cache data
      const response = await fetchWithTimeout(sanitizedUrl);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: LocalTracksCache = await response.json();

      // Convert to a Map for faster lookups by track_id
      const tracksMap = new Map<string, CacheTrack>();
      data.tracks.forEach((track) => {
        if (track.track_id) {
          // Only add tracks with a valid track_id
          tracksMap.set(track.track_id, track);
        }
      });

      setLocalTracks(tracksMap);
      console.log(
        `Loaded ${tracksMap.size} local tracks from cache (${data.tracks.length} total tracks)`
      );

      return tracksMap;
    } catch (error) {
      console.error("Error loading local tracks cache:", error);
      setServerConnected(false);
      throw error; // Re-throw to handle in the calling function
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

  // Check the cache and load data if needed
  useEffect(() => {
    // First, check if the server URL needs to be sanitized
    const savedServerUrl = localStorage.getItem("tagify:localServerUrl");
    if (savedServerUrl) {
      const sanitizedUrl = sanitizeUrl(savedServerUrl);
      if (sanitizedUrl !== savedServerUrl) {
        // The URL was malformed, update it
        console.log(`Sanitized saved server URL from "${savedServerUrl}" to "${sanitizedUrl}"`);
        localStorage.setItem("tagify:localServerUrl", sanitizedUrl);
        setServerUrl(sanitizedUrl);
      } else {
        setServerUrl(savedServerUrl);
      }
    }

    if (isCacheValid() && cachedData) {
      // Use the cached data
      console.log("Using cached missing tracks data");
      setMasterTracks(cachedData.masterTracks);
      setMissingTracks(cachedData.missingTracks);
      setIsLoading(false);

      // Still try to connect to the server in the background
      loadLocalTracksCache()
        .then((tracksMap) => {
          // If the local tracks count changed significantly, trigger a refresh
          const significantChange = Math.abs(tracksMap.size - cachedData.localTracksCount) > 5;
          if (significantChange) {
            console.log("Local tracks collection has changed significantly, refreshing data");
            loadData(true);
          }
        })
        .catch((err) => {
          console.warn("Failed to connect to local tracks server in background", err);
          // Don't show an error message here since we're using cached data
          // Just set serverConnected to false
          setServerConnected(false);
        });
    } else {
      // Load fresh data
      loadData();
    }
  }, []);

  // Load all data
  const loadData = async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      // Load from cache first
      const savedServerUrl = localStorage.getItem("tagify:localServerUrl");
      if (savedServerUrl) {
        setServerUrl(savedServerUrl);
      }

      let tracksMap;
      try {
        tracksMap = await loadLocalTracksCache();
      } catch (e) {
        console.error("Failed to connect to local tracks server:", e);

        // If we have cached data and this is a server connection failure, we can use the cached data
        if (cachedData && !silent) {
          setError(
            "Could not connect to local tracks server. Using cached data from " +
              new Date(cachedData.lastUpdated).toLocaleString()
          );
          setMasterTracks(cachedData.masterTracks);
          setMissingTracks(cachedData.missingTracks);
          setIsLoading(false);
          return;
        } else {
          // If no cached data, show the config input
          setShowConfigInput(true);
          setError(
            "Failed to connect to local tracks server. Please check your connection and server settings."
          );
          setIsLoading(false);
          return;
        }
      }

      if (tracksMap.size === 0) {
        setShowConfigInput(true);
        if (!silent) {
          setIsLoading(false);
        }
        return;
      }

      let tracks;
      try {
        tracks = (await loadMasterTracks()) || [];
      } catch (e) {
        console.error("Failed to load master tracks:", e);

        // If we have cached data, we can still use it
        if (cachedData && !silent) {
          setError(
            "Could not load MASTER playlist. Using cached data from " +
              new Date(cachedData.lastUpdated).toLocaleString()
          );
          setMasterTracks(cachedData.masterTracks);
          setMissingTracks(cachedData.missingTracks);
          setIsLoading(false);
          return;
        } else {
          // No cached data, show error
          setError("Failed to load MASTER playlist. Please check your playlist ID and try again.");
          setIsLoading(false);
          return;
        }
      }

      const playlistId = localStorage.getItem("tagify:masterPlaylistId");

      if (tracks && tracks.length > 0 && tracksMap.size > 0) {
        const missingTracksList = findMissingTracks(tracks, tracksMap);

        // Update the cache
        const newCachedData: CachedMissingTracksData = {
          masterTracks: tracks,
          missingTracks: missingTracksList,
          localTracksCount: tracksMap.size,
          lastUpdated: Date.now(),
          playlistId: playlistId,
        };

        setCachedData(newCachedData);
        setForceRefresh(false);
      } else {
        // Set empty missing tracks if we don't have both data sources
        setMissingTracks([]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      if (!silent) {
        // Check if we have cached data to fall back on
        if (cachedData) {
          setError(
            "An error occurred. Using cached data from " +
              new Date(cachedData.lastUpdated).toLocaleString()
          );
          setMasterTracks(cachedData.masterTracks);
          setMissingTracks(cachedData.missingTracks);
        } else {
          setError("An error occurred while loading data. See console for details.");
        }
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  // Manually refresh data
  const refreshData = () => {
    setForceRefresh(true);
    loadData();
  };

  // Connect to server with new URL
  const connectToServer = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Sanitize the URL before saving
      const sanitizedUrl = sanitizeUrl(serverUrl);
      if (sanitizedUrl !== serverUrl) {
        setServerUrl(sanitizedUrl);
      }

      // Save server URL to localStorage - use the sanitized version
      localStorage.setItem("tagify:localServerUrl", sanitizedUrl);

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
      // Force refresh when playlist changes
      setForceRefresh(true);
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
    loadData: refreshData, // Expose refreshData as loadData for interface compatibility
    connectToServer,
    setMasterPlaylistId,
    createPlaylist,
    cachedData: cachedData
      ? {
          lastUpdated: new Date(cachedData.lastUpdated).toLocaleString(),
          tracksCount: cachedData.masterTracks.length,
          missingCount: cachedData.missingTracks.length,
          localCount: cachedData.localTracksCount,
        }
      : null,
  };
}
