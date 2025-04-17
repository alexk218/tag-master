import { useState, useEffect } from "react";

// Define types for our tag data structure
interface Tag {
    tag: string;
    category: string;
}

interface TrackData {
    rating: number;
    energy: number;
    tags: Tag[];
}

interface TagDataStructure {
    tagCategories: {
        [category: string]: string[];
    };
    tracks: {
        [trackUri: string]: TrackData;
    };
}

// Default tag structure
const defaultTagData: TagDataStructure = {
    tagCategories: {
        "Genres": [
            "Organic", "Minimal", "Soul", "Beautiful", "Bootleg",
            "Indie", "Disco", "Downtempo", "Progressive", "Melodic",
            "Deep", "Tech", "Dubby", "Afro", "Tribal",
            "Latin", "Boho", "Jazzy", "Ambient", "YES",
            "Classic", "Acid", "Organiklakk"
        ],
        "Label-defined sounds": [
            "Maccabi", "HOOM", "ADID", "PAMPA"
        ],
        "Artist-inspired styles": [
            "KORA minimal (organica)", "SIS minimal", "RUSSO",
            "ZETA indie", "KOLETSKI LASER", "D Hohmes organic"
        ]
    },
    tracks: {}
};

// Storage key for tag data in local storage (as fallback)
const STORAGE_KEY = "tagmaster:tagData";

