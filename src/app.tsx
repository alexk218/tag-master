// src/app.tsx
import React, { useState, useEffect } from "react";
import styles from "./app.module.css";
import TagSelector from "./components/TagSelector";
import TrackDetails from "./components/TrackDetails";
import TrackList from "./components/TrackList";
import TagManager from "./components/TagManager";
import ExportPanel from "./components/ExportPanel";
import DataManager from "./components/DataManager";
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
    toggleTag,
    setRating,
    setEnergy,
    addTag,
    removeTag,
    addCategory,
    removeCategory,
    renameCategory,
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
    // Function to update current track based on correct Spicetify API
    const updateCurrentTrack = () => {
      // Check if we have a valid player data and item
      if (!Spicetify?.Player?.data?.item) return;
      
      const item = Spicetify.Player.data.item;
      
      // Map the data to our expected format
      setCurrentTrack({
        uri: item.uri,
        name: item.name || "Unknown Track",
        artists: Array.isArray(item.artists) 
          ? item.artists.map((artist) => ({ name: artist.name || "Unknown Artist" }))
          : [{ name: "Unknown Artist" }],
        album: item.album ? { name: item.album.name || "Unknown Album" } : { name: "Unknown Album" },
        duration_ms: typeof item.duration === 'object' && item.duration.milliseconds ? 
             item.duration.milliseconds : 
             (typeof item.duration === 'number' ? item.duration : 0)
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
            onSetRating={(rating) => setRating(currentTrack.uri, rating)}
            onSetEnergy={(energy) => setEnergy(currentTrack.uri, energy)}
            onRemoveTag={(tag, category) => removeTag(currentTrack.uri, tag, category)}
            tagCategories={tagData.tagCategories}
          />
        )}

        {/* Tag selector */}
        {currentTrack && (
          <TagSelector
            track={currentTrack}
            tagCategories={tagData.tagCategories}
            trackTags={(tagData.tracks[currentTrack.uri]?.tags || [])}
            onToggleTag={(tag, category) => toggleTag(currentTrack.uri, tag, category)}
          />
        )}

        {/* List of tagged tracks */}
        <TrackList
          tracks={tagData.tracks}
          onSelectTrack={(uri) => Spicetify.Player.playUri(uri)}
        />
      </div>

      {/* Tag manager modal */}
      {showTagManager && (
        <TagManager
          tagCategories={tagData.tagCategories}
          onClose={() => setShowTagManager(false)}
          onAddTag={addTag}
          onRemoveTag={removeTag} 
          onRenameTag={renameTag}
          onAddCategory={addCategory}
          onRemoveCategory={removeCategory}
          onRenameCategory={renameCategory}
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