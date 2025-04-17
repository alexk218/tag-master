import React, { useState, useEffect } from "react";
import styles from "./app.module.css";
import TrackDetails from "./components/TrackDetails";
import TagSelector from "./components/TagSelector";
import TrackList from "./components/TrackList";
import TagManager from "./components/TagManager";
import ExportPanel from "./components/ExportPanel";
import DataManager from "./components/DataManager";
import { useTagData } from "./hooks/useTagData";
import { TagDataStructure } from "./hooks/useTagData";

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
      // Check if we have a valid player data and item
      if (!Spicetify?.Player?.data?.item) return;
      
      const item = Spicetify.Player.data.item;
      
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

    Object.entries(tagData.tracks).forEach(([uri, track]) => {
      result[uri] = {
        rating: track.rating,
        energy: track.energy,
        tags: track.tags.map(tag => {
          // Find tag name
          const category = tagData.categories.find(c => c.id === tag.categoryId);
          if (!category) return { tag: "Unknown", category: "Unknown" };
          
          const subcategory = category.subcategories.find(s => s.id === tag.subcategoryId);
          if (!subcategory) return { tag: "Unknown", category: category.name };
          
          const tagItem = subcategory.tags.find(t => t.id === tag.tagId);
          if (!tagItem) return { tag: "Unknown", category: `${category.name} > ${subcategory.name}` };
          
          return { 
            tag: tagItem.name, 
            category: `${category.name} > ${subcategory.name}` 
          };
        })
      };
    });

    return result;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>TagMaster</h1>
        <div className={styles.actions}>
          <button
            onClick={() => setShowExport(true)}
            className={styles.actionButton}
          >
            Export for Rekordbox
          </button>
          <button
            onClick={() => setShowTagManager(true)}
            className={styles.actionButton}
          >
            Manage Tags
          </button>
        </div>
      </div>

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

        {/* Tag selector */}
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

      {/* Tag manager modal */}
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

      {/* Export modal */}
      {showExport && (
        <ExportPanel
          data={exportData()}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};

export default App;