import React from "react";
import styles from "./ExportPanel.module.css";

interface ExportTrack {
  rating: number;
  energy: number;
  tags: Array<{
    categoryId: string;
    subcategoryId: string;
    tagId: string;
    name: string;
  }>;
  rekordbox_comment: string;
}

interface ExportData {
  version: string;
  exported_at: string;
  tracks: {
    [trackId: string]: ExportTrack;
  };
}

interface ExportPanelProps {
  data: ExportData;
  onClose: () => void;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ data, onClose }) => {
  // Function to download the JSON file
  const handleDownload = () => {
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `tagmaster-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
  };

  // Calculate export statistics
  const trackCount = Object.keys(data.tracks).length;
  const ratedTrackCount = Object.values(data.tracks).filter((track) => track.rating > 0).length;
  const taggedTrackCount = Object.values(data.tracks).filter(
    (track) => track.tags.length > 0
  ).length;

  // Calculate tag distribution
  const tagDistribution: { [tagName: string]: number } = {};
  Object.values(data.tracks).forEach((track) => {
    track.tags.forEach((tag) => {
      if (!tagDistribution[tag.name]) {
        tagDistribution[tag.name] = 0;
      }
      tagDistribution[tag.name]++;
    });
  });

  // Sort tags by frequency for display
  const sortedTags = Object.entries(tagDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10 tags

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Export for Rekordbox</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.exportSection}>
            <h3 className={styles.sectionTitle}>Export Statistics</h3>
            <div className={styles.stats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total Tracks:</span>
                <span className={styles.statValue}>{trackCount}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Rated Tracks:</span>
                <span className={styles.statValue}>{ratedTrackCount}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Tagged Tracks:</span>
                <span className={styles.statValue}>{taggedTrackCount}</span>
              </div>
            </div>
          </div>

          {sortedTags.length > 0 && (
            <div className={styles.tagDistributionSection}>
              <h3 className={styles.sectionTitle}>Most Used Tags</h3>
              <div className={styles.tagDistribution}>
                {sortedTags.map(([tagName, count]) => (
                  <div key={tagName} className={styles.distributionItem}>
                    <div className={styles.tagName}>{tagName}</div>
                    <div className={styles.tagCount}>{count}</div>
                    <div className={styles.tagBar}>
                      <div
                        className={styles.tagBarFill}
                        style={{ width: `${(count / sortedTags[0][1]) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.infoSection}>
            <h3 className={styles.sectionTitle}>Export Format</h3>
            <p className={styles.infoText}>
              The exported data is formatted for use with Rekordbox. It includes:
            </p>
            <ul className={styles.infoList}>
              <li>Star ratings (1-5) that will map to Rekordbox ratings</li>
              <li>Energy levels (1-10) for each track</li>
              <li>All tags organized by category</li>
              <li>Formatted comments for Rekordbox in the format: "Energy X - Tag1, Tag2, Tag3"</li>
            </ul>
          </div>

          <div className={styles.instructionsSection}>
            <h3 className={styles.sectionTitle}>Next Steps</h3>
            <ol className={styles.instructionsList}>
              <li>Download the export file by clicking the button below</li>
              <li>Use the Rekordbox integration script to apply this metadata to your tracks</li>
              <li>Import your tracks into Rekordbox to see the updated metadata</li>
            </ol>
            <p className={styles.note}>
              <strong>Note:</strong> To use this data, you'll need to run the separate integration
              script that will write this metadata to your music files before importing them into
              Rekordbox.
            </p>
          </div>

          <div className={styles.exportActions}>
            <button className={styles.downloadButton} onClick={handleDownload}>
              Download Export File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;
