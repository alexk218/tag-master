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

  // State for UI
  const [showTagManager, setShowTagManager] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Listen for track changes
  useEffect(() => {
    // Function to update current track based on Spicetify API
    const updateCurrentTrack = () => {
      // Check if we have a valid player data
      if (!Spicetify?.Player?.data) return;

      // The actual runtime structure might differ from type definitions
      // We'll handle both possibilities
      const item = Spicetify.Player.data.item || Spicetify.Player.data.track;

      if (!item) {
        console.warn("Could not find track data in Spicetify.Player.data");
        return;
      }

      // Map the data to our expected format
      setCurrentTrack({
        uri: item.uri,
        name: item.name || "Unknown Track",
        artists: item.artists || [{ name: "Unknown Artist" }],
        album: item.album || { name: "Unknown Album" },
        duration_ms: typeof item.duration === 'number' ? item.duration : 0
      });
    };

    // Set up event listener
    Spicetify.Player.addEventListener("songchange", updateCurrentTrack);

    // Initial track check
    updateCurrentTrack();

    // Clean up on unmount
    return () => {
      Spicetify.Player.removeEventListener("songchange", updateCurrentTrack);
    };
  }, []);

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

        // Create entry for this track
        result[uri] = {
          rating: track.rating || 0,
          energy: track.energy || 5,
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

      // Log the result for debugging
      console.log("Formatted tracks for TrackList:", result);
      console.log("Track count:", Object.keys(result).length);

      return result;
    } catch (error) {
      console.error("Error formatting track data:", error);
      return {}; // Return empty object on error
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>TagMaster</h1>
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
            {/* Current track details and metadata editor */}
            {currentTrack && (
              <TrackDetails
                track={currentTrack}
                trackData={tagData.tracks[currentTrack.uri] || { rating: 0, energy: 5, tags: [] }}
                categories={tagData.categories}
                onSetRating={(rating) => setRating(currentTrack.uri, rating)}
                onSetEnergy={(energy) => setEnergy(currentTrack.uri, energy)}
                onRemoveTag={(categoryId, subcategoryId, tagId) =>
                  toggleTrackTag(currentTrack.uri, categoryId, subcategoryId, tagId)
                }
              />
            )}

            {/* Hierarchical tag selector */}
            {currentTrack && (
              <TagSelector
                track={currentTrack}
                categories={tagData.categories}
                trackTags={tagData.tracks[currentTrack.uri]?.tags || []}
                onToggleTag={(categoryId, subcategoryId, tagId) =>
                  toggleTrackTag(currentTrack.uri, categoryId, subcategoryId, tagId)
                }
                onOpenTagManager={() => setShowTagManager(true)}
              />
            )}

            {/* List of tagged tracks */}
            <TrackList
              tracks={getLegacyFormatTracks()}
              onSelectTrack={(uri) => {
                if (Spicetify.Player && Spicetify.Player.playUri) {
                  Spicetify.Player.playUri(uri);
                }
              }}
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