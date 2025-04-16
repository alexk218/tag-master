import React, { useState } from "react";
import styles from "./TagSelector.module.css";

interface Tag {
  tag: string;
  category: string;
}

interface TagSelectorProps {
  track: any;
  tagCategories: { [category: string]: string[] };
  trackTags: Tag[];
  onToggleTag: (tag: string, category: string) => void;
}

const TagSelector: React.FC<TagSelectorProps> = ({ 
  track, 
  tagCategories, 
  trackTags,
  onToggleTag 
}) => {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  
  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };
  
  // Check if a tag is already applied to the track
  const isTagApplied = (tag: string, category: string) => {
    return trackTags.some(t => t.tag === tag && t.category === category);
  };
  
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Add Tags</h2>
      
      <div className={styles.categoryList}>
        {Object.entries(tagCategories).map(([category, tags]) => (
          <div key={category} className={styles.category}>
            <div 
              className={styles.categoryHeader} 
              onClick={() => toggleCategory(category)}
            >
              <span className={styles.categoryToggle}>
                {expandedCategories.includes(category) ? "▼" : "►"}
              </span>
              <h3 className={styles.categoryTitle}>{category}</h3>
            </div>
            
            {expandedCategories.includes(category) && (
              <div className={styles.tagGrid}>
                {tags.map(tag => (
                  <button
                    key={`${category}-${tag}`}
                    className={`${styles.tagButton} ${isTagApplied(tag, category) ? styles.tagApplied : ''}`}
                    onClick={() => onToggleTag(tag, category)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TagSelector;