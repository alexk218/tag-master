import React, { useState, useRef } from "react";
import styles from "./DataManager.module.css";
import { TagDataStructure } from "../hooks/useTagData";
import { syncAllTaggedTracks } from "../utils/PlaylistManager";

interface DataManagerProps {
  onExportBackup: () => void;
  onImportBackup: (data: TagDataStructure) => void;
  onExportRekordbox: () => void;
  lastSaved: Date | null;
  taggedTracks: Record<string, any>;
}

const DataManager: React.FC<DataManagerProps> = ({
  onExportBackup,
  onImportBackup,
  onExportRekordbox,
  lastSaved,
  taggedTracks,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncToPlaylist = async () => {
    setIsSyncing(true);
    try {
      await syncAllTaggedTracks(taggedTracks);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // More thorough validation of the data structure
        if (
          data &&
          typeof data === "object" &&
          data.categories &&
          Array.isArray(data.categories) &&
          data.tracks &&
          typeof data.tracks === "object"
        ) {
          onImportBackup(data);
          Spicetify.showNotification("Data imported successfully!");
        } else {
          console.error("Invalid backup structure:", data);
          Spicetify.showNotification("Invalid backup file format", true);
        }
      } catch (error) {
        console.error("Error parsing backup file:", error);
        Spicetify.showNotification("Error importing backup", true);
      } finally {
        setIsImporting(false);
        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };

    reader.onerror = () => {
      Spicetify.showNotification("Error reading backup file", true);
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Data Management</h3>
        <button
          className={`${styles.actionButton} ${styles.rekordboxButton}`}
          onClick={onExportRekordbox}
        >
          Export for rekordbox
        </button>
      </div>

      {lastSaved && (
        <div className={styles.lastSaved}>Last saved: {lastSaved.toLocaleString()}</div>
      )}

      <div className={styles.actions}>
        <button className={styles.actionButton} onClick={onExportBackup}>
          Export Backup File
        </button>

        <button className={styles.actionButton} onClick={handleImportClick} disabled={isImporting}>
          {isImporting ? "Importing..." : "Import Backup File"}
        </button>

        <button
          className={styles.actionButton}
          onClick={handleSyncToPlaylist}
          disabled={isSyncing || Object.keys(taggedTracks).length === 0}
        >
          {isSyncing ? "Syncing..." : "Sync to TAGGED Playlist"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      <div className={styles.info}>
        <p>
          Backup your tag data regularly to prevent data loss. Your data is currently stored in the
          browser's localStorage.
        </p>
        <p>
          Export a backup file to keep your tag data safe. You can import this file later to restore
          your data.
        </p>
      </div>
    </div>
  );
};

export default DataManager;
