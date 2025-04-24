import { useState, useEffect } from "react";

// Define types for our hierarchical tag data structure
export interface Tag {
    name: string;
    id: string; // Unique identifier for the tag
}

export interface Subcategory {
    name: string;
    id: string; // Unique identifier for the subcategory
    tags: Tag[];
}

export interface Category {
    name: string;
    id: string; // Unique identifier for the category
    subcategories: Subcategory[];
}

export interface TrackTag {
    tagId: string;
    subcategoryId: string;
    categoryId: string;
}

export interface TrackData {
    rating: number; // 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, or 5
    energy: number; // 1-10 scale, 0 for no energy rating
    tags: TrackTag[]; // References to tags by their IDs
}

export interface TagDataStructure {
    categories: Category[];
    tracks: {
        [trackUri: string]: TrackData;
    };
}

// Generate an ID from a name string
const generateIdFromName = (name: string): string => {
    // Convert to lowercase, replace spaces and special characters with hyphens
    // then remove any leading or trailing hyphens
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/[\s_]+/g, '-')  // Replace spaces and underscores with hyphens
        .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, ''); // Remove leading and trailing hyphens
};

// Check if ID already exists within a collection and make it unique if needed
const ensureUniqueId = (id: string, existingIds: string[]): string => {
    if (!existingIds.includes(id)) return id;

    let counter = 1;
    let newId = `${id}-${counter}`;

    while (existingIds.includes(newId)) {
        counter++;
        newId = `${id}-${counter}`;
    }

    return newId;
};

