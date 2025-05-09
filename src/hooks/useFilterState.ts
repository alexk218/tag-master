import { useState, useEffect } from "react";

export function useFilterState() {
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [excludedTagFilters, setExcludedTagFilters] = useState<string[]>([]);

  // Load saved filters on mount
  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem("tagify:filterState");
      if (savedFilters) {
        const filters = JSON.parse(savedFilters);

        // Only set the tag filters if they exist in the saved state
        if (filters.activeTagFilters && Array.isArray(filters.activeTagFilters)) {
          setActiveTagFilters(filters.activeTagFilters);
        }

        if (filters.excludedTagFilters && Array.isArray(filters.excludedTagFilters)) {
          setExcludedTagFilters(filters.excludedTagFilters);
        }
      }
    } catch (error) {
      console.error("Error loading tag filters from localStorage:", error);
    }
  }, []);

  // Save filters when they change
  useEffect(() => {
    try {
      const filterState = {
        activeTagFilters,
        excludedTagFilters,
      };

      localStorage.setItem("tagify:filterState", JSON.stringify(filterState));
    } catch (error) {
      console.error("Error saving filter state:", error);
    }
  }, [activeTagFilters, excludedTagFilters]);

  const handleRemoveFilter = (tag: string) => {
    // Remove from active filters if it's there
    if (activeTagFilters.includes(tag)) {
      setActiveTagFilters((prev) => prev.filter((t) => t !== tag));
    }
    // Remove from excluded filters if it's there
    else if (excludedTagFilters.includes(tag)) {
      setExcludedTagFilters((prev) => prev.filter((t) => t !== tag));
    }
  };

  const handleToggleFilterType = (tag: string, isExcluded: boolean) => {
    if (isExcluded) {
      // If excluded, move to included
      setExcludedTagFilters((prev) => prev.filter((t) => t !== tag));
      setActiveTagFilters((prev) => [...prev, tag]);
    } else {
      // If included, move to excluded
      setActiveTagFilters((prev) => prev.filter((t) => t !== tag));
      setExcludedTagFilters((prev) => [...prev, tag]);
    }
  };

  const onFilterByTag = (tag: string) => {
    if (activeTagFilters.includes(tag)) {
      // Move from INCLUDE to EXCLUDE
      setActiveTagFilters((prev) => prev.filter((t) => t !== tag));
      setExcludedTagFilters((prev) => [...prev, tag]);
    } else if (excludedTagFilters.includes(tag)) {
      // Move from EXCLUDE to OFF
      setExcludedTagFilters((prev) => prev.filter((t) => t !== tag));
    } else {
      // Move from OFF to INCLUDE
      setActiveTagFilters((prev) => [...prev, tag]);
    }
  };

  // Toggle tags between ON/OFF - no EXCLUDE
  const onFilterByTagOnOff = (tag: string) => {
    if (activeTagFilters.includes(tag)) {
      // Just remove from active filters (OFF)
      setActiveTagFilters((prev) => prev.filter((t) => t !== tag));
    } else if (excludedTagFilters.includes(tag)) {
      // Move from excluded to active (INCLUDE)
      setExcludedTagFilters((prev) => prev.filter((t) => t !== tag));
      setActiveTagFilters((prev) => [...prev, tag]);
    } else {
      // Add to active filters (INCLUDE)
      setActiveTagFilters((prev) => [...prev, tag]);
    }
  };

  const clearTagFilters = () => {
    setActiveTagFilters([]);
    setExcludedTagFilters([]);
  };

  return {
    activeTagFilters,
    excludedTagFilters,
    handleRemoveFilter,
    handleToggleFilterType,
    onFilterByTag,
    onFilterByTagOnOff,
    clearTagFilters,
  };
}
