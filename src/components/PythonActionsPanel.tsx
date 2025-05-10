import React, { useState, useEffect } from "react";
import styles from "./PythonActionsPanel.module.css";

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

interface ActionInfo {
  name: string;
  data: any;
}

const ActionButton: React.FC<ActionButtonProps> = ({ label, onClick, disabled, className }) => (
  <button
    className={`${styles.actionButton} ${className || ""}`}
    onClick={onClick}
    disabled={disabled}
  >
    {label}
  </button>
);

const PythonActionsPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<
    Record<string, { success: boolean; message: string } | null>
  >({});
  const [serverUrl, setServerUrl] = useState(() => {
    const savedUrl = localStorage.getItem("tagify:localServerUrl");
    if (savedUrl) {
      // Remove any extra quotes that might have been added
      return savedUrl.replace(/^["'](.*)["']$/, "$1");
    }
    return "http://localhost:8765";
  });
  const [masterPlaylistId, setMasterPlaylistId] = useState(
    () => localStorage.getItem("tagify:masterPlaylistId") || ""
  );
  const [serverStatus, setServerStatus] = useState<"unknown" | "connected" | "disconnected">(
    "unknown"
  );

  // Paths from localStorage or default values
  const [paths, setPaths] = useState({
    masterTracksDir: localStorage.getItem("tagify:masterTracksDir") || "",
    playlistsDir: localStorage.getItem("tagify:playlistsDir") || "",
    cacheDir: localStorage.getItem("tagify:cacheDir") || "",
  });

  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionInfo | null>(null);

  // Check server connection on load and when serverUrl changes
  useEffect(() => {
    checkServerConnection();
  }, [serverUrl]);

  const checkServerConnection = async () => {
    try {
      const response = await fetch(`${serverUrl}/status`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        setServerStatus("connected");
        // Get environment variables from server
        const data = await response.json();
        if (data.env_vars) {
          if (data.env_vars.MASTER_TRACKS_DIRECTORY_SSD && !paths.masterTracksDir) {
            setPaths((prev) => ({
              ...prev,
              masterTracksDir: data.env_vars.MASTER_TRACKS_DIRECTORY_SSD,
            }));
          }
          if (data.env_vars.LOCAL_TRACKS_CACHE_DIRECTORY && !paths.cacheDir) {
            setPaths((prev) => ({ ...prev, cacheDir: data.env_vars.LOCAL_TRACKS_CACHE_DIRECTORY }));
          }
          if (data.env_vars.MASTER_PLAYLIST_ID && !masterPlaylistId) {
            setMasterPlaylistId(data.env_vars.MASTER_PLAYLIST_ID);
            localStorage.setItem("tagify:masterPlaylistId", data.env_vars.MASTER_PLAYLIST_ID);
          }
        }
      } else {
        setServerStatus("disconnected");
      }
    } catch (err) {
      console.error("Error connecting to server:", err);
      setServerStatus("disconnected");
    }
  };

  const saveSettings = () => {
    // Remove any quotes before saving
    const cleanUrl = serverUrl.replace(/^["'](.*)["']$/, "$1");
    localStorage.setItem("tagify:localServerUrl", cleanUrl);

    // Clean other paths as well
    const cleanMasterTracksDir = paths.masterTracksDir.replace(/^["'](.*)["']$/, "$1");
    const cleanPlaylistsDir = paths.playlistsDir.replace(/^["'](.*)["']$/, "$1");
    const cleanCacheDir = paths.cacheDir.replace(/^["'](.*)["']$/, "$1");

    localStorage.setItem("tagify:masterTracksDir", cleanMasterTracksDir);
    localStorage.setItem("tagify:playlistsDir", cleanPlaylistsDir);
    localStorage.setItem("tagify:cacheDir", cleanCacheDir);
    localStorage.setItem("tagify:masterPlaylistId", masterPlaylistId);

    // Update state with cleaned values
    setServerUrl(cleanUrl);
    setPaths({
      masterTracksDir: cleanMasterTracksDir,
      playlistsDir: cleanPlaylistsDir,
      cacheDir: cleanCacheDir,
    });

    Spicetify.showNotification("Settings saved!");
    checkServerConnection();
  };

  const performAction = async (action: string, data: any = {}) => {
    setIsLoading((prev) => ({ ...prev, [action]: true }));
    setResults((prev) => ({ ...prev, [action]: null }));

    try {
      // Clean up paths before sending
      const cleanMasterTracksDir = paths.masterTracksDir.replace(/^["'](.*)["']$/, "$1");
      const cleanPlaylistsDir = paths.playlistsDir.replace(/^["'](.*)["']$/, "$1");
      const cleanCacheDir = paths.cacheDir.replace(/^["'](.*)["']$/, "$1");

      // Add paths to the data
      const requestData = {
        ...data,
        masterTracksDir: cleanMasterTracksDir,
        playlistsDir: cleanPlaylistsDir,
        outputDir: cleanCacheDir,
        master_playlist_id: masterPlaylistId,
      };

      console.log(`Sending request to ${action}:`, requestData);

      const response = await fetch(`${serverUrl.replace(/^["'](.*)["']$/, "$1")}/api/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Check if this is an analysis result that needs confirmation
      if (result.needs_confirmation) {
        setAnalysisResults(result);
        setIsAwaitingConfirmation(true);
        setCurrentAction({
          name: action,
          data: requestData,
        });

        // Do not set result yet - we'll set it after confirmation

        // Show notification about analysis completion
        Spicetify.showNotification(`Analysis complete. Please review and confirm.`);
      } else {
        // Regular result - process normally
        setResults((prev) => ({
          ...prev,
          [action]: { success: result.success, message: result.message || JSON.stringify(result) },
        }));

        // Show notification
        if (result.success) {
          Spicetify.showNotification(`Success: ${result.message || action + " completed"}`);
        } else {
          Spicetify.showNotification(`Error: ${result.message || "Unknown error"}`, true);
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`Error performing action ${action}:`, error);
      setResults((prev) => ({
        ...prev,
        [action]: { success: false, message: error.message || String(error) },
      }));
      Spicetify.showNotification(`Server error: ${error.message || String(error)}`, true);
    } finally {
      setIsLoading((prev) => ({ ...prev, [action]: false }));
    }
  };

  // New function to handle confirmation
  const confirmAction = async () => {
    if (!currentAction) return;

    const { name, data } = currentAction;

    // Add confirmation flag to the data
    const confirmData = {
      ...data,
      confirmed: true,
    };

    // Reset states
    setAnalysisResults(null);
    setIsAwaitingConfirmation(false);
    setCurrentAction(null);

    // Perform the action with confirmation
    await performAction(name, confirmData);
  };

  // New function to cancel confirmation
  const cancelAction = () => {
    setAnalysisResults(null);
    setIsAwaitingConfirmation(false);
    setCurrentAction(null);
    Spicetify.showNotification("Operation cancelled");
  };

  // Render the confirmation UI when needed
  const renderConfirmation = () => {
    if (!isAwaitingConfirmation || !analysisResults) return null;

    return (
      <div className={styles.confirmationPanel}>
        <h3>Confirm Changes</h3>

        {analysisResults.analyses && (
          // This is for the 'all' action
          <div className={styles.allAnalyses}>
            <h4>Playlist Changes</h4>
            <p>
              {analysisResults.analyses.playlists.added} playlists to add,
              {analysisResults.analyses.playlists.updated} to update,
              {analysisResults.analyses.playlists.unchanged} unchanged
            </p>

            <h4>Track Changes</h4>
            <p>
              {analysisResults.analyses.tracks.added} tracks to add,
              {analysisResults.analyses.tracks.updated} to update,
              {analysisResults.analyses.tracks.unchanged} unchanged
            </p>

            {analysisResults.analyses.tracks.to_add_sample.length > 0 && (
              <div className={styles.sampleChanges}>
                <h5>Sample Tracks to Add</h5>
                <div className={styles.trackList}>
                  {analysisResults.analyses.tracks.to_add_sample.map(
                    (
                      track: {
                        artists:
                          | string
                          | number
                          | bigint
                          | boolean
                          | React.ReactElement<unknown, string | React.JSXElementConstructor<any>>
                          | Iterable<React.ReactNode>
                          | React.ReactPortal
                          | Promise<
                              | string
                              | number
                              | bigint
                              | boolean
                              | React.ReactPortal
                              | React.ReactElement<
                                  unknown,
                                  string | React.JSXElementConstructor<any>
                                >
                              | Iterable<React.ReactNode>
                              | null
                              | undefined
                            >
                          | null
                          | undefined;
                        title:
                          | string
                          | number
                          | bigint
                          | boolean
                          | React.ReactElement<unknown, string | React.JSXElementConstructor<any>>
                          | Iterable<React.ReactNode>
                          | React.ReactPortal
                          | Promise<
                              | string
                              | number
                              | bigint
                              | boolean
                              | React.ReactPortal
                              | React.ReactElement<
                                  unknown,
                                  string | React.JSXElementConstructor<any>
                                >
                              | Iterable<React.ReactNode>
                              | null
                              | undefined
                            >
                          | null
                          | undefined;
                      },
                      index: React.Key | null | undefined
                    ) => (
                      <div key={index} className={styles.trackItem}>
                        {track.artists} - {track.title}
                      </div>
                    )
                  )}
                  {analysisResults.analyses.tracks.to_add_total > 20 && (
                    <div className={styles.moreTracks}>
                      ...and {analysisResults.analyses.tracks.to_add_total - 20} more tracks
                    </div>
                  )}
                </div>
              </div>
            )}

            <h4>Association Changes</h4>
            <p>
              {analysisResults.analyses.associations.associations_to_add} associations to add,
              {analysisResults.analyses.associations.associations_to_remove} to remove, affecting{" "}
              {analysisResults.analyses.associations.tracks_with_changes.length} tracks
            </p>
          </div>
        )}

        {/* Display specific analysis results for other actions */}
        {analysisResults.details && !analysisResults.analyses && (
          <div className={styles.specificAnalysis}>
            {/* Render details based on what's available */}
            {analysisResults.details.to_add && analysisResults.details.to_add.length > 0 && (
              <div className={styles.sampleChanges}>
                <h5>Items to Add</h5>
                <div className={styles.itemList}>
                  {analysisResults.details.to_add.map(
                    (
                      item: { name: any; title: any; artists: any },
                      index: React.Key | null | undefined
                    ) => (
                      <div key={index} className={styles.item}>
                        {item.name || item.title || item.artists || JSON.stringify(item)}
                      </div>
                    )
                  )}
                  {analysisResults.details.to_add_total > analysisResults.details.to_add.length && (
                    <div className={styles.moreItems}>
                      ...and{" "}
                      {analysisResults.details.to_add_total - analysisResults.details.to_add.length}{" "}
                      more items
                    </div>
                  )}
                </div>
              </div>
            )}

            {analysisResults.details.to_update && analysisResults.details.to_update.length > 0 && (
              <div className={styles.sampleChanges}>
                <h5>Items to Update</h5>
                <div className={styles.itemList}>
                  {analysisResults.details.to_update.map(
                    (
                      item: {
                        old_name: any;
                        old_title: any;
                        old_artists: any;
                        name: any;
                        title: any;
                        artists: any;
                      },
                      index: React.Key | null | undefined
                    ) => (
                      <div key={index} className={styles.item}>
                        {item.old_name ||
                          item.old_title ||
                          item.old_artists ||
                          JSON.stringify(item)}
                        {" -> "}
                        {item.name || item.title || item.artists || JSON.stringify(item)}
                      </div>
                    )
                  )}
                  {analysisResults.details.to_update_total >
                    analysisResults.details.to_update.length && (
                    <div className={styles.moreItems}>
                      ...and{" "}
                      {analysisResults.details.to_update_total -
                        analysisResults.details.to_update.length}{" "}
                      more items
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Add more sections as needed for other types of details */}
          </div>
        )}

        <div className={styles.confirmationButtons}>
          <button className={styles.confirmButton} onClick={confirmAction}>
            Confirm
          </button>
          <button className={styles.cancelButton} onClick={cancelAction}>
            Cancel
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <h2>Tagify Python Actions</h2>

      <div className={styles.statusIndicator}>
        {serverStatus === "connected" && (
          <div className={styles.connected}>
            <span className={styles.statusDot}></span>
            Connected to server
          </div>
        )}
        {serverStatus === "disconnected" && (
          <div className={styles.disconnected}>
            <span className={styles.statusDot}></span>
            Not connected to server
          </div>
        )}
        {serverStatus === "unknown" && (
          <div className={styles.unknown}>
            <span className={styles.statusDot}></span>
            Checking server status...
          </div>
        )}
      </div>

      <div className={styles.settings}>
        <h3>Settings</h3>
        <div className={styles.formGroup}>
          <label>Server URL</label>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="http://localhost:8765"
          />
        </div>
        <div className={styles.formGroup}>
          <label>Master Tracks Directory</label>
          <input
            type="text"
            value={paths.masterTracksDir}
            onChange={(e) => setPaths({ ...paths, masterTracksDir: e.target.value })}
            placeholder="Path to your music files"
          />
        </div>
        <div className={styles.formGroup}>
          <label>Playlists Directory</label>
          <input
            type="text"
            value={paths.playlistsDir}
            onChange={(e) => setPaths({ ...paths, playlistsDir: e.target.value })}
            placeholder="Path for M3U playlists"
          />
        </div>
        <div className={styles.formGroup}>
          <label>Cache Directory</label>
          <input
            type="text"
            value={paths.cacheDir}
            onChange={(e) => setPaths({ ...paths, cacheDir: e.target.value })}
            placeholder="Path for cache files"
          />
        </div>
        <div className={styles.formGroup}>
          <label>MASTER Playlist ID</label>
          <input
            type="text"
            value={masterPlaylistId}
            onChange={(e) => setMasterPlaylistId(e.target.value)}
            placeholder="Spotify ID of your MASTER playlist"
          />
        </div>
        <ActionButton label="Save Settings" onClick={saveSettings} />
      </div>

      <div className={styles.actions}>
        <h3>Actions</h3>

        <div className={styles.actionGroup}>
          <h4>File Management</h4>
          <div className={styles.actionButtons}>
            <ActionButton
              label="Generate Local Tracks Cache"
              onClick={() => performAction("generate-cache")}
              disabled={isLoading["generate-cache"] || serverStatus !== "connected"}
            />
            <ActionButton
              label="Embed Track Metadata"
              onClick={() => performAction("embed-metadata")}
              disabled={isLoading["embed-metadata"] || serverStatus !== "connected"}
            />
            <ActionButton
              label="Generate M3U Playlists"
              onClick={() =>
                performAction("generate-m3u", {
                  extended: true,
                  overwrite: true,
                  onlyChanged: true,
                })
              }
              disabled={isLoading["generate-m3u"] || serverStatus !== "connected"}
            />
            <ActionButton
              label="Validate Tracks"
              onClick={() => performAction("validate-tracks")}
              disabled={isLoading["validate-tracks"] || serverStatus !== "connected"}
            />
          </div>
        </div>

        <div className={styles.actionGroup}>
          <h4>Database Management</h4>
          <div className={styles.actionButtons}>
            <ActionButton
              label="Sync All Database"
              onClick={() =>
                performAction("sync-database", {
                  action: "all",
                  force_refresh: false,
                  master_playlist_id: masterPlaylistId,
                })
              }
              disabled={isLoading["sync-database"] || serverStatus !== "connected"}
            />
            <ActionButton
              label="Force Full Refresh"
              onClick={() =>
                performAction("sync-database", {
                  action: "all",
                  force_refresh: true,
                  master_playlist_id: masterPlaylistId,
                })
              }
              disabled={isLoading["sync-database"] || serverStatus !== "connected"}
            />
            <ActionButton
              label="Clear Database"
              onClick={() => performAction("sync-database", { action: "clear" })}
              disabled={isLoading["sync-database"] || serverStatus !== "connected"}
              className={styles.dangerButton}
            />
            <ActionButton
              label="Sync Playlists Only"
              onClick={() =>
                performAction("sync-database", {
                  action: "playlists",
                  force_refresh: false,
                })
              }
              disabled={isLoading["sync-database"] || serverStatus !== "connected"}
            />
            <ActionButton
              label="Sync Tracks Only"
              onClick={() =>
                performAction("sync-database", {
                  action: "tracks",
                  force_refresh: false,
                  master_playlist_id: masterPlaylistId,
                })
              }
              disabled={isLoading["sync-database"] || serverStatus !== "connected"}
            />
            <ActionButton
              label="Sync Associations Only"
              onClick={() =>
                performAction("sync-database", {
                  action: "associations",
                  force_refresh: false,
                  master_playlist_id: masterPlaylistId,
                })
              }
              disabled={isLoading["sync-database"] || serverStatus !== "connected"}
            />
          </div>
        </div>

        <div className={styles.actionGroup}>
          <h4>Spotify Integration</h4>
          <div className={styles.actionButtons}>
            <ActionButton
              label="Sync All Playlists to MASTER"
              onClick={() => performAction("sync-to-master")}
              disabled={
                isLoading["sync-to-master"] || serverStatus !== "connected" || !masterPlaylistId
              }
            />
          </div>
          {isLoading["sync-to-master"] && (
            <p className={styles.warning}>
              Sync to MASTER playlist is running. This operation will continue in the background.
            </p>
          )}
        </div>
      </div>

      {renderConfirmation()}

      {/* Results display */}
      <div className={styles.results}>
        {Object.entries(results).map(
          ([action, result]) =>
            result && (
              <div
                key={action}
                className={`${styles.result} ${result.success ? styles.success : styles.error}`}
              >
                <h4>{action.replace(/-/g, " ")}</h4>
                <p>{result.message}</p>
              </div>
            )
        )}
      </div>
    </div>
  );
};

export default PythonActionsPanel;
