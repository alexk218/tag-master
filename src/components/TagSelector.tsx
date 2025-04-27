import React, { useState, useEffect, useRef } from "react";
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
  onOpenTagManager: () => void;
  isMultiTagging?: boolean;
  isLockedTrack?: boolean;
}

const TagSelector: React.FC<TagSelectorProps> = ({
  categories,
  trackTags,
  onToggleTag,
  onOpenTagManager,
  isMultiTagging = false,
  isLockedTrack = false,
}) => {
  // Keep track of expanded categories and subcategories
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [areAllExpanded, setAreAllExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Toggle subcategory expansion
  const toggleSubcategory = (subcategoryId: string) => {
    setExpandedSubcategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subcategoryId)) {
        newSet.delete(subcategoryId);
      } else {
        newSet.add(subcategoryId);
      }
      return newSet;
    });
  };

  // Function to expand all categories and subcategories
  const expandAll = () => {
    const allCategoryIds = categories.map((category) => category.id);
    const allSubcategoryIds = categories.flatMap((category) =>
      category.subcategories.map((subcategory) => subcategory.id)
    );

    setExpandedCategories(new Set(allCategoryIds));
    setExpandedSubcategories(new Set(allSubcategoryIds));
    setAreAllExpanded(true);
  };

  // Function to collapse all categories and subcategories
  const collapseAll = () => {
    setExpandedCategories(new Set());
    setExpandedSubcategories(new Set());
    setAreAllExpanded(false);
  };

  // Toggle expand/collapse all
  const toggleExpandAll = () => {
    if (areAllExpanded) {
      collapseAll();
    } else {
      expandAll();
    }
  };

  // Check if a tag is applied to the track
  const isTagApplied = (categoryId: string, subcategoryId: string, tagId: string) => {
    return trackTags.some(
      (tag) =>
        tag.categoryId === categoryId && tag.subcategoryId === subcategoryId && tag.tagId === tagId
    );
  };

  // Filter functionality
  const [searchTerm, setSearchTerm] = useState("");

  // Filter function for tags
  const filterTag = (tagName: string) => {
    if (!searchTerm) return true;
    return tagName.toLowerCase().includes(searchTerm.toLowerCase());
  };

  // Auto-expand categories and subcategories when searching
  useEffect(() => {
    if (!searchTerm) return;

    // Find categories and subcategories that contain matching tags
    const matchingCategories = new Set<string>();
    const matchingSubcategories = new Set<string>();

    categories.forEach((category) => {
      let categoryHasMatches = false;

      category.subcategories.forEach((subcategory) => {
        const hasMatchingTags = subcategory.tags.some((tag) =>
          tag.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (hasMatchingTags) {
          matchingSubcategories.add(subcategory.id);
          categoryHasMatches = true;
        }
      });

      if (categoryHasMatches) {
        matchingCategories.add(category.id);
      }
    });

    // Expand matching categories and subcategories
    setExpandedCategories(matchingCategories);
    setExpandedSubcategories(matchingSubcategories);
  }, [searchTerm, categories]);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {isMultiTagging ? "Add Tags to All Selected Tracks" : "Add Tags"}
        </h2>
        <div className={styles.controls}>
          <button
            className={styles.expandCollapseButton}
            onClick={toggleExpandAll}
            title={areAllExpanded ? "Collapse all categories" : "Expand all categories"}
          >
            <span className={styles.expandCollapseIcon}>{areAllExpanded ? "▼" : "►"}</span>
            {areAllExpanded ? "Collapse All" : "Expand All"}
          </button>

          <button
            className={styles.manageButton}
            onClick={(e) => {
              e.stopPropagation();
              console.log("Manage Tags clicked from TagSelector");
              onOpenTagManager();
            }}
          >
            Manage Tags
          </button>
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
      </div>

      {isMultiTagging && (
        <div className={styles.multiTaggingBanner}>
          <span className={styles.multiTaggingIcon}>{isLockedTrack ? "🔒" : "🏷️"}</span>
          <span className={styles.multiTaggingText}>
            {isLockedTrack
              ? "Tags will be applied to the locked track only"
              : "Tags will be applied to all selected tracks"}
          </span>
        </div>
      )}

      <div className={styles.categoryList}>
        {categories?.map((category) => {
          const hasMatchingTags = category.subcategories.some((subcategory) =>
            subcategory.tags.some((tag) => filterTag(tag.name))
          );

          if (searchTerm && !hasMatchingTags) return null;

          const isCategoryExpanded = expandedCategories.has(category.id);

          return (
            <div key={category.id} className={styles.category}>
              <div className={styles.categoryHeader} onClick={() => toggleCategory(category.id)}>
                <span className={styles.categoryToggle}>{isCategoryExpanded ? "▼" : "►"}</span>
                <h3 className={styles.categoryTitle}>{category.name}</h3>
              </div>

              {isCategoryExpanded && (
                <div className={styles.subcategoryList}>
                  {category.subcategories?.map((subcategory) => {
                    const hasMatchingSubcategoryTags = subcategory.tags.some((tag) =>
                      filterTag(tag.name)
                    );

                    if (searchTerm && !hasMatchingSubcategoryTags) return null;

                    const isSubcategoryExpanded = expandedSubcategories.has(subcategory.id);

                    return (
                      <div key={subcategory.id} className={styles.subcategory}>
                        <div
                          className={styles.subcategoryHeader}
                          onClick={() => toggleSubcategory(subcategory.id)}
                        >
                          <span className={styles.subcategoryToggle}>
                            {isSubcategoryExpanded ? "▼" : "►"}
                          </span>
                          <h4 className={styles.subcategoryTitle}>{subcategory.name}</h4>
                        </div>

                        {isSubcategoryExpanded && (
                          <div className={styles.tagGrid}>
                            {subcategory.tags
                              .filter((tag) => filterTag(tag.name))
                              .map((tag) => (
                                <button
                                  key={tag.id}
                                  className={`${styles.tagButton} ${
                                    isTagApplied(category.id, subcategory.id, tag.id)
                                      ? styles.tagApplied
                                      : ""
                                  }`}
                                  onClick={() => onToggleTag(category.id, subcategory.id, tag.id)}
                                >
                                  {tag.name}
                                </button>
                              ))}
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
