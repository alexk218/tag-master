import React, { useState, useEffect } from "react";
import styles from "./app.module.css";
// Import  components that support hierarchical tags
import TrackDetails from "./components/TrackDetails";
import TagSelector from "./components/TagSelector";
import TrackList from "./components/TrackList";
import TagManager from "./components/TagManager";
import ExportPanel from "./components/ExportPanel";
import DataManager from "./components/DataManager";
// Use the  tag data hook for hierarchical structure
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

  // Legacy track data format for TrackList compatibility
  const getLegacyFormatTracks = () => {
    const result: {
      [uri: string]: {
        rating: number;
        energy: number;
        tags: { tag: string; category: string }[];
      };
    } = {};

    try {
      // First check if categories exist
      if (!tagData?.categories) {
        console.error("TagData is missing categories array");
        return {}; // Return empty object to avoid further errors
      }

      Object.entries(tagData?.tracks || {}).forEach(([uri, track]) => {
        // Create a place for this track in the result
        result[uri] = {
          rating: track?.rating || 0,
          energy: track?.energy || 5,
          tags: []
        };
        
        // Check if track has tags
        if (!track?.tags || !Array.isArray(track.tags)) {
          return; // Skip this track if it has no tags array
        }
        
        // Map each tag to the legacy format with careful null checking
        track.tags.forEach(tag => {
          if (!tag || !tag.categoryId || !tag.subcategoryId || !tag.tagId) {
            console.warn("Found invalid tag data:", tag);
            return; // Skip this tag
          }
          
          const category = tagData.categories?.find(c => c?.id === tag.categoryId);
          if (!category) {
            console.warn(`Could not find category with ID: ${tag.categoryId}`);
            return; // Skip this tag
          }
          
          const subcategory = category.subcategories?.find(s => s?.id === tag.subcategoryId);
          if (!subcategory) {
            console.warn(`Could not find subcategory with ID: ${tag.subcategoryId} in category ${category.name}`);
            return; // Skip this tag
          }
          
          const tagItem = subcategory.tags?.find(t => t?.id === tag.tagId);
          if (!tagItem) {
            console.warn(`Could not find tag with ID: ${tag.tagId} in subcategory ${subcategory.name}`);
            return; // Skip this tag
          }
          
          // Add the tag with proper names, not just IDs
          result[uri].tags.push({ 
            tag: tagItem.name, 
            category: `${category.name} > ${subcategory.name}` 
          });
        });
      });

      console.log("Formatted tracks for TrackList:", result);
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
        <div className={styles.actions}>
          <button
            onClick={() => setShowExport(true)}
            className={styles.actionButton}
            disabled={isLoading}
          >
            Export for Rekordbox
          </button>
          <button
            onClick={() => setShowTagManager(true)}
            className={styles.actionButton}
            disabled={isLoading}
          >
            Manage Tags
          </button>
        </div>
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

            {/*  hierarchical tag selector */}
            {currentTrack && (
              <TagSelector
                track={currentTrack}
                categories={tagData.categories}
                trackTags={tagData.tracks[currentTrack.uri]?.tags || []}
                onToggleTag={(categoryId, subcategoryId, tagId) => 
                  toggleTrackTag(currentTrack.uri, categoryId, subcategoryId, tagId)
                }
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

          {/*  export panel for Rekordbox */}
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