import React from "react";
import styles from "./TrackDetails.module.css";

interface Tag {
  tag: string;
  category: string;
}

interface TrackData {
  rating: number;
  energy: number;
  tags: Tag[];
}

interface TrackDetailsProps {
  track: {
    uri: string;
    name: string;
    artists: { name: string }[];
    album: { name: string };
  };
  trackData: TrackData;
  tagCategories: { [category: string]: string[] };
  onSetRating: (rating: number) => void;
  onSetEnergy: (energy: number) => void;
  onRemoveTag: (tag: string, category: string) => void;
}

const TrackDetails: React.FC<TrackDetailsProps> = ({
  track,
  trackData,
  tagCategories,
  onSetRating,
  onSetEnergy,
  onRemoveTag
}) => {
  // Get track artist names as a string
  const artistNames = track.artists.map(artist => artist.name).join(", ");
  
  // Group tags by category for display
  const tagsByCategory: { [category: string]: string[] } = {};
  trackData.tags.forEach(({ tag, category }) => {
    if (!tagsByCategory[category]) {
      tagsByCategory[category] = [];
    }
    tagsByCategory[category].push(tag);
  });
  
  return (
    <div className={styles.container}>
      <div className={styles.trackInfo}>
        <h2 className={styles.trackTitle}>{track.name}</h2>
        <p className={styles.trackArtist}>{artistNames}</p>
        <p className={styles.trackAlbum}>{track.album.name}</p>
      </div>
      
      <div className={styles.metadata}>
        <div className={styles.ratingSection}>
          <label className={styles.label}>Rating:</label>
          <div className={styles.stars}>
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                className={`${styles.star} ${star <= trackData.rating ? styles.starActive : ''}`}
                onClick={() => onSetRating(star)}
                aria-label={`Rate ${star} stars`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        
        <div className={styles.energySection}>
          <label className={styles.label}>
            Energy Level: <span className={styles.energyValue}>{trackData.energy}</span>
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={trackData.energy}
            className={styles.energySlider}
            onChange={(e) => onSetEnergy(parseInt(e.target.value))}
          />
        </div>
        
        <div className={styles.tagsSection}>
          <label className={styles.label}>Applied Tags:</label>
          {Object.keys(tagsByCategory).length === 0 ? (
            <p className={styles.noTags}>No tags applied</p>
          ) : (
            <div className={styles.appliedTags}>
              {Object.entries(tagsByCategory).map(([category, tags]) => (
                <div key={category} className={styles.tagCategory}>
                  <span className={styles.categoryName}>{category}:</span>
                  <div className={styles.tagList}>
                    {tags.map(tag => (
                      <div key={`${category}-${tag}`} className={styles.tagItem}>
                        <span className={styles.tagName}>{tag}</span>
                        <button
                          className={styles.removeTag}
                          onClick={() => onRemoveTag(tag, category)}
                          aria-label={`Remove tag ${tag}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackDetails;