import React, { useState } from "react";
import styles from "./TagManager.module.css";

interface TagManagerProps {
    tagCategories: { [category: string]: string[] };
    onClose: () => void;
    onAddTag: (category: string, tag: string) => void;
    onRemoveTag: (trackUri: string, tag: string, category: string) => void;
    onRenameTag: (category: string, oldTag: string, newTag: string) => void;
    onAddCategory: (category: string) => void;
    onRemoveCategory: (category: string) => void;
    onRenameCategory: (oldCategory: string, newCategory: string) => void;
}

const TagManager: React.FC<TagManagerProps> = ({
    tagCategories,
    onClose,
    onAddTag,
    onRemoveTag,
    onRenameTag,
    onAddCategory,
    onRemoveCategory,
    onRenameCategory
}) => {
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newTagInputs, setNewTagInputs] = useState<{ [category: string]: string }>({});

    // Set up new tag inputs for each category
    React.useEffect(() => {
        const inputs: { [category: string]: string } = {};
        Object.keys(tagCategories).forEach(category => {
            inputs[category] = "";
        });
        setNewTagInputs(inputs);
    }, [tagCategories]);

    // Update new tag input for a category
    const handleTagInputChange = (category: string, value: string) => {
        setNewTagInputs({
            ...newTagInputs,
            [category]: value
        });
    };

    // Handle adding a new tag to a category
    const handleAddTag = (category: string) => {
        const newTag = newTagInputs[category].trim();
        if (newTag && !tagCategories[category].includes(newTag)) {
            onAddTag(category, newTag);
            // Clear input after adding
            handleTagInputChange(category, "");
        }
    };

    // Handle adding a new category
    const handleAddCategory = () => {
        const category = newCategoryName.trim();
        if (category && !tagCategories[category]) {
            onAddCategory(category);
            setNewCategoryName("");
        }
    };

    // Handle removing a tag from a category
    const handleRemoveTag = (tag: string, category: string) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete the tag "${tag}"?`);
        if (confirmDelete) {
            // Pass empty string for trackUri to indicate global removal
            onRemoveTag("", tag, category);
        }
    };

    // Handle removing a category
    const handleRemoveCategory = (category: string) => {
        const confirmDelete = window.confirm(
            `Are you sure you want to delete the category "${category}" and all its tags?`
        );
        if (confirmDelete) {
            onRemoveCategory(category);
        }
    };

    // Handle renaming a tag
    const handleRenameTag = (tag: string, category: string) => {
        const newName = window.prompt(`Enter new name for tag "${tag}":`, tag);
        if (newName && newName.trim() && newName !== tag) {
            onRenameTag(category, tag, newName.trim());
        }
    };

    // Handle renaming a category
    const handleRenameCategory = (category: string) => {
        const newName = window.prompt(`Enter new name for category "${category}":`, category);
        if (newName && newName.trim() && newName !== category) {
            onRenameCategory(category, newName.trim());
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>Manage Tags</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.modalBody}>
                    {Object.entries(tagCategories).map(([category, tags]) => (
                        <div key={category} className={styles.categorySection}>
                            <div className={styles.categoryHeader}>
                                <h3 className={styles.categoryTitle}>{category}</h3>
                                <div className={styles.categoryActions}>
                                    <button
                                        className={styles.actionButton}
                                        onClick={() => handleRenameCategory(category)}
                                    >
                                        Rename
                                    </button>
                                    <button
                                        className={`${styles.actionButton} ${styles.deleteButton}`}
                                        onClick={() => handleRemoveCategory(category)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>

                            <div className={styles.tagList}>
                                {tags.map(tag => (
                                    <div key={`${category}-${tag}`} className={styles.tagItem}>
                                        <span className={styles.tagName}>{tag}</span>
                                        <div className={styles.tagActions}>
                                            <button
                                                className={styles.tagAction}
                                                onClick={() => handleRenameTag(tag, category)}
                                            >
                                                Rename
                                            </button>
                                            <button
                                                className={`${styles.tagAction} ${styles.tagDelete}`}
                                                onClick={() => handleRemoveTag(tag, category)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className={styles.addTagForm}>
                                <input
                                    type="text"
                                    placeholder="New tag..."
                                    value={newTagInputs[category] || ""}
                                    onChange={(e) => handleTagInputChange(category, e.target.value)}
                                    className={styles.tagInput}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddTag(category);
                                    }}
                                />
                                <button
                                    className={styles.addButton}
                                    onClick={() => handleAddTag(category)}
                                >
                                    Add Tag
                                </button>
                            </div>
                        </div>
                    ))}

                    <div className={styles.addCategorySection}>
                        <h3 className={styles.sectionTitle}>Add New Category</h3>
                        <div className={styles.addCategoryForm}>
                            <input
                                type="text"
                                placeholder="New category name..."
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className={styles.categoryInput}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddCategory();
                                }}
                            />
                            <button
                                className={styles.addButton}
                                onClick={handleAddCategory}
                            >
                                Add Category
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TagManager;