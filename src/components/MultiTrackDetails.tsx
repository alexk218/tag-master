import React from "react";
import styles from "./MultiTrackDetails.module.css";
import { Category, TrackTag } from "../hooks/useTagData";

interface MultiTrackDetailsProps {
  tracks: Array<{
    uri: string;
    name: string;
    artists: { name: string }[];
    album: { name: string };
  }>;
  trackTagsMap: Record<string, TrackTag[]>;
  categories: Category[];
  onTagAllTracks: (categoryId: string, subcategoryId: string, tagId: string) => void;
  onCancelTagging: () => void;
}

const MultiTrackDetails: React.FC<MultiTrackDetailsProps> = ({
  tracks,
  trackTagsMap,
  categories,
  onTagAllTracks,
  onCancelTagging,
}) => {
  // Helper function to get tag name
  const getTagName = (categoryId: string, subcategoryId: string, tagId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return "Unknown";

    const subcategory = category.subcategories.find((s) => s.id === subcategoryId);
    if (!subcategory) return "Unknown";

    const tag = subcategory.tags.find((t) => t.id === tagId);
    return tag ? tag.name : "Unknown";
  };

  // Find common tags across all tracks
  const findCommonTags = () => {
    if (tracks.length === 0) return [];

    // Start with the tags from the first track
    const firstTrackUri = tracks[0].uri;
    const firstTrackTags = trackTagsMap[firstTrackUri] || [];

    if (tracks.length === 1) return firstTrackTags;

    // Check which tags exist in all tracks
    return firstTrackTags.filter((tag) => {
      return tracks.every((track) => {
        const trackTags = trackTagsMap[track.uri] || [];
        return trackTags.some(
          (t) =>
            t.categoryId === tag.categoryId &&
            t.subcategoryId === tag.subcategoryId &&
            t.tagId === tag.tagId
        );
      });
    });
  };

  const commonTags = findCommonTags();

  const handleRemoveTag = (tag: TrackTag) => {
    onTagAllTracks(tag.categoryId, tag.subcategoryId, tag.tagId);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Mass Tagging</h2>
        <div className={styles.summary}>
          <span className={styles.trackCount}>{tracks.length} tracks selected</span>
          <button className={styles.cancelButton} onClick={onCancelTagging}>
            Cancel Mass Tagging
          </button>
        </div>
      </div>

      <div className={styles.commonTagsSection}>
        <h3 className={styles.sectionTitle}>Common Tags</h3>
        {commonTags.length > 0 ? (
          <div className={styles.tagList}>
            {commonTags.map((tag, index) => (
              <div
                key={index}
                className={styles.tagItem}
                onClick={() => handleRemoveTag(tag)}
                title="Click to remove this tag from all tracks"
              >
                {getTagName(tag.categoryId, tag.subcategoryId, tag.tagId)}
                <span className={styles.removeTagIcon}>×</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.noTags}>No common tags</p>
        )}
      </div>

      <div className={styles.trackListContainer}>
        <h3 className={styles.sectionTitle}>Selected Tracks</h3>
        <div className={styles.trackList}>
          {tracks.map((track) => (
            <div key={track.uri} className={styles.trackItem}>
              <div className={styles.trackInfo}>
                <span className={styles.trackName}>{track.name}</span>
                <span className={styles.trackArtist}>
                  {track.artists.map((artist) => artist.name).join(", ")}
                </span>
              </div>
              <div className={styles.trackTagsInline}>
                {(trackTagsMap[track.uri] || []).length > 0 ? (
                  <div className={styles.tagList}>
                    {trackTagsMap[track.uri].map((tag, index) => (
                      <div
                        key={index}
                        className={styles.tagItem}
                        onClick={() => onTagAllTracks(tag.categoryId, tag.subcategoryId, tag.tagId)}
                        title="Click to toggle this tag on all tracks"
                      >
                        {getTagName(tag.categoryId, tag.subcategoryId, tag.tagId)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className={styles.noTags}>No tags</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.instructions}>
        <p>Apply tags to all selected tracks using the tag selector below.</p>
        <p>Click any existing tag to toggle it across all tracks.</p>
      </div>
    </div>
  );
};

export default MultiTrackDetails;
