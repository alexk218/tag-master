import React, { useState, useEffect } from "react";
import styles from "./TrackList.module.css";

interface Tag {
  tag: string;
  category: string;
}

interface TrackData {
  rating: number; // 0 means no rating
  energy: number; // 0 means no energy level
  tags: Tag[];
}

interface TracksObject {
  [uri: string]: TrackData;
}

interface SpotifyTrackInfo {
  name: string;
  artists: string;
  albumName: string;
}

interface TrackListProps {
  tracks: TracksObject;
  onSelectTrack: (uri: string) => void;
  onTagTrack?: (uri: string) => void; // New prop for tagging tracks directly
}

const TrackList: React.FC<TrackListProps> = ({ tracks, onSelectTrack, onTagTrack }) => {
  const [trackInfo, setTrackInfo] = useState<{ [uri: string]: SpotifyTrackInfo }>({});
  const [searchTerm, setSearchTerm] = useState("");

  // Advanced filtering states
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [ratingFilters, setRatingFilters] = useState<number[]>([]);
  const [energyMinFilter, setEnergyMinFilter] = useState<number | null>(null);
  const [energyMaxFilter, setEnergyMaxFilter] = useState<number | null>(null);
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const [isOrFilterMode, setIsOrFilterMode] = useState(false);

  // Fetch track info from Spotify on component mount and when tracks change
  useEffect(() => {
    const fetchTrackInfo = async () => {
      const trackUris = Object.keys(tracks);
      console.log("Fetching info for tracks:", trackUris.length);

      if (trackUris.length === 0) {
        console.log("No tracks to fetch info for");
        return;
      }

      const newTrackInfo: { [uri: string]: SpotifyTrackInfo } = {};

      // Process tracks in batches of 20
      for (let i = 0; i < trackUris.length; i += 20) {
        const batch = trackUris.slice(i, i + 20);
        console.log(`Processing batch ${i / 20 + 1}, size ${batch.length}`);

        try {
          // Extract track IDs from URIs
          const trackIds = batch.map(uri => {
            const parts = uri.split(':');
            return parts.length >= 3 && parts[1] === 'track' ? parts[2] : null;
          }).filter(Boolean);

          if (trackIds.length === 0) {
            console.log("No valid track IDs in this batch");
            continue;
          }

          // Fetch track info
          const response = await Spicetify.CosmosAsync.get(
            `https://api.spotify.com/v1/tracks?ids=${trackIds.join(',')}`
          );

          if (response && response.tracks) {
            // Process the response
            response.tracks.forEach((track: any) => {
              if (track && track.id) {
                // Find the original URI for this track
                const uri = batch.find(u => u.includes(track.id));
                if (uri) {
                  newTrackInfo[uri] = {
                    name: track.name,
                    artists: track.artists.map((a: any) => a.name).join(", "),
                    albumName: track.album?.name || "Unknown Album"
                  };
                }
              }
            });
          } else {
            console.warn("Invalid response from Spotify API:", response);
          }
        } catch (error) {
          console.error("Error fetching track info for batch:", error);
        }
      }

      console.log("Track info fetched:", Object.keys(newTrackInfo).length, "tracks");
      setTrackInfo(newTrackInfo);
    };

    if (Object.keys(tracks).length > 0) {
      fetchTrackInfo();
    } else {
      console.log("No tracks available to fetch info for");
    }
  }, [tracks]);

  // Extract all unique tags from all tracks
  const allTags = new Set<string>();
  Object.values(tracks).forEach(track => {
    track.tags.forEach(({ tag }) => {
      allTags.add(tag);
    });
  });

  // Extract all possible rating values
  const allRatings = new Set<number>();
  Object.values(tracks).forEach(track => {
    if (track.rating > 0) {
      allRatings.add(track.rating);
    }
  });

  // Extract all possible energy values
  const allEnergyLevels = new Set<number>();
  Object.values(tracks).forEach(track => {
    if (track.energy > 0) {
      allEnergyLevels.add(track.energy);
    }
  });

  // Toggle a tag filter
  const toggleTagFilter = (tag: string) => {
    setActiveTagFilters(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Toggle a rating filter - now adds/removes from array
  const toggleRatingFilter = (rating: number) => {
    setRatingFilters(prev =>
      prev.includes(rating)
        ? prev.filter(r => r !== rating)
        : [...prev, rating]
    );
  };

  const handleTagClick = (tag: string) => {
    // Toggle the tag in filters
    setActiveTagFilters(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag) // Remove if already in filters
        : [...prev, tag]              // Add if not in filters
    );

    // If filter options are not visible and we're adding a filter, show them
    if (!showFilterOptions && !activeTagFilters.includes(tag)) {
      setShowFilterOptions(true);
    }
  };

  // Handle energy range filtering
  const handleEnergyMinChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value === "" ? null : parseInt(event.target.value);
    setEnergyMinFilter(value);

    // If max is less than min, adjust max
    if (value !== null && energyMaxFilter !== null && value > energyMaxFilter) {
      setEnergyMaxFilter(value);
    }
  };

  const handleEnergyMaxChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value === "" ? null : parseInt(event.target.value);
    setEnergyMaxFilter(value);

    // If min is greater than max, adjust min
    if (value !== null && energyMinFilter !== null && energyMinFilter > value) {
      setEnergyMinFilter(value);
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
    setActiveTagFilters([]);
    setRatingFilters([]);
    setEnergyMinFilter(null);
    setEnergyMaxFilter(null);
  };

  // Filter tracks based on all applied filters
  const filteredTracks = Object.entries(tracks).filter(([uri, trackData]) => {
    const info = trackInfo[uri];

    // Skip if we don't have info for this track yet
    if (!info) {
      return false;
    }

    // Search term filter
    const matchesSearch =
      searchTerm === "" ||
      info.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      info.artists.toLowerCase().includes(searchTerm.toLowerCase());

    // Tag filters - track must have ALL selected tags
    const matchesTags =
      activeTagFilters.length === 0 ||
      (isOrFilterMode
        // OR logic - track must have ANY of the selected tags
        ? activeTagFilters.some(tag =>
          trackData.tags.some(t => t.tag === tag)
        )
        // AND logic - track must have ALL of the selected tags
        : activeTagFilters.every(tag =>
          trackData.tags.some(t => t.tag === tag)
        )
      );

    // Rating filter - Updated to check if track rating is in the ratingFilters array
    const matchesRating =
      ratingFilters.length === 0 ||
      (trackData.rating > 0 && ratingFilters.includes(trackData.rating));

    // Energy range filter
    const matchesEnergyMin =
      energyMinFilter === null ||
      trackData.energy >= energyMinFilter;

    const matchesEnergyMax =
      energyMaxFilter === null ||
      trackData.energy <= energyMaxFilter;

    return matchesSearch && matchesTags && matchesRating && matchesEnergyMin && matchesEnergyMax;
  });

  // Sort filtered tracks by track name
  const sortedTracks = [...filteredTracks].sort((a, b) => {
    const infoA = trackInfo[a[0]];
    const infoB = trackInfo[b[0]];

    if (!infoA || !infoB) return 0;

    // Sort by track name
    return infoA.name.localeCompare(infoB.name);
  });

  // Calculate active filter count for badge
  const activeFilterCount =
    activeTagFilters.length +
    (ratingFilters.length > 0 ? 1 : 0) +
    (energyMinFilter !== null || energyMaxFilter !== null ? 1 : 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>Tagged Tracks</h2>
          <span className={styles.trackCount}>
            {sortedTracks.length} / {Object.keys(tracks).length} tracks
            {activeFilterCount > 0 && " (filtered)"}
          </span>
        </div>
        <div className={styles.searchBox}>
          {/* Search input stays the same */}
        </div>
      </div>

      <div className={styles.filterControls}>
        <button
          className={styles.filterToggle}
          onClick={() => setShowFilterOptions(!showFilterOptions)}
        >
          Filters {activeFilterCount > 0 && <span className={styles.filterBadge}>{activeFilterCount}</span>}
        </button>

        {activeFilterCount > 0 && (
          <>
            <div className={styles.filterModeToggle}>
              <span className={styles.filterModeLabel}>Match:</span>
              <button
                className={`${styles.filterModeButton} ${!isOrFilterMode ? styles.activeFilterMode : ''}`}
                onClick={() => setIsOrFilterMode(false)}
                title="Tracks must match ALL selected filters (AND logic)"
              >
                ALL
              </button>
              <button
                className={`${styles.filterModeButton} ${isOrFilterMode ? styles.activeFilterMode : ''}`}
                onClick={() => setIsOrFilterMode(true)}
                title="Tracks must match ANY selected filter (OR logic)"
              >
                ANY
              </button>
            </div>

            <button
              className={styles.clearFilters}
              onClick={clearAllFilters}
            >
              Clear All
            </button>
          </>
        )}
      </div>

      {showFilterOptions && (
        <div className={styles.filterOptions}>
          {allRatings.size > 0 && (
            <div className={styles.filterSection}>
              <h3 className={styles.filterSectionTitle}>Rating</h3>
              <div className={styles.ratingFilters}>
                {Array.from(allRatings).sort((a, b) => b - a).map(rating => (
                  <button
                    key={`rating-${rating}`}
                    className={`${styles.ratingFilter} ${ratingFilters.includes(rating) ? styles.active : ''}`}
                    onClick={() => toggleRatingFilter(rating)}
                  >
                    {Array(rating).fill(0).map((_, i) => (
                      <span key={i} className={styles.filterStar}>★</span>
                    ))}
                  </button>
                ))}
              </div>
            </div>
          )}

          {allEnergyLevels.size > 0 && (
            <div className={styles.filterSection}>
              <h3 className={styles.filterSectionTitle}>Energy Level</h3>
              <div className={styles.energyRangeFilter}>
                <div className={styles.rangeControl}>
                  <label className={styles.rangeLabel}>From:</label>
                  <select
                    value={energyMinFilter === null ? "" : energyMinFilter.toString()}
                    onChange={handleEnergyMinChange}
                    className={styles.rangeSelect}
                  >
                    <option value="">Any</option>
                    {Array.from(allEnergyLevels).sort((a, b) => a - b).map(energy => (
                      <option key={`min-${energy}`} value={energy}>{energy}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.rangeControl}>
                  <label className={styles.rangeLabel}>To:</label>
                  <select
                    value={energyMaxFilter === null ? "" : energyMaxFilter.toString()}
                    onChange={handleEnergyMaxChange}
                    className={styles.rangeSelect}
                  >
                    <option value="">Any</option>
                    {Array.from(allEnergyLevels).sort((a, b) => a - b).map(energy => (
                      <option key={`max-${energy}`} value={energy}>{energy}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {allTags.size > 0 && (
            <div className={styles.filterSection}>
              <h3 className={styles.filterSectionTitle}>Tags</h3>
              <div className={styles.tagFilters}>
                {Array.from(allTags).sort().map(tag => (
                  <button
                    key={tag}
                    className={`${styles.tagFilter} ${activeTagFilters.includes(tag) ? styles.active : ''}`}
                    onClick={() => toggleTagFilter(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.trackList}>
        {sortedTracks.length === 0 ? (
          <p className={styles.noTracks}>
            {Object.keys(tracks).length === 0
              ? "No tagged tracks yet. Start tagging your favorite tracks!"
              : "No tracks match your filters."}
          </p>
        ) : (
          sortedTracks.map(([uri, data]) => {
            const info = trackInfo[uri];
            if (!info) return null;

            return (
              <div
                key={uri}
                className={styles.trackItem}
              >
                {/* Track info section - title and artist + buttons at top */}
                <div className={styles.trackItemInfo}>
                  {/* Track title and artist on left */}
                  <div className={styles.trackItemTextInfo}>
                    <span className={styles.trackItemTitle}>{info.name}</span>
                    <span className={styles.trackItemArtist}>{info.artists}</span>
                  </div>

                  {/* Action buttons now positioned at top right */}
                  <div className={styles.trackItemActions}>
                    <button
                      className={styles.actionButton}
                      onClick={() => onSelectTrack(uri)}
                      title="Play this track"
                    >
                      Play
                    </button>

                    {onTagTrack && (
                      <button
                        className={styles.actionButton}
                        onClick={() => onTagTrack(uri)}
                        title="Edit tags for this track"
                      >
                        Tag
                      </button>
                    )}
                  </div>
                </div>

                {/* New layout with two-row metadata section */}
                <div className={styles.trackItemMetaContainer}>
                  {/* Top row with fixed elements and action buttons */}
                  <div className={styles.trackItemMetaTop}>
                    <div className={styles.trackItemFixedMeta}>
                      {data.rating > 0 && (
                        <div className={styles.trackItemRating}>
                          {Array(5).fill(0).map((_, i) => (
                            <span
                              key={i}
                              className={`${styles.miniStar} ${i < data.rating ? styles.active : ''}`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      )}

                      {data.energy > 0 && (
                        <div className={styles.trackItemEnergy}>{data.energy}</div>
                      )}
                    </div>
                  </div>

                  {/* Bottom row just for tags that can wrap */}
                  {data.tags.length > 0 ? (
                    <div className={styles.trackItemTags}>
                      {data.tags.map(({ tag }, i) => (
                        <span
                          key={i}
                          className={`${styles.trackItemTag} ${activeTagFilters.includes(tag) ? styles.activeTagFilter : ''}`}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent track item click
                            handleTagClick(tag);
                          }}
                          title={activeTagFilters.includes(tag)
                            ? `Remove "${tag}" filter`
                            : `Filter by "${tag}"`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.trackItemTags}>
                      <span className={styles.noTags}>No tags</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TrackList;