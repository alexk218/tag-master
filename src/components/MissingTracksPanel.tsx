import React, { useState, useEffect } from "react";
import {
  loadLocalTracksCache,
  createTrackIdMap,
  findMissingTracks,
  fetchMasterPlaylistTracks,
  MasterTrack,
} from "../utils/LocalTrackCache";
import { exportToCsv, getTimestampForFilename } from "../utils/ExportUtils";
import styles from "./MissingTracksPanel.module.css";

const CACHE_PATH_SETTING = "tagify:localTracksCachePath";
const DEFAULT_CACHE_PATH = "local_tracks_cache.json";

interface CacheInfo {
  generated: string;
  totalFiles: number;
  filesWithTrackId: number;
  musicDirectory: string;
}

const MissingTracksPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [missingTracks, setMissingTracks] = useState<MasterTrack[]>([]);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [cachePath, setCachePath] = useState<string>(() => {
    return localStorage.getItem(CACHE_PATH_SETTING) || DEFAULT_CACHE_PATH;
  });
  const [masterPlaylistId, setMasterPlaylistId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Load the missing tracks data
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        // Load the local tracks cache
        const cacheData = await loadLocalTracksCache(cachePath);
        setCacheInfo({
          generated: cacheData.generated,
          totalFiles: cacheData.total_files,
          filesWithTrackId: cacheData.files_with_track_id,
          musicDirectory: cacheData.music_directory,
        });

        // Create a map of track IDs to local track info
        const localTrackMap = createTrackIdMap(cacheData);

        // Fetch tracks from the Master playlist
        const masterTracks = await fetchMasterPlaylistTracks();
        if (masterTracks.length === 0) {
          throw new Error("Could not fetch tracks from Master playlist");
        }

        // Find tracks missing from local files
        const missing = findMissingTracks(masterTracks, localTrackMap);
        setMissingTracks(missing);
      } catch (err) {
        console.error("Error loading missing tracks:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [cachePath]);

  // Filter missing tracks based on search term
  const filteredTracks = searchTerm
    ? missingTracks.filter(
        (track) =>
          track.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          track.artists.toLowerCase().includes(searchTerm.toLowerCase()) ||
          track.album.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : missingTracks;

  // Save new cache path to localStorage
  const handleSaveCachePath = () => {
    localStorage.setItem(CACHE_PATH_SETTING, cachePath);
    setShowSettings(false);
    // Reload the data
    window.location.reload();
  };

  // Handle playing a track
  const handlePlayTrack = async (uri: string) => {
    try {
      await Spicetify.Player.playUri(uri);
    } catch (error) {
      console.error("Error playing track:", error);
      Spicetify.showNotification("Error playing track", true);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Missing Local Tracks</h2>

        <div className={styles.controls}>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Search missing tracks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <button
            className={styles.settingsButton}
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {showSettings && (
        <div className={styles.settingsPanel}>
          <h3>Settings</h3>
          <div className={styles.settingRow}>
            <label htmlFor="cachePath">Local Tracks Cache Path:</label>
            <input
              id="cachePath"
              type="text"
              value={cachePath}
              onChange={(e) => setCachePath(e.target.value)}
              className={styles.settingInput}
            />
          </div>
          <div className={styles.settingButtons}>
            <button className={styles.saveButton} onClick={handleSaveCachePath}>
              Save Settings
            </button>
            <button className={styles.cancelButton} onClick={() => setShowSettings(false)}>
              Cancel
            </button>
          </div>
          <div className={styles.settingHelp}>
            <p>
              The cache path should point to the JSON file generated by the{" "}
              <code>generate_local_tracks_cache.py</code> script.
            </p>
            <p>After changing settings, the page will reload to apply changes.</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading missing tracks...</p>
        </div>
      ) : error ? (
        <div className={styles.errorContainer}>
          <h3 className={styles.errorTitle}>Error</h3>
          <p className={styles.errorMessage}>{error}</p>
          <div className={styles.errorHelp}>
            <p>
              Make sure you have generated a local tracks cache file using the{" "}
              <code>generate_local_tracks_cache.py</code> script and the file is accessible.
            </p>
            <button className={styles.configButton} onClick={() => setShowSettings(true)}>
              Configure Cache Path
            </button>
          </div>
        </div>
      ) : (
        <>
          {cacheInfo && (
            <div className={styles.cacheInfo}>
              <p>
                Cache generated:{" "}
                <span className={styles.cacheDate}>
                  {new Date(cacheInfo.generated).toLocaleString()}
                </span>
              </p>
              <p>
                Local files:{" "}
                <span className={styles.cacheStats}>
                  {cacheInfo.filesWithTrackId} / {cacheInfo.totalFiles} have Spotify TrackIds
                </span>
              </p>
              <p>
                Missing tracks:{" "}
                <span className={styles.missingCount}>
                  {missingTracks.length} tracks from Master playlist not found locally
                </span>
              </p>
            </div>
          )}

          <div className={styles.trackListHeader}>
            <span className={styles.trackTitle}>Title</span>
            <span className={styles.trackArtist}>Artist</span>
            <span className={styles.trackAlbum}>Album</span>
            <span className={styles.trackActions}>Actions</span>
          </div>

          <div className={styles.trackList}>
            {filteredTracks.length === 0 ? (
              <div className={styles.emptyState}>
                {searchTerm ? (
                  <p>No tracks match your search</p>
                ) : missingTracks.length === 0 ? (
                  <p>No missing tracks! All your Master playlist tracks are in your local files.</p>
                ) : (
                  <p>No tracks to display</p>
                )}
              </div>
            ) : (
              filteredTracks.map((track) => (
                <div key={track.uri} className={styles.trackItem}>
                  <span className={styles.trackTitle}>{track.name}</span>
                  <span className={styles.trackArtist}>{track.artists}</span>
                  <span className={styles.trackAlbum}>{track.album}</span>
                  <div className={styles.trackActions}>
                    <button
                      className={styles.playButton}
                      onClick={() => handlePlayTrack(track.uri)}
                      title="Play this track"
                    >
                      Play
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {filteredTracks.length > 0 && (
            <div className={styles.exportSection}>
              <button
                className={styles.exportButton}
                onClick={() => {
                  // Format data for CSV export
                  const exportData = filteredTracks.map((track) => ({
                    Title: track.name,
                    Artist: track.artists,
                    Album: track.album,
                    TrackId: track.trackId,
                    SpotifyURI: track.uri,
                  }));

                  // Generate filename with timestamp
                  const timestamp = getTimestampForFilename();
                  const filename = `missing_tracks_${timestamp}.csv`;

                  // Export to CSV
                  exportToCsv(exportData, filename);

                  // Show notification
                  Spicetify.showNotification(`Exported ${exportData.length} tracks to CSV`);
                }}
              >
                Export to CSV
              </button>
              <p className={styles.exportHelp}>
                Export this list to help you identify which tracks to download
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MissingTracksPanel;