// Default tag structure with 4 main categories
const defaultTagData: TagDataStructure = {
    categories: [
        {
            name: "Genres & Styles",
            id: "genres-styles",
            subcategories: [
                {
                    name: "Genres",
                    id: "genres",
                    tags: [
                        { name: "Organic", id: "organic" },
                        { name: "Minimal", id: "minimal" },
                        { name: "Soul", id: "soul" },
                        { name: "Beautiful", id: "beautiful" },
                        { name: "Bootleg", id: "bootleg" },
                        { name: "Indie", id: "indie" },
                        { name: "Disco", id: "disco" },
                        { name: "Downtempo", id: "downtempo" },
                        { name: "Progressive", id: "progressive" },
                        { name: "Melodic", id: "melodic" },
                        { name: "Deep", id: "deep" },
                        { name: "Tech", id: "tech" },
                        { name: "Dubby", id: "dubby" },
                        { name: "Afro", id: "afro" },
                        { name: "Tribal", id: "tribal" },
                        { name: "Latin", id: "latin" },
                        { name: "Boho", id: "boho" },
                        { name: "Jazzy", id: "jazzy" },
                        { name: "Ambient", id: "ambient" },
                    ]
                },
                {
                    name: "Label-defined sounds",
                    id: "label-sounds",
                    tags: [
                        { name: "Maccabi", id: "maccabi" },
                        { name: "HOOM", id: "hoom" },
                        { name: "ADID", id: "adid" },
                        { name: "PAMPA", id: "pampa" }
                    ]
                },
                {
                    name: "Artist-inspired styles",
                    id: "artist-styles",
                    tags: [
                        { name: "KORA minimal (organica)", id: "kora-minimal" },
                        { name: "SIS minimal", id: "sis-minimal" },
                        { name: "RUSSO", id: "russo" },
                        { name: "ZETA indie", id: "zeta-indie" }
                    ]
                }
            ]
        },
        {
            name: "Energy & Mood",
            id: "energy-mood",
            subcategories: [
                {
                    name: "Emotional qualities",
                    id: "emotional-qualities",
                    tags: [
                        { name: "Melancholic", id: "melancholic" },
                        { name: "Euphoric", id: "euphoric" },
                        { name: "Bittersweet", id: "bittersweet" },
                        { name: "Uplifting", id: "uplifting" },
                        { name: "Happy", id: "happy" },
                        { name: "Dreamy", id: "dreamy" },
                        { name: "Spiritual", id: "spiritual" },
                        { name: "Introspective", id: "introspective" }
                    ]
                },
                {
                    name: "Character descriptors",
                    id: "character-descriptors",
                    tags: [
                        { name: "Cheesy", id: "cheesy" },
                        { name: "Dissonant", id: "dissonant" },
                        { name: "Dark", id: "dark" },
                        { name: "Weird", id: "weird" },
                        { name: "Aggressive", id: "aggressive" },
                        { name: "Persistent", id: "persistent" },
                        { name: "Dirty", id: "dirty" },
                        { name: "Epic", id: "epic" },
                        { name: "Silly", id: "silly" },
                        { name: "Fun", id: "fun" },
                        { name: "Funky", id: "funky" }
                    ]
                },
                {
                    name: "Scene-based moods",
                    id: "scene-moods",
                    tags: [
                        { name: "Satan Lounge", id: "satan-lounge" },
                        { name: "Desert Hearts", id: "desert-hearts" },
                        { name: "Ketamine", id: "ketamine" },
                        { name: "Sex", id: "sex" },
                        { name: "Energy up", id: "energy-up" },
                        { name: "Familiar", id: "familiar" },
                        { name: "Feel", id: "feel" }
                    ]
                }
            ]
        },
        {
            name: "Sound Elements",
            id: "sound-elements",
            subcategories: [
                {
                    name: "Vocals",
                    id: "vocals",
                    tags: [
                        { name: "Female vocal", id: "f-vocal" },
                        { name: "Male vocal", id: "m-vocal" },
                        { name: "Sporadic vocals", id: "v-sporadic" },
                        { name: "Continuous vocals", id: "v-continuous" },
                        { name: "Spoken word", id: "spoken-word" },
                        { name: "Spiritual vocals", id: "vocal-spiritual" },
                        { name: "Ethereal vocals", id: "vocal-ethereal" },
                        { name: "Abstract vocals", id: "vocal-abstract" },
                        { name: "African vocals", id: "vocal-african" },
                        { name: "Whisper vocals", id: "vocal-whisper" },
                        { name: "Rap", id: "rap" }
                    ]
                },
                {
                    name: "Pads",
                    id: "pads",
                    tags: [
                        { name: "Atmospheric pads", id: "atmospheric-pads" },
                        { name: "Evolving pads", id: "evolving-pads" },
                        { name: "Cold digital pads", id: "cold-digital-pads" },
                        { name: "Ethereal pads", id: "ethereal-pads" },
                        { name: "Dark pads", id: "dark-pads" }
                    ]
                },
                {
                    name: "Bass",
                    id: "bass",
                    tags: [
                        { name: "Groovy bassline", id: "groovy-bassline" },
                        { name: "Rolling bass", id: "rolling-bass" },
                        { name: "Sub bass", id: "sub-bass" },
                        { name: "Melodic bass", id: "melodic-bass" },
                        { name: "Plucked bass", id: "plucked-bass" },
                        { name: "Arpeggiated bass", id: "arpeggiated-bass" },
                        { name: "Dub bass", id: "dub-bass" }
                    ]
                },
                {
                    name: "Drums",
                    id: "drums",
                    tags: [
                        { name: "Tribal drums", id: "tribal-drums" },
                        { name: "Organic drums", id: "organic-drums" },
                        { name: "808", id: "808" },
                        { name: "Minimal drums", id: "minimal-drums" },
                        { name: "Percussion heavy", id: "percussion-heavy" },
                        { name: "Hi-hat driven", id: "hi-hat-driven" },
                        { name: "Kick focused", id: "kick-focused" }
                    ]
                },
                {
                    name: "Synths",
                    id: "synths",
                    tags: [
                        { name: "Plucky leads", id: "plucky-leads" },
                        { name: "String pads", id: "string-pads" },
                        { name: "Classic arps", id: "classic-arps" },
                        { name: "Big stabs", id: "big-stabs" },
                        { name: "Futuristic synths", id: "futuristic-synths" }
                    ]
                },
                {
                    name: "Instruments",
                    id: "instruments",
                    tags: [
                        { name: "Piano", id: "piano" },
                        { name: "Acoustic guitar", id: "acoustic-guitar" },
                        { name: "Electric guitar", id: "electric-guitar" },
                        { name: "Brass", id: "brass" }
                    ]
                },
                {
                    name: "Production techniques",
                    id: "production-techniques",
                    tags: [
                        { name: "Bouncy", id: "bouncy" },
                        { name: "Broken/glitch", id: "broken-glitch" },
                        { name: "Loopy", id: "loopy" },
                        { name: "Punchy", id: "punchy" },
                        { name: "Reverb wash", id: "reverb-wash" },
                        { name: "Sidechain", id: "sidechain" },
                        { name: "Field recordings", id: "field-recordings" },
                        { name: "Acid lines", id: "acid-lines" }
                    ]
                }
            ]
        },
        {
            name: "Functional Roles",
            id: "functional-roles",
            subcategories: [
                {
                    name: "Set placement",
                    id: "set-placement",
                    tags: [
                        { name: "Opener", id: "opener" },
                        { name: "Peak time", id: "peak-time" },
                        { name: "Closer", id: "closer" },
                        { name: "AM sunrise", id: "am-sunrise" },
                        { name: "AM night", id: "am-night" },
                        { name: "Daytime", id: "daytime" },
                        { name: "Lounge", id: "lounge" }
                    ]
                },
                {
                    name: "Transitional function",
                    id: "transitional-function",
                    tags: [
                        { name: "Energy shifter", id: "energy-shifter" },
                        { name: "Genre bridge", id: "genre-bridge" },
                        { name: "Builder", id: "builder" },
                        { name: "Build down", id: "build-down" }
                    ]
                },
                {
                    name: "Mixing characteristics",
                    id: "mixing-characteristics",
                    tags: [
                        { name: "Long intro", id: "long-intro" },
                        { name: "Dramatic break", id: "dramatic-break" }
                    ]
                }
            ]
        }
    ],
    tracks: {}
};