export function useTagData() {
    // State to hold our tag data
    const [tagData, setTagData] = useState<TagDataStructure>(defaultTagData);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Helper function to save to localStorage (fallback method)
    const saveToLocalStorage = (data: TagDataStructure) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            console.log("TagMaster: Data saved to localStorage");
            return true;
        } catch (error) {
            console.error("TagMaster: Error saving to localStorage", error);
            return false;
        }
    };

    // Helper function to load from localStorage (fallback method)
    const loadFromLocalStorage = (): TagDataStructure | null => {
        try {
            const savedData = localStorage.getItem(STORAGE_KEY);
            if (savedData) {
                return JSON.parse(savedData);
            }
        } catch (error) {
            console.error("TagMaster: Error loading from localStorage", error);
        }
        return null;
    };

    // Helper to create a folder if it doesn't exist
    const ensureDirectoryExists = (dirPath: string) => {
        try {
            if (Spicetify.CosmosAsync) {
                // We're in a Spicetify environment, but we need to use a different approach
                // This is a placeholder - the actual implementation depends on what Spicetify allows
                console.log("Would create directory:", dirPath);
                return true;
            }
        } catch (error) {
            console.error("Error creating directory:", error);
        }
        return false;
    };

    // Load tag data
    const loadTagData = () => {
        setIsLoading(true);
        let loaded = false;

        // Try loading from localStorage as a fallback
        const localData = loadFromLocalStorage();
        if (localData) {
            setTagData(localData);
            setLastSaved(new Date());
            loaded = true;
            console.log("TagMaster: Loaded data from localStorage");
        } else {
            // If no data in localStorage, use default
            setTagData(defaultTagData);
            console.log("TagMaster: Initialized with default data");
        }

        setIsLoading(false);
        return loaded;
    };

    // Save tag data
    const saveTagData = (data: TagDataStructure) => {
        let saved = false;

        // Save to localStorage as a fallback
        saved = saveToLocalStorage(data);

        if (saved) {
            setLastSaved(new Date());
        }

        return saved;
    };

    // Export backup data as a downloadable file
    const exportBackup = () => {
        const jsonData = JSON.stringify(tagData, null, 2);
        const blob = new Blob([jsonData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `tagmaster-backup-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        Spicetify.showNotification("Backup created and downloaded");
    };

    // Import data from a backup file
    const importBackup = (backupData: TagDataStructure) => {
        setTagData(backupData);
        saveTagData(backupData);
        Spicetify.showNotification("Data restored from backup");
    };

    // Load tag data on component mount
    useEffect(() => {
        loadTagData();
    }, []);

    // Auto-save when data changes
    useEffect(() => {
        if (!isLoading) {
            // Only save after initial load is complete
            const timer = setTimeout(() => {
                saveTagData(tagData);
            }, 2000); // Debounce for performance

            return () => clearTimeout(timer);
        }
    }, [tagData, isLoading]);

    // Ensure track data exists for a given URI
    const ensureTrackData = (trackUri: string) => {
        if (!tagData.tracks[trackUri]) {
            // Create a new track data structure
            const newTagData = {
                ...tagData,
                tracks: {
                    ...tagData.tracks,
                    [trackUri]: {
                        rating: 0,
                        energy: 5,
                        tags: []
                    }
                }
            };
            setTagData(newTagData);
            return newTagData;
        }
        return tagData;
    };

    // Toggle a tag for a track
    const toggleTag = (trackUri: string, tag: string, category: string) => {
        // Ensure track data exists
        const currentData = ensureTrackData(trackUri);
        const trackData = currentData.tracks[trackUri];

        // Find if tag already exists
        const existingTagIndex = trackData.tags.findIndex(t =>
            t.tag === tag && t.category === category
        );

        let updatedTags;
        if (existingTagIndex >= 0) {
            // Remove tag if it exists
            updatedTags = [
                ...trackData.tags.slice(0, existingTagIndex),
                ...trackData.tags.slice(existingTagIndex + 1)
            ];
        } else {
            // Add tag if it doesn't exist
            updatedTags = [...trackData.tags, { tag, category }];
        }

        // Update state
        const newTagData = {
            ...currentData,
            tracks: {
                ...currentData.tracks,
                [trackUri]: {
                    ...trackData,
                    tags: updatedTags
                }
            }
        };

        setTagData(newTagData);
    };

    // Set rating for a track
    const setRating = (trackUri: string, rating: number) => {
        // Ensure track data exists
        const currentData = ensureTrackData(trackUri);

        // Update rating
        const newTagData = {
            ...currentData,
            tracks: {
                ...currentData.tracks,
                [trackUri]: {
                    ...currentData.tracks[trackUri],
                    rating
                }
            }
        };

        setTagData(newTagData);
    };

    // Set energy level for a track
    const setEnergy = (trackUri: string, energy: number) => {
        // Ensure track data exists
        const currentData = ensureTrackData(trackUri);

        // Update energy
        const newTagData = {
            ...currentData,
            tracks: {
                ...currentData.tracks,
                [trackUri]: {
                    ...currentData.tracks[trackUri],
                    energy
                }
            }
        };

        setTagData(newTagData);
    };

    // Add a new tag to a category
    const addTag = (category: string, tag: string) => {
        // Check if tag already exists in category
        if (tagData.tagCategories[category].includes(tag)) {
            return;
        }

        // Add tag to category
        const newTagData = {
            ...tagData,
            tagCategories: {
                ...tagData.tagCategories,
                [category]: [...tagData.tagCategories[category], tag]
            }
        };

        setTagData(newTagData);
    };

    // Remove a tag from a category and/or track
    const removeTag = (trackUri: string, tag: string, category: string) => {
        // Create copy of tag data
        const newTagData = { ...tagData };

        // If trackUri is empty string, treat it as a global removal
        if (!trackUri) {
            // Remove tag from all tracks
            Object.keys(newTagData.tracks).forEach(uri => {
                const trackData = newTagData.tracks[uri];
                newTagData.tracks[uri] = {
                    ...trackData,
                    tags: trackData.tags.filter(t => !(t.tag === tag && t.category === category))
                };
            });

            // Also remove from the category
            if (newTagData.tagCategories[category]) {
                const tagIndex = newTagData.tagCategories[category].indexOf(tag);
                if (tagIndex >= 0) {
                    newTagData.tagCategories[category] = [
                        ...newTagData.tagCategories[category].slice(0, tagIndex),
                        ...newTagData.tagCategories[category].slice(tagIndex + 1)
                    ];
                }
            }
        } else {
            // Remove from just the specific track
            if (newTagData.tracks[trackUri]) {
                const trackData = newTagData.tracks[trackUri];
                newTagData.tracks[trackUri] = {
                    ...trackData,
                    tags: trackData.tags.filter(t => !(t.tag === tag && t.category === category))
                };
            }
        }

        setTagData(newTagData);
    };

    // Rename a tag in a category and in all tracks
    const renameTag = (category: string, oldTag: string, newTag: string) => {
        // Create copy of tag data
        const newTagData = { ...tagData };

        // Rename tag in category
        const tagIndex = newTagData.tagCategories[category]?.indexOf(oldTag);
        if (tagIndex >= 0) {
            newTagData.tagCategories[category][tagIndex] = newTag;
        }

        // Rename tag in all tracks
        Object.keys(newTagData.tracks).forEach(uri => {
            const trackData = newTagData.tracks[uri];
            newTagData.tracks[uri] = {
                ...trackData,
                tags: trackData.tags.map(t =>
                    t.tag === oldTag && t.category === category
                        ? { ...t, tag: newTag }
                        : t
                )
            };
        });

        setTagData(newTagData);
    };

    // Add a new category
    const addCategory = (category: string) => {
        // Check if category already exists
        if (tagData.tagCategories[category]) {
            return;
        }

        // Add new category
        const newTagData = {
            ...tagData,
            tagCategories: {
                ...tagData.tagCategories,
                [category]: []
            }
        };

        setTagData(newTagData);
    };

    // Remove a category and all its tags from tracks
    const removeCategory = (category: string) => {
        // Create copy of tag data
        const newTagData = { ...tagData };

        // Delete category
        const { [category]: _, ...remainingCategories } = newTagData.tagCategories;
        newTagData.tagCategories = remainingCategories;

        // Remove all tags from this category from tracks
        Object.keys(newTagData.tracks).forEach(uri => {
            const trackData = newTagData.tracks[uri];
            newTagData.tracks[uri] = {
                ...trackData,
                tags: trackData.tags.filter(t => t.category !== category)
            };
        });

        setTagData(newTagData);
    };

    // Rename a category
    const renameCategory = (oldCategory: string, newCategory: string) => {
        // Create copy of tag data
        const newTagData = { ...tagData };

        // Create new category with the same tags
        newTagData.tagCategories[newCategory] = [...newTagData.tagCategories[oldCategory]];

        // Remove old category
        const { [oldCategory]: _, ...remainingCategories } = newTagData.tagCategories;
        newTagData.tagCategories = remainingCategories;

        // Update category name in all track tags
        Object.keys(newTagData.tracks).forEach(uri => {
            const trackData = newTagData.tracks[uri];
            newTagData.tracks[uri] = {
                ...trackData,
                tags: trackData.tags.map(t =>
                    t.category === oldCategory
                        ? { ...t, category: newCategory }
                        : t
                )
            };
        });

        setTagData(newTagData);
    };

    // Export data for Rekordbox integration
    const exportData = () => {
        const exportResult: any = {
            version: "1.0",
            exported_at: new Date().toISOString(),
            tracks: {}
        };

        // Format track data for export
        Object.entries(tagData.tracks).forEach(([uri, data]) => {
            const trackId = uri.split(':').pop() || uri;

            // Convert tags array to format for Rekordbox
            const tagList = data.tags.map(t => t.tag).join(', ');

            // Use string indexing with type assertion to avoid TypeScript error
            exportResult.tracks[trackId as string] = {
                rating: data.rating,
                energy: data.energy,
                tags: data.tags,
                rekordbox_comment: `${data.energy} - ${tagList}`
            };
        });

        return exportResult;
    };

    // Return hook functions and data
    return {
        tagData,
        isLoading,
        lastSaved,
        toggleTag,
        setRating,
        setEnergy,
        addTag,
        removeTag,
        renameTag,
        addCategory,
        removeCategory,
        renameCategory,
        exportData,
        exportBackup,
        importBackup
    };
}