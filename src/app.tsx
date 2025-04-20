import React, { useState, useEffect } from "react";
import styles from "./app.module.css";
// Import components that support hierarchical tags
import TrackDetails from "./components/TrackDetails";
import TagSelector from "./components/TagSelector";
import TrackList from "./components/TrackList";
import TagManager from "./components/TagManager";
import ExportPanel from "./components/ExportPanel";
import DataManager from "./components/DataManager";
// Use the tag data hook for hierarchical structure
import { useTagData } from "./hooks/useTagData";

interface SpotifyTrack {
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { name: string };
  duration_ms: number;
}

const App: React.FC = () => {
  // Get tag data management functions from our custom hook
  const {
    tagData,
    lastSaved,
    isLoading,
    toggleTrackTag,
    setRating,
    setEnergy,
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
    importBackup
  } = useTagData();

  // State for current track
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);

  // State for the locked track (the one we're currently editing regardless of what's playing)
  const [lockedTrack, setLockedTrack] = useState<SpotifyTrack | null>(null);

  // State to track whether we're locked to a specific track
  const [isLocked, setIsLocked] = useState(false);

  // State for UI
  const [showTagManager, setShowTagManager] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // The active track is either the locked track (if we're locked) or the current playing track
  const activeTrack = isLocked && lockedTrack ? lockedTrack : currentTrack;

  // Listen for track changes
  useEffect(() => {
    // Function to update current track based on Spicetify API
    const updateCurrentTrack = () => {
      // Check if we have a valid player data
      if (!Spicetify?.Player?.data) return;

      try {
        // Try to get the track data - different Spicetify versions might have different structures
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
          duration_ms: typeof trackData.duration === 'number' ? trackData.duration : 0
        };

        setCurrentTrack(newTrack);

        // If we're not locked, also update the locked track to match the current track
        if (!isLocked) {
          setLockedTrack(newTrack);
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
  }, [isLocked]);

  // NEW: Check for track URI in URL parameters
  // Check for track URI in URL parameters
  useEffect(() => {
    // Define the track URI checker function
    const checkForTrackUri = async () => {
      // Get the current location and log it for debugging
      const currentLocation = Spicetify.Platform.History.location || window.location;
      console.log("TagMaster: Current location:", currentLocation);

      // Try multiple ways to get the URI parameter
      let trackUri = null;

      // Try from window.location.search
      const windowParams = new URLSearchParams(window.location.search);
      if (windowParams.has('uri')) {
        trackUri = windowParams.get('uri');
        console.log("TagMaster: Found URI in window.location.search:", trackUri);
      }

      // Try from Spicetify.Platform.History.location if available
      if (!trackUri && Spicetify.Platform.History.location) {
        const historyParams = new URLSearchParams(Spicetify.Platform.History.location.search);
        if (historyParams.has('uri')) {
          trackUri = historyParams.get('uri');
          console.log("TagMaster: Found URI in History location search:", trackUri);
        }

        // Also check state
        if (!trackUri && Spicetify.Platform.History.location.state?.trackUri) {
          trackUri = Spicetify.Platform.History.location.state.trackUri;
          console.log("TagMaster: Found URI in History state:", trackUri);
        }
      }

      if (trackUri) {
        console.log("TagMaster: Processing track URI:", trackUri);

        try {
          // Extract the track ID from the URI
          const trackId = trackUri.split(':').pop();

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
              artists: response.artists.map((artist: any) => ({ name: artist.name })),
              album: { name: response.album?.name || "Unknown Album" },
              duration_ms: response.duration_ms
            };

            console.log("TagMaster: Setting locked track:", trackInfo.name);

            // Set as locked track and enable lock - IMPORTANT!
            setLockedTrack(trackInfo);
            setIsLocked(true);

            // Show notification
            Spicetify.showNotification(`TagMaster: Tagging "${trackInfo.name}"`);
          }
        } catch (error) {
          console.error("TagMaster: Error loading track from URI parameter:", error);
          Spicetify.showNotification("Error loading track for tagging", true);
        }
      } else {
        console.log("TagMaster: No track URI found in URL");
      }
    };

    // Run the check immediately when component mounts
    checkForTrackUri();

    // Set up better history listener
    let unlisten: (() => void) | null = null;

    if (Spicetify.Platform && Spicetify.Platform.History) {
      console.log("TagMaster: Setting up history listener");

      unlisten = Spicetify.Platform.History.listen((location: any) => {
        console.log("TagMaster: History changed:", location);
        checkForTrackUri();
      });
    }

    // Cleanup listener on unmount
    return () => {
      if (unlisten) {
        console.log("TagMaster: Cleaning up history listener");
        unlisten();
      }
    };
  }, []);;

  // Function to handle locking/unlocking the track
  const toggleLock = () => {
    if (isLocked) {
      // When unlocking, update the locked track to the current track
      setLockedTrack(currentTrack);
    }
    setIsLocked(!isLocked);
  };

  // Function to handle a track selected from TracList for tagging
  const handleTagTrack = async (uri: string) => {
    try {
      // Extract the ID from the URI
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
          artists: response.artists.map((artist: any) => ({ name: artist.name })),
          album: { name: response.album?.name || "Unknown Album" },
          duration_ms: response.duration_ms
        };

        // Lock to this track
        setLockedTrack(trackInfo);
        setIsLocked(true);

        // Show notification to the user
        Spicetify.showNotification(`TagMaster: Tagging "${trackInfo.name}"`);
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
        tags: { tag: string; category: string }[];
      };
    } = {};

    try {
      // First check if we have valid tagData
      if (!tagData || typeof tagData !== 'object') {
        console.error("TagData is invalid", tagData);
        return {};
      }

      // Check if categories exist and is an array
      if (!tagData.categories || !Array.isArray(tagData.categories)) {
        console.error("TagData is missing valid categories array", tagData.categories);
        return {}; // Return empty object to avoid further errors
      }

      // Check if tracks exist
      if (!tagData.tracks || typeof tagData.tracks !== 'object') {
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
          energy: track.energy || 0,  // Don't default to 5 if energy is 0
          tags: []
        };

        // Skip if no tags
        if (!track.tags || !Array.isArray(track.tags) || track.tags.length === 0) {
          return;
        }

        // Process each tag
        track.tags.forEach(tag => {
          // Find the tag info
          const category = tagData.categories.find(c => c.id === tag.categoryId);
          if (!category) return;

          const subcategory = category.subcategories.find(s => s.id === tag.subcategoryId);
          if (!subcategory) return;

          const tagObj = subcategory.tags.find(t => t.id === tag.tagId);
          if (!tagObj) return;

          // Add the tag with proper names
          result[uri].tags.push({
            tag: tagObj.name,
            category: `${category.name} > ${subcategory.name}`
          });
        });
      });

      return result;
    } catch (error) {
      console.error("Error formatting track data:", error);
      return {}; // Return empty object on error
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>TagMaster</h1>

          {/* Moved track lock control below the title */}
          {activeTrack && (
            <div className={styles.trackLockControl}>
              <button
                className={`${styles.actionButton} ${isLocked ? styles.lockActive : ''}`}
                onClick={toggleLock}
                title={isLocked ? "Unlock to follow currently playing track" : "Lock to this track"}
              >
                {isLocked ? "🔒 Locked" : "🔓 Unlocked"}
              </button>
              {isLocked && currentTrack && currentTrack.uri !== activeTrack.uri && (
                <button
                  className={styles.actionButton}
                  onClick={() => {
                    setLockedTrack(currentTrack);
                  }}
                  title="Switch to currently playing track"
                >
                  Switch to current track
                </button>
              )}
            </div>
          )}
        </div>

        {/* Track info display when locked */}
        {isLocked && activeTrack && (
          <div className={styles.lockedTrackInfo}>
            Currently tagging: <span className={styles.lockedTrackName}>{activeTrack.name}</span> by <span className={styles.lockedTrackArtist}>{activeTrack.artists.map(a => a.name).join(', ')}</span>
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
          />

          <div className={styles.content}>
            {activeTrack && (
              <>
                <TrackDetails
                  track={activeTrack}
                  trackData={tagData.tracks[activeTrack.uri] || { rating: 0, energy: 0, tags: [] }}
                  categories={tagData.categories}
                  onSetRating={(rating) => setRating(activeTrack.uri, rating)}
                  onSetEnergy={(energy) => setEnergy(activeTrack.uri, energy)}
                  onRemoveTag={(categoryId, subcategoryId, tagId) =>
                    toggleTrackTag(activeTrack.uri, categoryId, subcategoryId, tagId)
                  }
                />

                <TagSelector
                  track={activeTrack}
                  categories={tagData.categories}
                  trackTags={tagData.tracks[activeTrack.uri]?.tags || []}
                  onToggleTag={(categoryId, subcategoryId, tagId) =>
                    toggleTrackTag(activeTrack.uri, categoryId, subcategoryId, tagId)
                  }
                  onOpenTagManager={() => setShowTagManager(true)}
                />
              </>
            )}

            {/* List of tagged tracks */}
            <TrackList
              tracks={getLegacyFormatTracks()}
              onSelectTrack={(uri) => {
                if (Spicetify.Player && Spicetify.Player.playUri) {
                  Spicetify.Player.playUri(uri);
                }
              }}
              onTagTrack={handleTagTrack}
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

          {/* Export panel for Rekordbox */}
          {showExport && (
            <ExportPanel
              data={exportData()}
              onClose={() => setShowExport(false)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default App;