// Storage key for tag data in local storage
const STORAGE_KEY = "tagmaster:tagData";

export function useTagData() {
    // State to hold our tag data
    const [tagData, setTagData] = useState<TagDataStructure>(defaultTagData);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Helper function to save to localStorage
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

    // Helper function to load from localStorage
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

    // Load tag data
    const loadTagData = () => {
        setIsLoading(true);

        // Try loading from localStorage
        const localData = loadFromLocalStorage();
        if (localData && localData.categories && Array.isArray(localData.categories)) {
            setTagData(localData);
            setLastSaved(new Date());
            console.log("TagMaster: Loaded data from localStorage");
        } else {
            // If no data in localStorage or data is invalid, use default
            setTagData(defaultTagData);
            console.log("TagMaster: Initialized with default data");
            // Save the default data to localStorage to prevent future issues
            saveToLocalStorage(defaultTagData);
        }

        setIsLoading(false);
    };

    // Save tag data
    const saveTagData = (data: TagDataStructure) => {
        const saved = saveToLocalStorage(data);
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
        console.log("Loading tag data...");
        loadTagData();
        console.log("Tag data loading complete");
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

    // CATEGORY MANAGEMENT

    // Add a new main category
    const addCategory = (name: string) => {
        // Get existing category IDs
        const existingCategoryIds = tagData.categories.map(c => c.id);

        // Generate ID and ensure it's unique
        const baseId = generateIdFromName(name);
        const uniqueId = ensureUniqueId(baseId, existingCategoryIds);

        const newCategory: Category = {
            name,
            id: uniqueId,
            subcategories: []
        };

        setTagData({
            ...tagData,
            categories: [...tagData.categories, newCategory]
        });
    };

    // Remove a main category
    const removeCategory = (categoryId: string) => {
        // Create updated categories without the removed one
        const updatedCategories = tagData.categories.filter(
            category => category.id !== categoryId
        );

        // Remove tags from this category from all tracks
        const updatedTracks = { ...tagData.tracks };
        Object.keys(updatedTracks).forEach(uri => {
            updatedTracks[uri] = {
                ...updatedTracks[uri],
                tags: updatedTracks[uri].tags.filter(tag => tag.categoryId !== categoryId)
            };
        });

        setTagData({
            categories: updatedCategories,
            tracks: updatedTracks
        });
    };

    // Rename a main category
    const renameCategory = (categoryId: string, newName: string) => {
        const updatedCategories = tagData.categories?.map(category =>
            category.id === categoryId ? { ...category, name: newName } : category
        );

        setTagData({
            ...tagData,
            categories: updatedCategories
        });
    };

    // SUBCATEGORY MANAGEMENT

    // Add a new subcategory to a main category
    const addSubcategory = (categoryId: string, name: string) => {
        // Find the category first
        const category = tagData.categories.find(c => c.id === categoryId);
        if (!category) return;

        // Get existing subcategory IDs in this category
        const existingSubcategoryIds = category.subcategories.map(s => s.id);

        // Generate ID and ensure it's unique
        const baseId = generateIdFromName(name);
        const uniqueId = ensureUniqueId(baseId, existingSubcategoryIds);

        const newSubcategory: Subcategory = {
            name,
            id: uniqueId,
            tags: []
        };

        const updatedCategories = tagData.categories?.map(category =>
            category.id === categoryId
                ? { ...category, subcategories: [...category.subcategories, newSubcategory] }
                : category
        );

        setTagData({
            ...tagData,
            categories: updatedCategories
        });
    };

    // Remove a subcategory
    const removeSubcategory = (categoryId: string, subcategoryId: string) => {
        // Update categories
        const updatedCategories = tagData.categories?.map(category => {
            if (category.id !== categoryId) return category;

            return {
                ...category,
                subcategories: category.subcategories.filter(sub => sub.id !== subcategoryId)
            };
        });

        // Remove tags from this subcategory from all tracks
        const updatedTracks = { ...tagData.tracks };
        Object.keys(updatedTracks).forEach(uri => {
            updatedTracks[uri] = {
                ...updatedTracks[uri],
                tags: updatedTracks[uri].tags.filter(tag => !(tag.categoryId === categoryId && tag.subcategoryId === subcategoryId))
            };
        });

        setTagData({
            categories: updatedCategories,
            tracks: updatedTracks
        });
    };

    // Rename a subcategory
    const renameSubcategory = (categoryId: string, subcategoryId: string, newName: string) => {
        const updatedCategories = tagData.categories?.map(category => {
            if (category.id !== categoryId) return category;

            return {
                ...category,
                subcategories: category.subcategories?.map(sub =>
                    sub.id === subcategoryId ? { ...sub, name: newName } : sub
                )
            };
        });

        setTagData({
            ...tagData,
            categories: updatedCategories
        });
    };

    // TAG MANAGEMENT

    // Add a new tag to a subcategory
    const addTag = (categoryId: string, subcategoryId: string, name: string) => {
        // Find the subcategory first
        const category = tagData.categories.find(c => c.id === categoryId);
        if (!category) return;

        const subcategory = category.subcategories.find(s => s.id === subcategoryId);
        if (!subcategory) return;

        // Get existing tag IDs in this subcategory
        const existingTagIds = subcategory.tags.map(t => t.id);

        // Generate ID and ensure it's unique
        const baseId = generateIdFromName(name);
        const uniqueId = ensureUniqueId(baseId, existingTagIds);

        const newTag: Tag = {
            name,
            id: uniqueId
        };

        const updatedCategories = tagData.categories?.map(category => {
            if (category.id !== categoryId) return category;

            return {
                ...category,
                subcategories: category.subcategories?.map(sub => {
                    if (sub.id !== subcategoryId) return sub;

                    return {
                        ...sub,
                        tags: [...sub.tags, newTag]
                    };
                })
            };
        });

        setTagData({
            ...tagData,
            categories: updatedCategories
        });
    };

    // Remove a tag
    const removeTag = (categoryId: string, subcategoryId: string, tagId: string) => {
        // Update categories
        const updatedCategories = tagData.categories?.map(category => {
            if (category.id !== categoryId) return category;

            return {
                ...category,
                subcategories: category.subcategories?.map(sub => {
                    if (sub.id !== subcategoryId) return sub;

                    return {
                        ...sub,
                        tags: sub.tags.filter(tag => tag.id !== tagId)
                    };
                })
            };
        });

        // Remove this tag from all tracks
        const updatedTracks = { ...tagData.tracks };
        Object.keys(updatedTracks).forEach(uri => {
            updatedTracks[uri] = {
                ...updatedTracks[uri],
                tags: updatedTracks[uri].tags.filter(tag =>
                    !(tag.categoryId === categoryId && tag.subcategoryId === subcategoryId && tag.tagId === tagId)
                )
            };
        });

        setTagData({
            categories: updatedCategories,
            tracks: updatedTracks
        });
    };

    // Rename a tag
    const renameTag = (categoryId: string, subcategoryId: string, tagId: string, newName: string) => {
        const updatedCategories = tagData.categories?.map(category => {
            if (category.id !== categoryId) return category;

            return {
                ...category,
                subcategories: category.subcategories?.map(sub => {
                    if (sub.id !== subcategoryId) return sub;

                    return {
                        ...sub,
                        tags: sub.tags.map(tag =>
                            tag.id === tagId ? { ...tag, name: newName } : tag
                        )
                    };
                })
            };
        });

        setTagData({
            ...tagData,
            categories: updatedCategories
        });
    };

    // TRACK TAG MANAGEMENT

    // Ensure track data exists for a given URI
    const ensureTrackData = (trackUri: string) => {
        if (!tagData.tracks[trackUri]) {
            // Create a new track data structure
            const newTagData = {
                ...tagData,
                tracks: {
                    ...tagData.tracks,
                    [trackUri]: {
                        rating: 0, // Initialize with no rating
                        energy: 0, // Initialize with no energy level
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
    const toggleTrackTag = (trackUri: string, categoryId: string, subcategoryId: string, tagId: string) => {
        // Ensure track data exists
        const currentData = ensureTrackData(trackUri);
        const trackData = currentData.tracks[trackUri];

        // Find if tag already exists
        const existingTagIndex = trackData.tags.findIndex(t =>
            t.categoryId === categoryId && t.subcategoryId === subcategoryId && t.tagId === tagId
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
            updatedTags = [...trackData.tags, { categoryId, subcategoryId, tagId }];
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

    // Set rating for a track (0 means no rating)
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

    // Set energy level for a track (0 means no energy rating)
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

    // Helper function to find tag name by ids
    const findTagName = (categoryId: string, subcategoryId: string, tagId: string): string => {
        const category = tagData.categories.find(c => c.id === categoryId);
        if (!category) return "";

        const subcategory = category.subcategories.find(s => s.id === subcategoryId);
        if (!subcategory) return "";

        const tag = subcategory.tags.find(t => t.id === tagId);
        return tag ? tag.name : "";
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
            // Skip tracks that have no meaningful data
            if (data.rating === 0 && data.energy === 0 && (!data.tags || data.tags.length === 0)) {
                return;
            }

            const trackId = uri.split(':').pop() || uri;

            // Build tag names array for comments
            const tagNames = data.tags.map(tag =>
                findTagName(tag.categoryId, tag.subcategoryId, tag.tagId)
            ).filter(name => name !== "");

            // Format energy level for comment (only include if set)
            const energyComment = data.energy > 0 ? `Energy ${data.energy} - ` : '';

            // Format for Rekordbox
            exportResult.tracks[trackId] = {
                rating: data.rating,
                energy: data.energy,
                tags: data.tags.map(tag => ({
                    categoryId: tag.categoryId,
                    subcategoryId: tag.subcategoryId,
                    tagId: tag.tagId,
                    name: findTagName(tag.categoryId, tag.subcategoryId, tag.tagId)
                })),
                rekordbox_comment: tagNames.length > 0
                    ? `${energyComment}${tagNames.join(', ')}`
                    : energyComment.length > 0 ? energyComment.slice(0, -3) : '' // Remove trailing " - " if no tags
            };
        });

        return exportResult;
    };

    // Find tag in hierarchy by IDs
    const getTagInfo = (categoryId: string, subcategoryId: string, tagId: string) => {
        const category = tagData.categories.find(c => c.id === categoryId);
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

    // Return hook functions and data
    return {
        tagData,
        isLoading,
        lastSaved,

        // Track tag management
        toggleTrackTag,
        setRating,
        setEnergy,

        // Category management
        addCategory,
        removeCategory,
        renameCategory,

        // Subcategory management
        addSubcategory,
        removeSubcategory,
        renameSubcategory,

        // Tag management
        addTag,
        removeTag,
        renameTag,

        // Helpers
        getTagInfo,

        // Import/Export
        exportData,
        exportBackup,
        importBackup
    };
}