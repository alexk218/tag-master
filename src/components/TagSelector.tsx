import React, { useState } from "react";
import styles from "./TagSelector.module.css";
import { Category, TrackTag } from "../hooks/useTagData";

interface TagSelectorProps {
  track: {
    uri: string;
    name: string;
  };
  categories: Category[];
  trackTags: TrackTag[];
  onToggleTag: (categoryId: string, subcategoryId: string, tagId: string) => void;
}

const TagSelector: React.FC<TagSelectorProps> = ({
  track,
  categories,
  trackTags,
  onToggleTag
}) => {
  // Keep track of expanded categories and subcategories
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>([]);
  
  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };
  
  // Toggle subcategory expansion
  const toggleSubcategory = (subcategoryId: string) => {
    setExpandedSubcategories(prev => 
      prev.includes(subcategoryId)
        ? prev.filter(id => id !== subcategoryId)
        : [...prev, subcategoryId]
    );
  };
  
  // Check if a tag is applied to the track
  const isTagApplied = (categoryId: string, subcategoryId: string, tagId: string) => {
    return trackTags.some(
      tag => tag.categoryId === categoryId && 
             tag.subcategoryId === subcategoryId && 
             tag.tagId === tagId
    );
  };
  
  // Filter functionality
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter function for tags
  const filterTag = (tagName: string) => {
    if (!searchTerm) return true;
    return tagName.toLowerCase().includes(searchTerm.toLowerCase());
  };
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Add Tags</h2>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>
      
      <div className={styles.categoryList}>
        {categories?.map(category => {
          const hasMatchingTags = category.subcategories.some(subcategory => 
            subcategory.tags.some(tag => filterTag(tag.name))
          );
          
          if (searchTerm && !hasMatchingTags) return null;
          
          return (
            <div key={category.id} className={styles.category}>
              <div 
                className={styles.categoryHeader}
                onClick={() => toggleCategory(category.id)}
              >
                <span className={styles.categoryToggle}>
                  {expandedCategories.includes(category.id) ? "▼" : "►"}
                </span>
                <h3 className={styles.categoryTitle}>{category.name}</h3>
              </div>
              
              {expandedCategories.includes(category.id) && (
                <div className={styles.subcategoryList}>
                  {category.subcategories?.map(subcategory => {
                    const hasMatchingSubcategoryTags = subcategory.tags.some(tag => filterTag(tag.name));
                    
                    if (searchTerm && !hasMatchingSubcategoryTags) return null;
                    
                    return (
                      <div key={subcategory.id} className={styles.subcategory}>
                        <div 
                          className={styles.subcategoryHeader}
                          onClick={() => toggleSubcategory(subcategory.id)}
                        >
                          <span className={styles.subcategoryToggle}>
                            {expandedSubcategories.includes(subcategory.id) ? "▼" : "►"}
                          </span>
                          <h4 className={styles.subcategoryTitle}>{subcategory.name}</h4>
                        </div>
                        
                        {expandedSubcategories.includes(subcategory.id) && (
                          <div className={styles.tagGrid}>
                            {subcategory.tags
                              .filter(tag => filterTag(tag.name))
                              .map(tag => (
                                <button
                                  key={tag.id}
                                  className={`${styles.tagButton} ${isTagApplied(category.id, subcategory.id, tag.id) ? styles.tagApplied : ''}`}
                                  onClick={() => onToggleTag(category.id, subcategory.id, tag.id)}
                                >
                                  {tag.name}
                                </button>
                              ))
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TagSelector;