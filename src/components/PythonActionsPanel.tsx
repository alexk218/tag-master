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
  const [paginationState, setPaginationState] = useState<
    Record<string, { page: number; pageSize: number }>
  >({});

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

  const getPagination = (section: string) => {
    if (!paginationState[section]) {
      // Default pagination: start with 20 items, page 1
      setPaginationState((prev) => ({
        ...prev,
        [section]: { page: 1, pageSize: 20 },
      }));
      return { page: 1, pageSize: 20 };
    }
    return paginationState[section];
  };

  const loadMoreItems = (section: string) => {
    setPaginationState((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        page: prev[section]?.page + 1 || 2,
      },
    }));
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

            {/* Paginated Playlists to Add */}
            {analysisResults.analyses.playlists.details.to_add.length > 0 && (
              <div className={styles.sampleChanges}>
                <h5>
                  Playlists to Add ({analysisResults.analyses.playlists.details.to_add.length})
                </h5>
                <div className={styles.itemList}>
                  {renderPaginatedList(
                    analysisResults.analyses.playlists.details.to_add,
                    "playlists-add",
                    (item) => (
                      <div className={styles.item}>{item.name}</div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Paginated Playlists to Update */}
            {analysisResults.analyses.playlists.details.to_update.length > 0 && (
              <div className={styles.sampleChanges}>
                <h5>
                  Playlists to Update ({analysisResults.analyses.playlists.details.to_update.length}
                  )
                </h5>
                <div className={styles.itemList}>
                  {renderPaginatedList(
                    analysisResults.analyses.playlists.details.to_update,
                    "playlists-update",
                    (item) => (
                      <div className={styles.item}>
                        {item.old_name} → {item.name}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            <h4>Track Changes</h4>
            <p>
              {analysisResults.analyses.tracks.added} tracks to add,
              {analysisResults.analyses.tracks.updated} to update,
              {analysisResults.analyses.tracks.unchanged} unchanged
            </p>

            {/* Paginated Tracks to Add */}
            {analysisResults.analyses.tracks.to_add_total > 0 && (
              <div className={styles.sampleChanges}>
                <h5>Tracks to Add ({analysisResults.analyses.tracks.to_add_total})</h5>
                <div className={styles.trackList}>
                  {renderPaginatedList(
                    analysisResults.analyses.tracks.all_tracks_to_add ||
                      analysisResults.analyses.tracks.to_add_sample,
                    "tracks-add",
                    (track) => (
                      <div className={styles.trackItem}>
                        {track.artists} - {track.title} {track.is_local ? "(LOCAL)" : ""}
                      </div>
                    ),
                    analysisResults.analyses.tracks.to_add_total
                  )}
                </div>
              </div>
            )}

            {/* Paginated Tracks to Update */}
            {analysisResults.analyses.tracks.to_update_total > 0 && (
              <div className={styles.sampleChanges}>
                <h5>Tracks to Update ({analysisResults.analyses.tracks.to_update_total})</h5>
                <div className={styles.trackList}>
                  {renderPaginatedList(
                    analysisResults.analyses.tracks.all_tracks_to_update || [],
                    "tracks-update",
                    (track) => (
                      <div className={styles.trackItem}>
                        {track.old_artists} - {track.old_title} → {track.artists} - {track.title}
                      </div>
                    ),
                    analysisResults.analyses.tracks.to_update_total
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

            {/* Paginated Association Changes */}
            {analysisResults.analyses.associations.samples.length > 0 && (
              <div className={styles.sampleChanges}>
                <h5>
                  Track Association Changes (
                  {analysisResults.analyses.associations.tracks_with_changes.length})
                </h5>
                <div className={styles.trackList}>
                  {renderPaginatedList(
                    analysisResults.analyses.associations.all_changes ||
                      analysisResults.analyses.associations.samples,
                    "associations",
                    (item) => (
                      <div className={styles.trackItem}>
                        <div>{item.track}</div>
                        {item.add_to.length > 0 && (
                          <div className={styles.addTo}>+ Adding to: {item.add_to.join(", ")}</div>
                        )}
                        {item.remove_from.length > 0 && (
                          <div className={styles.removeFrom}>
                            - Removing from: {item.remove_from.join(", ")}
                          </div>
                        )}
                      </div>
                    ),
                    analysisResults.analyses.associations.tracks_with_changes.length
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Display specific analysis results for other actions */}
        {analysisResults.details && !analysisResults.analyses && (
          <div className={styles.specificAnalysis}>
            {/* Render details based on what's available */}
            {analysisResults.details.to_add && analysisResults.details.to_add.length > 0 && (
              <div className={styles.sampleChanges}>
                <h5>
                  Items to Add (
                  {analysisResults.details.to_add_total || analysisResults.details.to_add.length})
                </h5>
                <div className={styles.itemList}>
                  {renderPaginatedList(
                    analysisResults.details.all_items_to_add || analysisResults.details.to_add,
                    "items-add",
                    (item) => (
                      <div className={styles.item}>
                        {item.name ||
                          item.title ||
                          item.artists ||
                          (item.id ? `${item.artists} - ${item.title}` : JSON.stringify(item))}
                      </div>
                    ),
                    analysisResults.details.to_add_total
                  )}
                </div>
              </div>
            )}

            {analysisResults.details.to_update && analysisResults.details.to_update.length > 0 && (
              <div className={styles.sampleChanges}>
                <h5>
                  Items to Update (
                  {analysisResults.details.to_update_total ||
                    analysisResults.details.to_update.length}
                  )
                </h5>
                <div className={styles.itemList}>
                  {renderPaginatedList(
                    analysisResults.details.all_items_to_update ||
                      analysisResults.details.to_update,
                    "items-update",
                    (item) => (
                      <div className={styles.item}>
                        {item.old_name || item.old_title || item.old_artists ? (
                          <>
                            {item.old_name ||
                              item.old_title ||
                              (item.old_artists && `${item.old_artists} - ${item.old_title}`)}
                            {" → "}
                            {item.name ||
                              item.title ||
                              (item.artists && `${item.artists} - ${item.title}`)}
                          </>
                        ) : (
                          item.name || item.title || item.artists || JSON.stringify(item)
                        )}
                      </div>
                    ),
                    analysisResults.details.to_update_total
                  )}
                </div>
              </div>
            )}

            {/* For embeddingTrackMetadata - show files */}
            {analysisResults.details.files_to_process && (
              <div className={styles.sampleChanges}>
                <h5>Files to Process ({analysisResults.details.files_to_process.length})</h5>
                <div className={styles.itemList}>
                  {renderPaginatedList(
                    analysisResults.details.files_to_process,
                    "files-process",
                    (file) => (
                      <div className={styles.item}>{file.name || file}</div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* For generating M3U playlists */}
            {analysisResults.details.playlists && (
              <div className={styles.sampleChanges}>
                <h5>Playlists to Generate ({analysisResults.details.playlists.length})</h5>
                <div className={styles.itemList}>
                  {renderPaginatedList(
                    analysisResults.details.playlists,
                    "m3u-playlists",
                    (playlist) => (
                      <div className={styles.item}>
                        {playlist.name} ({playlist.track_count} tracks)
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* For sync-to-master */}
        {analysisResults.master_sync && (
          <div className={styles.masterSyncAnalysis}>
            <h4>Sync to MASTER Playlist</h4>
            <p>
              {analysisResults.master_sync.total_tracks_to_add} tracks to add from{" "}
              {analysisResults.master_sync.playlists_with_new_tracks} playlists
            </p>

            {analysisResults.master_sync.playlists && (
              <div className={styles.sampleChanges}>
                <h5>Tracks by Playlist</h5>
                <div className={styles.accordion}>
                  {analysisResults.master_sync.playlists.map(
                    (
                      playlist: {
                        name:
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
                        track_count:
                          | string
                          | number
                          | bigint
                          | boolean
                          | React.ReactElement<unknown, string | React.JSXElementConstructor<any>>
                          | Iterable<React.ReactNode>
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
                        tracks: any[];
                      },
                      i: React.Key | null | undefined
                    ) => (
                      <div key={i} className={styles.accordionItem}>
                        <div
                          className={styles.accordionHeader}
                          onClick={() => toggleAccordion(`playlist-${i}`)}
                        >
                          {playlist.name} ({playlist.track_count} tracks)
                          <span
                            className={
                              expandedSections[`playlist-${i}`]
                                ? styles.accordionExpanded
                                : styles.accordionCollapsed
                            }
                          >
                            {expandedSections[`playlist-${i}`] ? "▼" : "►"}
                          </span>
                        </div>

                        {expandedSections[`playlist-${i}`] && (
                          <div className={styles.accordionContent}>
                            {renderPaginatedList(
                              playlist.tracks,
                              `playlist-tracks-${i}`,
                              (track) => (
                                <div className={styles.trackItem}>
                                  {track.artists} - {track.name}
                                </div>
                              ),
                              Number(playlist.track_count)
                            )}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
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

  // Helper function to render paginated lists with "Load More" button
  const renderPaginatedList = (
    items: any[],
    sectionKey: string,
    renderItem: (item: any) => React.ReactNode,
    totalItems?: number
  ) => {
    const { page, pageSize } = getPagination(sectionKey);
    const displayItems = items.slice(0, page * pageSize);
    const hasMore = totalItems
      ? displayItems.length < totalItems
      : displayItems.length < items.length;

    return (
      <>
        {displayItems.map((item, index) => (
          <React.Fragment key={index}>{renderItem(item)}</React.Fragment>
        ))}

        {hasMore && (
          <div className={styles.loadMoreContainer}>
            <button className={styles.loadMoreButton} onClick={() => loadMoreItems(sectionKey)}>
              Load More ({displayItems.length} of {totalItems || items.length})
            </button>
          </div>
        )}
      </>
    );
  };

  // State for accordion sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleAccordion = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
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
