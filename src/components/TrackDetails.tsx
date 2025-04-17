import React from "react";
import styles from "./TrackDetails.module.css";
import { Category, TrackTag } from "../hooks/useTagData";

interface TrackDetailsProps {
  track: {
    uri: string;
    name: string;
    artists: { name: string }[];
    album: { name: string };
  };
  trackData: {
    rating: number;
    energy: number;
    tags: TrackTag[];
  };
  categories: Category[];
  onSetRating: (rating: number) => void;
  onSetEnergy: (energy: number) => void;
  onRemoveTag: (categoryId: string, subcategoryId: string, tagId: string) => void;
}

const TrackDetails: React.FC<TrackDetailsProps> = ({
  track,
  trackData,
  categories,
  onSetRating,
  onSetEnergy,
  onRemoveTag
}) => {
  // Get track artist names as a string
  const artistNames = track.artists.map(artist => artist.name).join(", ");
  
  // Helper function to find tag name by ids
  const findTagInfo = (categoryId: string, subcategoryId: string, tagId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return null;
    
    const subcategory = category.subcategories.find(s => s.id === subcategoryId);
    if (!subcategory) return null;
    
    const tag = subcategory.tags.find(t => t.id === tagId);
    if (!tag) return null;
    
    return {
      categoryName: category.name,
      subcategoryName: subcategory.name,
      tagName: tag.name
    };
  };
  
  // Group tags by category for better organization in the UI
  const organizeTagsByCategory = () => {
    const groupedTags: {
      [categoryId: string]: {
        categoryName: string;
        subcategories: {
          [subcategoryId: string]: {
            subcategoryName: string;
            tags: {
              id: string;
              name: string;
            }[];
          };
        };
      };
    } = {};
    
    trackData.tags.forEach(tag => {
      const tagInfo = findTagInfo(tag.categoryId, tag.subcategoryId, tag.tagId);
      if (!tagInfo) return;
      
      // Initialize category if not exists
      if (!groupedTags[tag.categoryId]) {
        groupedTags[tag.categoryId] = {
          categoryName: tagInfo.categoryName,
          subcategories: {}
        };
      }
      
      // Initialize subcategory if not exists
      if (!groupedTags[tag.categoryId].subcategories[tag.subcategoryId]) {
        groupedTags[tag.categoryId].subcategories[tag.subcategoryId] = {
          subcategoryName: tagInfo.subcategoryName,
          tags: []
        };
      }
      
      // Add tag
      groupedTags[tag.categoryId].subcategories[tag.subcategoryId].tags.push({
        id: tag.tagId,
        name: tagInfo.tagName
      });
    });
    
    return groupedTags;
  };
  
  const groupedTags = organizeTagsByCategory();
  
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
          {Object.keys(groupedTags).length === 0 ? (
            <p className={styles.noTags}>No tags applied</p>
          ) : (
            <div className={styles.tagCategories}>
              {Object.entries(groupedTags).map(([categoryId, category]) => (
                <div key={categoryId} className={styles.tagCategory}>
                  <h4 className={styles.categoryName}>{category.categoryName}</h4>
                  
                  {Object.entries(category.subcategories).map(([subcategoryId, subcategory]) => (
                    <div key={subcategoryId} className={styles.tagSubcategory}>
                      <h5 className={styles.subcategoryName}>{subcategory.subcategoryName}</h5>
                      
                      <div className={styles.tagList}>
                        {subcategory.tags.map(tag => (
                          <div key={tag.id} className={styles.tagItem}>
                            <span className={styles.tagName}>{tag.name}</span>
                            <button
                              className={styles.removeTag}
                              onClick={() => onRemoveTag(categoryId, subcategoryId, tag.id)}
                              aria-label={`Remove tag ${tag.name}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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