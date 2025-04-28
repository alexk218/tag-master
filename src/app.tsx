import React, { useState, useEffect } from "react";
import styles from "./app.module.css";
import TrackDetails from "./components/TrackDetails";
import TagSelector from "./components/TagSelector";
import TrackList from "./components/TrackList";
import TagManager from "./components/TagManager";
import ExportPanel from "./components/ExportPanel";
import DataManager from "./components/DataManager";
import { TrackTag, useTagData } from "./hooks/useTagData";
import { parseLocalFileUri } from "./utils/LocalFileParser";
import LocalTracksModal from "./components/LocalTracksModal";
import { checkAndUpdateCacheIfNeeded } from "./utils/PlaylistCache";
import MultiTrackDetails from "./components/MultiTrackDetails";

interface SpicetifyHistoryLocation {
  pathname: string;
  search?: string;
  state?: {
    trackUri?: string;
    trackUris?: string[];
    [key: string]: any;
  };
}

interface SpotifyTrack {
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { name: string };
  duration_ms: number;
}

// Constants for localStorage keys
const LOCK_STATE_KEY = "tagify:lockState";
const LOCKED_TRACK_KEY = "tagify:lockedTrack";

const App: React.FC = () => {
  // Get tag data management functions from our custom hook
  const {
    tagData,
    lastSaved,
    isLoading,
    toggleTrackTag,
    setRating,
    setEnergy,
    setBpm,
    toggleTagForMultipleTracks,
    addCategory,
    removeCategory,
    renameCategory,
    addSubcategory,
    removeSubcategory,
    renameSubcategory,
    addTag,
    removeTag,
    renameTag,
    exportData,
    exportBackup,
    importBackup,
    backfillBPMData,
  } = useTagData();

  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [excludedTagFilters, setExcludedTagFilters] = useState<string[]>([]);
  const [lockedTrack, setLockedTrack] = useState<SpotifyTrack | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [showLocalTracksModal, setShowLocalTracksModal] = useState(false);
  const [localTracksForPlaylist, setLocalTracksForPlaylist] = useState<string[]>([]);
  const [createdPlaylistInfo, setCreatedPlaylistInfo] = useState<{
    name: string;
    id: string | null;
  }>({ name: "", id: null });

  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<SpotifyTrack[]>([]);
  const [isMultiTagging, setIsMultiTagging] = useState(false);
  const [lockedMultiTrackUri, setLockedMultiTrackUri] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem("tagify:filterState");
      if (savedFilters) {
        const filters = JSON.parse(savedFilters);

        // Only set the tag filters if they exist in the saved state
        if (filters.activeTagFilters && Array.isArray(filters.activeTagFilters)) {
          setActiveTagFilters(filters.activeTagFilters);
        }

        if (filters.excludedTagFilters && Array.isArray(filters.excludedTagFilters)) {
          setExcludedTagFilters(filters.excludedTagFilters);
        }
      }
    } catch (error) {
      console.error("Error loading tag filters from localStorage:", error);
    }
  }, []);

  useEffect(() => {
    if (!document.getElementById("font-awesome-css")) {
      const link = document.createElement("link");
      link.id = "font-awesome-css";
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css";
      document.head.appendChild(link);
    }
  }, []);

  // Load saved lock state and locked track on initial render
  useEffect(() => {
    try {
      const savedLockState = localStorage.getItem(LOCK_STATE_KEY);
      const savedLockedTrack = localStorage.getItem(LOCKED_TRACK_KEY);

      if (savedLockState === "true" && savedLockedTrack) {
        setIsLocked(true);
        setLockedTrack(JSON.parse(savedLockedTrack));
        console.log("Tagify: Restored locked state for track", JSON.parse(savedLockedTrack).name);
      }
    } catch (error) {
      console.error("Tagify: Error loading saved lock state:", error);
    } finally {
      // Mark storage as loaded, even if there was an error
      setIsStorageLoaded(true);
    }
  }, []);

  useEffect(() => {
    checkAndUpdateCacheIfNeeded().catch((error) => {
      console.error("Error checking/updating playlist cache:", error);
    });
  }, []);

  // Save lock state and locked track whenever they change
  useEffect(() => {
    if (isLocked && lockedTrack) {
      localStorage.setItem(LOCK_STATE_KEY, "true");
      localStorage.setItem(LOCKED_TRACK_KEY, JSON.stringify(lockedTrack));
    } else {
      localStorage.removeItem(LOCK_STATE_KEY);
      localStorage.removeItem(LOCKED_TRACK_KEY);
    }
  }, [isLocked, lockedTrack]);

  // The active track is either the locked track (if we're locked) or the current playing track
  const activeTrack = isLocked && lockedTrack ? lockedTrack : currentTrack;

  // Listen for track changes
  useEffect(() => {
    // Only set up the listener if storage has been loaded
    if (!isStorageLoaded) {
      console.log("Tagify: Waiting for localStorage to load before setting up player listener");
      return;
    }

    // Function to update current track based on Spicetify API
    const updateCurrentTrack = () => {
      // Check if we have a valid player data
      if (!Spicetify?.Player?.data) return;

      try {
        // Try to get the track data
        let trackData = null;

        // First try 'track' property which is the most common
        if (Spicetify.Player.data.track) {
          trackData = Spicetify.Player.data.track;
        }
        // Then try 'item' property which might be present in some versions
        else if ((Spicetify.Player.data as any).item) {
          trackData = (Spicetify.Player.data as any).item;
        }

        if (!trackData) {
          console.warn("Could not find track data in Spicetify.Player.data");
          return;
        }

        // Map the data to our expected format
        const newTrack: SpotifyTrack = {
          uri: trackData.uri,
          name: trackData.name || "Unknown Track",
          artists: trackData.artists || [{ name: "Unknown Artist" }],
          album: trackData.album || { name: "Unknown Album" },
          duration_ms: typeof trackData.duration === "number" ? trackData.duration : 0,
        };

        // ALWAYS update currentTrack to reflect what's playing in Spotify
        setCurrentTrack(newTrack);

        // ONLY update lockedTrack if we're NOT locked - don't touch lockedTrack when isLocked is true
        if (!isLocked) {
          console.log("Tagify: Updating lockedTrack because not locked:", newTrack.name);
          // Make sure to set both track objects to valid state
          const safeTrack = {
            ...newTrack,
            artists: newTrack.artists || [{ name: "Unknown Artist" }],
            album: newTrack.album || { name: "Unknown Album" },
            duration_ms: typeof newTrack.duration_ms === "number" ? newTrack.duration_ms : 0,
          };

          setLockedTrack(safeTrack);
        }
      } catch (error) {
        console.error("Error updating current track:", error);
      }
    };

    // Set up event listener
    Spicetify.Player.addEventListener("songchange", updateCurrentTrack);

    // Initial track check
    updateCurrentTrack();

    // Clean up on unmount
    return () => {
      Spicetify.Player.removeEventListener("songchange", updateCurrentTrack);
    };
  }, [isLocked, isStorageLoaded]);

  // Check for track URI in URL parameters
  useEffect(() => {
    // Define the track URI checker function
    const checkForTrackUris = async () => {
      // Get the current location and log it for debugging
      const currentLocation = Spicetify.Platform.History.location || window.location;
      console.log("Tagify: Current location:", currentLocation);

      // Try multiple ways to get the URI parameter (for single track)
      let trackUri = null;

      // Try from window.location.search
      const windowParams = new URLSearchParams(window.location.search);
      if (windowParams.has("uri")) {
        trackUri = windowParams.get("uri");
        console.log("Tagify: Found URI in window.location.search:", trackUri);
      }

      // Try from Spicetify.Platform.History.location if available
      if (!trackUri && Spicetify.Platform.History.location) {
        const location = Spicetify.Platform.History.location as SpicetifyHistoryLocation;
        const historyParams = new URLSearchParams(location.search);
        if (historyParams.has("uri")) {
          trackUri = historyParams.get("uri");
          console.log("Tagify: Found URI in History location search:", trackUri);
        }

        // Also check state
        if (!trackUri && location.state?.trackUri) {
          trackUri = location.state.trackUri;
          console.log("Tagify: Found URI in History state:", trackUri);
        }
      }

      // For multiple tracks - check for 'uris' parameter
      let trackUrisParam = null;

      // Try from window.location.search
      if (windowParams.has("uris")) {
        trackUrisParam = windowParams.get("uris");
        console.log("Tagify: Found URIs in window.location.search:", trackUrisParam);
      }

      // Try from Spicetify.Platform.History.location if available
      if (!trackUrisParam && Spicetify.Platform.History.location) {
        const location = Spicetify.Platform.History.location as SpicetifyHistoryLocation;
        const historyParams = new URLSearchParams(location.search);
        if (historyParams.has("uris")) {
          trackUrisParam = historyParams.get("uris");
          console.log("Tagify: Found URIs in History location search:", trackUrisParam);
        }

        // Also check state
        if (!trackUrisParam && location.state?.trackUris) {
          trackUrisParam = JSON.stringify(location.state.trackUris);
          console.log("Tagify: Found URIs in History state:", trackUrisParam);
        }
      }

      // SINGLE TRACK HANDLING
      if (trackUri) {
        console.log("Tagify: Processing track URI:", trackUri);

        try {
          // Check if this is a local file
          if (trackUri.startsWith("spotify:local:")) {
            // Use our dedicated parser to get better metadata
            const parsedFile = parseLocalFileUri(trackUri);

            // Create a track object for local files
            const trackInfo: SpotifyTrack = {
              uri: trackUri,
              name: parsedFile.title,
              artists: [{ name: parsedFile.artist }],
              album: { name: parsedFile.album },
              duration_ms: 0,
            };

            // Lock to this track
            setLockedTrack(trackInfo);
            setIsLocked(true);

            console.log("Set locked track to local file:", trackInfo);
            return;
          }

          // Extract the track ID from the URI
          const trackId = trackUri.split(":").pop();

          if (!trackId) {
            throw new Error("Invalid track URI");
          }

          // Fetch track info using Spicetify's Cosmos API
          const response = await Spicetify.CosmosAsync.get(
            `https://api.spotify.com/v1/tracks/${trackId}`
          );

          if (response) {
            // Format the track info
            const trackInfo: SpotifyTrack = {
              uri: trackUri,
              name: response.name,
              artists: response.artists.map((artist: any) => ({
                name: artist.name,
              })),
              album: { name: response.album?.name || "Unknown Album" },
              duration_ms: response.duration_ms,
            };

            console.log("Tagify: Setting locked track:", trackInfo.name);

            // Set as locked track and enable lock - IMPORTANT!
            setLockedTrack(trackInfo);
            setIsLocked(true);

            // Reset multi-tagging if active
            if (isMultiTagging) {
              setSelectedTracks([]);
              setIsMultiTagging(false);
            }
          }
        } catch (error) {
          console.error("Tagify: Error loading track from URI parameter:", error);
          Spicetify.showNotification("Error loading track for tagging", true);
        }
      }
      // MULTI-TRACK HANDLING
      else if (trackUrisParam) {
        try {
          // Parse the JSON array of URIs
          const trackUris = JSON.parse(decodeURIComponent(trackUrisParam));
          console.log("Tagify: Processing track URIs:", trackUris);

          if (!Array.isArray(trackUris) || trackUris.length === 0) {
            throw new Error("Invalid track URIs format");
          }

          // If there's only one track, handle it as a single track
          if (trackUris.length === 1) {
            // Use the format that works with your Spicetify version
            Spicetify.Platform.History.push(`/tagify?uri=${encodeURIComponent(trackUris[0])}`);
            return;
          }

          // Multiple tracks case
          const fetchedTracks: SpotifyTrack[] = [];

          // Process tracks in batches
          for (const uri of trackUris) {
            // Handle local files
            if (uri.startsWith("spotify:local:")) {
              const parsedFile = parseLocalFileUri(uri);
              fetchedTracks.push({
                uri,
                name: parsedFile.title,
                artists: [{ name: parsedFile.artist }],
                album: { name: parsedFile.album },
                duration_ms: 0,
              });
              continue;
            }

            // For Spotify tracks
            try {
              const trackId = uri.split(":").pop();
              if (!trackId) continue;

              const response = await Spicetify.CosmosAsync.get(
                `https://api.spotify.com/v1/tracks/${trackId}`
              );

              if (response) {
                fetchedTracks.push({
                  uri,
                  name: response.name,
                  artists: response.artists.map((artist: any) => ({
                    name: artist.name,
                  })),
                  album: { name: response.album?.name || "Unknown Album" },
                  duration_ms: response.duration_ms,
                });
              }
            } catch (error) {
              console.error(`Tagify: Error fetching track ${uri}:`, error);
            }
          }

          if (fetchedTracks.length > 0) {
            console.log(
              `Tagify: Successfully fetched ${fetchedTracks.length} tracks for mass tagging`
            );
            setSelectedTracks(fetchedTracks);
            setIsMultiTagging(true);

            // Unlock when mass tagging
            setIsLocked(false);
          }
        } catch (error) {
          console.error("Tagify: Error processing track URIs:", error);
          Spicetify.showNotification("Error loading tracks for tagging", true);
        }
      }
    };

    // Run the check immediately when component mounts
    checkForTrackUris();

    // Set up better history listener
    let unlisten: (() => void) | null = null;

    // Before setting up the listener, check if there's a proper listen method available
    if (
      Spicetify.Platform &&
      Spicetify.Platform.History &&
      typeof Spicetify.Platform.History.listen === "function"
    ) {
      console.log("Tagify: Setting up history listener");

      try {
        // Try to set up the listener and get the unlisten function
        const unlistenFunc = Spicetify.Platform.History.listen((location: any) => {
          console.log("Tagify: History changed:", location);
          checkForTrackUris();
        });

        // Check if the returned value is a function (as it should be)
        if (typeof unlistenFunc === "function") {
          unlisten = unlistenFunc;
        } else {
          console.warn("Tagify: History.listen did not return a cleanup function");
          // Create a fallback cleanup function if needed
          unlisten = () => {
            // Try to remove the listener using an alternative method if available
            // This is a placeholder - you might need specific logic based on Spicetify's API
            console.log("Tagify: Using fallback cleanup for history listener");
          };
        }
      } catch (error) {
        console.error("Tagify: Error setting up history listener:", error);
      }
    }

    // Cleanup listener on unmount
    return () => {
      if (unlisten) {
        console.log("Tagify: Cleaning up history listener");
        unlisten();
      }
    };
  }, [isMultiTagging]);

  const findCommonTags = (trackUris: string[]): TrackTag[] => {
    if (trackUris.length === 0) return [];

    // Get tags from the first track
    const firstTrackTags = tagData.tracks[trackUris[0]]?.tags || [];

    if (trackUris.length === 1) return firstTrackTags;

    // Check which tags exist in all tracks
    return firstTrackTags.filter((tag) => {
      return trackUris.every((uri) => {
        const trackTags = tagData.tracks[uri]?.tags || [];
        return trackTags.some(
          (t) =>
            t.categoryId === tag.categoryId &&
            t.subcategoryId === tag.subcategoryId &&
            t.tagId === tag.tagId
        );
      });
    });
  };

  const playTrackViaQueue = (uri: string): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        console.log("Playing track via queue:", uri);

        // Format for queue API - same for both local and Spotify tracks
        const trackObject = [{ uri }];

        // Check if Player is currently playing music
        const isPlaying = Spicetify.Player.isPlaying();

        // Always use queue approach to preserve existing queue
        Spicetify.addToQueue(trackObject)
          .then(() => {
            // Need to wait a moment for queue to update
            setTimeout(() => {
              // If we're already playing something, skip to next track (which is our newly added track)
              if (isPlaying) {
                Spicetify.Player.next();
              } else {
                // If nothing is playing, we need to start playback
                Spicetify.Player.play();
              }
              resolve(true);
            }, 300);
          })
          .catch((err) => {
            console.error("Failed to add to queue:", err);

            // Special handling for local files that failed
            if (uri.startsWith("spotify:local:")) {
              // Navigate to Local Files as fallback
              Spicetify.Platform.History.push("/collection/local-files");
              Spicetify.showNotification(
                "Local files must be played from Local Files section",
                true
              );
            } else {
              // For Spotify tracks, try direct playback as fallback (will clear queue)
              console.warn("Falling back to direct playback (will clear queue)");
              Spicetify.Player.playUri(uri)
                .then(() => resolve(true))
                .catch((innerErr) => {
                  console.error("Failed direct playback fallback:", innerErr);
                  resolve(false);
                });
            }
            resolve(false);
          });
      } catch (error) {
        console.error("Error in playTrackViaQueue:", error);
        resolve(false);
      }
    });
  };

  const toggleTagForSingleTrack = (
    trackUri: string,
    categoryId: string,
    subcategoryId: string,
    tagId: string
  ) => {
    // This is simpler than the all-tracks version since we're only modifying one track
    toggleTrackTag(trackUri, categoryId, subcategoryId, tagId);
  };

  const toggleTagForAllTracks = (categoryId: string, subcategoryId: string, tagId: string) => {
    // Use the new batch update function instead of calling toggleTrackTag for each track
    toggleTagForMultipleTracks(
      selectedTracks.map((track) => track.uri),
      categoryId,
      subcategoryId,
      tagId
    );
  };

  const cancelMultiTagging = () => {
    // Clear the multi-tagging states
    setSelectedTracks([]);
    setIsMultiTagging(false);
    setLockedMultiTrackUri(null);

    // If there's no active track to show but we have a current track,
    // set it as the locked track
    if (!activeTrack && currentTrack) {
      setLockedTrack(currentTrack);
      setIsLocked(true);
    }

    // Clear any URL parameters to avoid getting back into multi-tagging mode
    // when the URL is processed again
    Spicetify.Platform.History.push("/tagify");
  };

  const handleRemoveFilter = (tag: string) => {
    // Remove from active filters if it's there
    if (activeTagFilters.includes(tag)) {
      setActiveTagFilters((prev) => prev.filter((t) => t !== tag));
    }
    // Remove from excluded filters if it's there
    else if (excludedTagFilters.includes(tag)) {
      setExcludedTagFilters((prev) => prev.filter((t) => t !== tag));
    }
  };

  const handleToggleFilterType = (tag: string, isExcluded: boolean) => {
    if (isExcluded) {
      // If excluded, move to included
      setExcludedTagFilters((prev) => prev.filter((t) => t !== tag));
      setActiveTagFilters((prev) => [...prev, tag]);
    } else {
      // If included, move to excluded
      setActiveTagFilters((prev) => prev.filter((t) => t !== tag));
      setExcludedTagFilters((prev) => [...prev, tag]);
    }
  };

  const onFilterByTag = (tag: string) => {
    if (activeTagFilters.includes(tag)) {
      // Move from INCLUDE to EXCLUDE
      setActiveTagFilters((prev) => prev.filter((t) => t !== tag));
      setExcludedTagFilters((prev) => [...prev, tag]);
    } else if (excludedTagFilters.includes(tag)) {
      // Move from EXCLUDE to OFF
      setExcludedTagFilters((prev) => prev.filter((t) => t !== tag));
    } else {
      // Move from OFF to INCLUDE
      setActiveTagFilters((prev) => [...prev, tag]);
    }
  };

  // Toggle tags between ON/OFF - no EXCLUDE
  const onFilterByTagOnOff = (tag: string) => {
    if (activeTagFilters.includes(tag)) {
      // Just remove from active filters (OFF)
      setActiveTagFilters((prev) => prev.filter((t) => t !== tag));
    } else if (excludedTagFilters.includes(tag)) {
      // Move from excluded to active (INCLUDE)
      setExcludedTagFilters((prev) => prev.filter((t) => t !== tag));
      setActiveTagFilters((prev) => [...prev, tag]);
    } else {
      // Add to active filters (INCLUDE)
      setActiveTagFilters((prev) => [...prev, tag]);
    }
  };

  // Function to handle locking/unlocking the track
  const toggleLock = () => {
    if (isLocked) {
      // When unlocking, update the locked track to the current track
      setLockedTrack(currentTrack);
      setIsLocked(false);
    } else {
      // When locking, use current locked track (which should be current track)
      setIsLocked(true);
    }
  };

  const clearTagFilters = () => {
    setActiveTagFilters([]);
    setExcludedTagFilters([]);
  };

  // Function to handle a track selected from TrackList for tagging
  const handleTagTrack = async (uri: string) => {
    try {
      // Check if this is a local file
      if (uri.startsWith("spotify:local:")) {
        // Use our dedicated parser to get better metadata
        const parsedFile = parseLocalFileUri(uri);

        // Create a track object for local files
        const trackInfo: SpotifyTrack = {
          uri: uri,
          name: parsedFile.title,
          artists: [{ name: parsedFile.artist }],
          album: { name: parsedFile.album },
          duration_ms: 0,
        };

        // Lock to this track
        setLockedTrack(trackInfo);
        setIsLocked(true);

        console.log("Set locked track to local file:", trackInfo);
        return;
      }

      // For Spotify tracks, extract the ID from the URI
      const trackId = uri.split(":").pop();

      if (!trackId) {
        throw new Error("Invalid track URI");
      }

      // Fetch track info from Spotify API
      const response = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/tracks/${trackId}`
      );

      if (response) {
        // Format the track info to our needed structure
        const trackInfo: SpotifyTrack = {
          uri: uri,
          name: response.name,
          artists: response.artists.map((artist: any) => ({
            name: artist.name,
          })),
          album: { name: response.album?.name || "Unknown Album" },
          duration_ms: response.duration_ms,
        };

        // Lock to this track
        setLockedTrack(trackInfo);
        setIsLocked(true);

        // This will trigger the useEffect that saves to localStorage
      }
    } catch (error) {
      console.error("Error loading track for tagging:", error);
      Spicetify.showNotification("Error loading track for tagging", true);
    }
  };

  const getLegacyFormatTracks = () => {
    const result: {
      [uri: string]: {
        rating: number;
        energy: number;
        bpm: number | null;
        tags: { tag: string; category: string }[];
      };
    } = {};

    try {
      // First check if we have valid tagData
      if (!tagData || typeof tagData !== "object") {
        console.error("TagData is invalid", tagData);
        return {};
      }

      // Check if categories exist and is an array
      if (!tagData.categories || !Array.isArray(tagData.categories)) {
        console.error("TagData is missing valid categories array", tagData.categories);
        return {}; // Return empty object to avoid further errors
      }

      // Check if tracks exist
      if (!tagData.tracks || typeof tagData.tracks !== "object") {
        console.error("TagData is missing valid tracks object", tagData.tracks);
        return {};
      }

      // Process each track
      Object.entries(tagData.tracks).forEach(([uri, track]) => {
        // Skip invalid tracks
        if (!track) return;

        // Skip tracks that have no meaningful data
        if (track.rating === 0 && track.energy === 0 && (!track.tags || track.tags.length === 0)) {
          return;
        }

        // Create entry for this track
        result[uri] = {
          rating: track.rating || 0,
          energy: track.energy || 0,
          bpm: track.bpm || null,
          tags: [],
        };

        // Skip if no tags
        if (!track.tags || !Array.isArray(track.tags) || track.tags.length === 0) {
          return;
        }

        // Process each tag
        track.tags.forEach((tag) => {
          // Find the tag info
          const category = tagData.categories.find((c) => c.id === tag.categoryId);
          if (!category) return;

          const subcategory = category.subcategories.find((s) => s.id === tag.subcategoryId);
          if (!subcategory) return;

          const tagObj = subcategory.tags.find((t) => t.id === tag.tagId);
          if (!tagObj) return;

          // Add the tag with proper names
          result[uri].tags.push({
            tag: tagObj.name,
            category: `${category.name} > ${subcategory.name}`,
          });
        });
      });

      return result;
    } catch (error) {
      console.error("Error formatting track data:", error);
      return {}; // Return empty object on error
    }
  };

  const createPlaylistFromFilters = async (
    trackUris: string[],
    playlistName: string,
    playlistDescription: string,
    isPublic: boolean
  ) => {
    if (trackUris.length === 0) {
      Spicetify.showNotification("No tracks to add to playlist", true);
      return;
    }

    try {
      // First, get the current user's profile to get the user ID
      const userProfile = await Spicetify.CosmosAsync.get("https://api.spotify.com/v1/me");
      const userId = userProfile.id;

      if (!userId) {
        throw new Error("Could not get user ID");
      }

      // Split tracks into Spotify tracks and local tracks
      const spotifyTrackUris = trackUris.filter((uri) => !uri.startsWith("spotify:local:"));
      const localTrackUris = trackUris.filter((uri) => uri.startsWith("spotify:local:"));

      // Check if we have any Spotify tracks to add
      if (spotifyTrackUris.length === 0 && localTrackUris.length > 0) {
        // If we only have local tracks, we need a different approach
        // First create an empty playlist
        const playlistResponse = await Spicetify.CosmosAsync.post(
          `https://api.spotify.com/v1/users/${userId}/playlists`,
          {
            name: playlistName,
            description: playlistDescription,
            public: isPublic,
          }
        );

        const playlistId = playlistResponse.id;

        if (!playlistId) {
          throw new Error("Failed to create playlist");
        }

        // Store the created playlist info and local tracks for the modal
        setCreatedPlaylistInfo({
          name: playlistName,
          id: playlistId,
        });
        setLocalTracksForPlaylist(localTrackUris);
        setShowLocalTracksModal(true);

        return;
      }

      // Create the playlist if we have Spotify tracks
      const playlistResponse = await Spicetify.CosmosAsync.post(
        `https://api.spotify.com/v1/users/${userId}/playlists`,
        {
          name: playlistName,
          description: playlistDescription,
          public: isPublic,
        }
      );

      const playlistId = playlistResponse.id;

      if (!playlistId) {
        throw new Error("Failed to create playlist");
      }

      // Add tracks to the playlist in batches of 100 (API limit)
      for (let i = 0; i < spotifyTrackUris.length; i += 100) {
        const batch = spotifyTrackUris.slice(i, Math.min(i + 100, spotifyTrackUris.length));
        await Spicetify.CosmosAsync.post(
          `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
          {
            uris: batch,
          }
        );
      }

      // Show different notifications based on whether we have local tracks or not
      if (localTrackUris.length > 0) {
        // Store the created playlist info and local tracks for the modal
        setCreatedPlaylistInfo({
          name: playlistName,
          id: playlistId,
        });
        setLocalTracksForPlaylist(localTrackUris);

        // Show notification about playlist creation success
        Spicetify.showNotification(
          `Created playlist "${playlistName}" with ${spotifyTrackUris.length} tracks. Local tracks need to be added manually.`,
          false,
          4000
        );

        // Show the modal with instructions for adding local tracks
        setShowLocalTracksModal(true);
      } else {
        // Simple success notification for Spotify-only playlists
        Spicetify.showNotification(
          `Created playlist "${playlistName}" with ${spotifyTrackUris.length} tracks.`
        );

        // Navigate to the newly created playlist
        Spicetify.Platform.History.push(`/playlist/${playlistId}`);
      }
    } catch (error) {
      console.error("Error creating playlist:", error);
      Spicetify.showNotification("Failed to create playlist. Please try again.", true);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Tagify</h1>

          {/* Moved track lock control below the title */}
          {activeTrack && (
            <div className={styles.trackLockControl}>
              <button
                className={`${styles.lockButton} ${isLocked ? styles.locked : styles.unlocked}`}
                onClick={toggleLock}
                title={isLocked ? "Unlock to follow currently playing track" : "Lock to this track"}
              >
                {isLocked ? "🔒" : "🔓"}
              </button>

              {isLocked && currentTrack && currentTrack.uri !== activeTrack.uri && (
                <button
                  className={styles.switchTrackButton}
                  onClick={() => {
                    setLockedTrack(currentTrack);
                  }}
                  title="Switch to currently playing track"
                >
                  <span className={styles.buttonIcon}></span> Switch to current
                </button>
              )}
            </div>
          )}
        </div>

        {/* Track info display when locked */}
        {isLocked && activeTrack && (
          <div className={styles.lockedTrackInfo}>
            Currently tagging: <span className={styles.lockedTrackName}>{activeTrack.name}</span> by{" "}
            <span className={styles.lockedTrackArtist}>
              {activeTrack.artists.map((a) => a.name).join(", ")}
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className={styles.loadingContainer}>
          <p className={styles.loadingText}>Loading tag data...</p>
        </div>
      ) : (
        <>
          <DataManager
            onExportBackup={exportBackup}
            onImportBackup={importBackup}
            onExportRekordbox={() => setShowExport(true)}
            lastSaved={lastSaved}
            taggedTracks={tagData.tracks}
            onBackfillBPM={backfillBPMData}
          />

          <div className={styles.content}>
            {isMultiTagging && selectedTracks.length > 0 ? (
              <MultiTrackDetails
                tracks={selectedTracks}
                trackTagsMap={Object.fromEntries(
                  selectedTracks.map((track) => [track.uri, tagData.tracks[track.uri]?.tags || []])
                )}
                categories={tagData.categories}
                onTagAllTracks={toggleTagForAllTracks}
                onTagSingleTrack={toggleTagForSingleTrack}
                onCancelTagging={cancelMultiTagging}
                onPlayTrack={(uri) => {
                  // Special handling for local files
                  if (uri.startsWith("spotify:local:")) {
                    // For local files, we should navigate to the Local Files section
                    // instead of trying to play directly
                    Spicetify.Platform.History.push("/collection/local-files");

                    // Show a notification to guide the user
                    Spicetify.showNotification(
                      "Local files can only be played from the Local Files section",
                      false,
                      3000
                    );
                    return;
                  }

                  // Check if music is currently playing
                  const isPlaying = Spicetify.Player.isPlaying();

                  if (isPlaying) {
                    try {
                      // Add track to top of queue
                      const trackObject = [{ uri }];

                      // Queue access approach that should work
                      const queue = Spicetify.Queue;

                      if (queue && queue.nextTracks && queue.nextTracks.length > 0) {
                        // Queue has tracks, try to insert our track at the beginning
                        Spicetify.addToQueue(trackObject)
                          .then(() => {
                            // Move our track from the end to the beginning of the queue
                            // This is a workaround since we can't directly insert at a specific position

                            // After adding to queue, play next
                            Spicetify.Player.next();
                          })
                          .catch((err) => {
                            console.error("Failed to add to queue", err);
                            Spicetify.showNotification(
                              "Unable to play track, playing directly",
                              true
                            );

                            // Fallback to direct play
                            Spicetify.Player.playUri(uri);
                          });
                      } else {
                        // Queue is empty, simply add to queue and skip
                        Spicetify.addToQueue(trackObject)
                          .then(() => {
                            Spicetify.Player.next();
                          })
                          .catch((err) => {
                            console.error("Failed to add to queue", err);
                            Spicetify.showNotification(
                              "Unable to play track, playing directly",
                              true
                            );

                            // Fallback to direct play
                            Spicetify.Player.playUri(uri);
                          });
                      }
                    } catch (error) {
                      console.error("Error manipulating queue:", error);
                      // Fallback to direct play
                      Spicetify.Player.playUri(uri);
                    }
                  } else {
                    // No music playing, just play the track directly
                    Spicetify.Player.playUri(uri);
                  }
                }}
                lockedTrackUri={lockedMultiTrackUri}
                onLockTrack={setLockedMultiTrackUri}
              />
            ) : (
              // TrackDetails for single track
              activeTrack && (
                <TrackDetails
                  track={activeTrack}
                  trackData={
                    tagData.tracks[activeTrack.uri] || {
                      rating: 0,
                      energy: 0,
                      bpm: null,
                      tags: [],
                    }
                  }
                  categories={tagData.categories}
                  activeTagFilters={activeTagFilters}
                  excludedTagFilters={excludedTagFilters}
                  onSetRating={(rating) => setRating(activeTrack.uri, rating)}
                  onSetEnergy={(energy) => setEnergy(activeTrack.uri, energy)}
                  onSetBpm={(bpm) => setBpm(activeTrack.uri, bpm)}
                  onRemoveTag={(categoryId, subcategoryId, tagId) =>
                    toggleTrackTag(activeTrack.uri, categoryId, subcategoryId, tagId)
                  }
                  onFilterByTagOnOff={onFilterByTagOnOff}
                  onFilterByTag={onFilterByTag}
                  onPlayTrack={(uri) => {
                    playTrackViaQueue(uri);
                  }}
                />
              )
            )}
            {/* TagSelector */}
            {(activeTrack || (isMultiTagging && selectedTracks.length > 0)) && (
              <TagSelector
                track={
                  // If in multi-tagging with locked track, show that track as current
                  isMultiTagging && lockedMultiTrackUri
                    ? selectedTracks.find((t) => t.uri === lockedMultiTrackUri) || selectedTracks[0]
                    : activeTrack || selectedTracks[0]
                }
                categories={tagData.categories}
                trackTags={
                  isMultiTagging
                    ? lockedMultiTrackUri
                      ? // If locked to a specific track, only show its tags
                        tagData.tracks[lockedMultiTrackUri]?.tags || []
                      : // Otherwise show common tags
                        findCommonTags(selectedTracks.map((track) => track.uri))
                    : tagData.tracks[activeTrack?.uri || ""]?.tags || []
                }
                onToggleTag={(categoryId, subcategoryId, tagId) =>
                  isMultiTagging
                    ? lockedMultiTrackUri
                      ? // If locked to a specific track, only toggle tags for that
                        toggleTagForSingleTrack(
                          lockedMultiTrackUri,
                          categoryId,
                          subcategoryId,
                          tagId
                        )
                      : // Otherwise toggle for all tracks
                        toggleTagForAllTracks(categoryId, subcategoryId, tagId)
                    : toggleTrackTag(activeTrack!.uri, categoryId, subcategoryId, tagId)
                }
                onOpenTagManager={() => setShowTagManager(true)}
                isMultiTagging={isMultiTagging}
                isLockedTrack={!!lockedMultiTrackUri}
              />
            )}

            {/* List of tagged tracks */}
            <TrackList
              tracks={getLegacyFormatTracks()}
              categories={tagData.categories}
              activeTagFilters={activeTagFilters}
              excludedTagFilters={excludedTagFilters}
              activeTrackUri={activeTrack?.uri || null}
              onFilterByTag={onFilterByTag}
              onRemoveFilter={handleRemoveFilter}
              onToggleFilterType={handleToggleFilterType}
              onTrackListTagClick={onFilterByTagOnOff}
              onClearTagFilters={clearTagFilters}
              onPlayTrack={(uri) => {
                playTrackViaQueue(uri);
              }}
              onTagTrack={handleTagTrack}
              onCreatePlaylist={createPlaylistFromFilters}
            />
          </div>

          {/* Hierarchical tag manager modal */}
          {showTagManager && (
            <TagManager
              categories={tagData.categories}
              onClose={() => setShowTagManager(false)}
              onAddCategory={addCategory}
              onRemoveCategory={removeCategory}
              onRenameCategory={renameCategory}
              onAddSubcategory={addSubcategory}
              onRemoveSubcategory={removeSubcategory}
              onRenameSubcategory={renameSubcategory}
              onAddTag={addTag}
              onRemoveTag={removeTag}
              onRenameTag={renameTag}
            />
          )}

          {/* Export panel for rekordbox */}
          {showExport && <ExportPanel data={exportData()} onClose={() => setShowExport(false)} />}
        </>
      )}
      {showLocalTracksModal && (
        <LocalTracksModal
          localTracks={localTracksForPlaylist}
          playlistName={createdPlaylistInfo.name}
          playlistId={createdPlaylistInfo.id}
          onClose={() => setShowLocalTracksModal(false)}
        />
      )}
    </div>
  );
};

export default App;
