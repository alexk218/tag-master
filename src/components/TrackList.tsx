import React, { useState, useEffect } from "react";
import styles from "./TrackList.module.css";
import { parseLocalFileUri } from "../utils/LocalFileParser";
import { Category } from "../hooks/useTagData";
import CreatePlaylistModal from "./CreatePlaylistModal";

interface Tag {
  tag: string;
  category: string;
}

interface TrackData {
  rating: number; // 0 means no rating
  energy: number; // 0 means no energy rating
  tags: Tag[];
}

interface TracksObject {
  [uri: string]: TrackData;
}

interface SpotifyTrackInfo {
  name: string;
  artists: string;
  albumName: string;
  albumUri?: string | null;
  artistsData?: Array<{ name: string, uri: string }>;
}

interface TrackListProps {
  tracks: TracksObject;
  categories: Category[];
  activeTagFilters: string[];
  onFilterByTag: (tag: string) => void;
  onSelectTrack: (uri: string) => void;
  onTagTrack?: (uri: string) => void;
  onClearTagFilters?: () => void;
  onCreatePlaylist?: (trackUris: string[], name: string, description: string, isPublic: boolean) => void;
}

const TrackList: React.FC<TrackListProps> = ({
  tracks,
  categories, // New categories prop
  activeTagFilters,
  onFilterByTag,
  onSelectTrack,
  onTagTrack,
  onClearTagFilters,
  onCreatePlaylist
}) => {
  const [trackInfo, setTrackInfo] = useState<{ [uri: string]: SpotifyTrackInfo }>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);

  // Advanced filtering states
  const [ratingFilters, setRatingFilters] = useState<number[]>([]);
  const [energyMinFilter, setEnergyMinFilter] = useState<number | null>(null);
  const [energyMaxFilter, setEnergyMaxFilter] = useState<number | null>(null);
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const [isOrFilterMode, setIsOrFilterMode] = useState(false);

  // Sort tags based on their position in the hierarchy
  // Using the same approach as in TrackDetails.tsx
  const sortTags = (tags: Tag[]) => {
    // First build an index of tag positions in the category hierarchy
    const tagPositions: { [tagName: string]: string } = {};

    // Iterate through all categories to build position mapping
    categories.forEach((category, categoryIndex) => {
      category.subcategories.forEach((subcategory, subcategoryIndex) => {
        subcategory.tags.forEach((tag, tagIndex) => {
          // Create a sortable position string (pad with zeros for correct string sorting)
          const positionKey = `${String(categoryIndex).padStart(3, '0')}-${String(subcategoryIndex).padStart(3, '0')}-${String(tagIndex).padStart(3, '0')}`;
          tagPositions[tag.name] = positionKey;
        });
      });
    });

    // Sort the tags by their positions
    return [...tags].sort((a, b) => {
      const posA = tagPositions[a.tag] || "999-999-999"; // Default to end if not found
      const posB = tagPositions[b.tag] || "999-999-999";
      return posA.localeCompare(posB);
    });
  };

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

      // Separate local files from Spotify tracks
      const localFileUris: string[] = [];
      const spotifyTrackUris: string[] = [];

      trackUris.forEach(uri => {
        if (uri.startsWith('spotify:local:')) {
          localFileUris.push(uri);
        } else if (uri.startsWith('spotify:track:')) {
          spotifyTrackUris.push(uri);
        }
      });

      console.log(`Found ${localFileUris.length} local files and ${spotifyTrackUris.length} Spotify tracks`);

      // Handle local files first
      localFileUris.forEach(uri => {
        try {
          // Use our dedicated parser to extract meaningful metadata
          const parsedLocalFile = parseLocalFileUri(uri);

          newTrackInfo[uri] = {
            name: parsedLocalFile.title,
            artists: parsedLocalFile.artist,
            albumName: parsedLocalFile.album
          };

          console.log(`Parsed local file: ${uri} -> ${parsedLocalFile.title} by ${parsedLocalFile.artist}`);
        } catch (error) {
          console.error("Error parsing local file URI:", uri, error);
          newTrackInfo[uri] = {
            name: "Local Track",
            artists: "Local Artist",
            albumName: "Local File"
          };
        }
      });

      // Process Spotify tracks in batches of 20
      for (let i = 0; i < spotifyTrackUris.length; i += 20) {
        const batch = spotifyTrackUris.slice(i, i + 20);
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
                    albumName: track.album?.name || "Unknown Album",
                    albumUri: track.album?.uri || null,
                    // Store full artist data for navigation
                    artistsData: track.artists.map((a: any) => ({
                      name: a.name,
                      uri: a.uri
                    }))
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
    onFilterByTag(tag);
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
    // Call the parent handler to toggle the filter
    onFilterByTag(tag);
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
    if (onClearTagFilters) {
      onClearTagFilters();
    }
    setRatingFilters([]);
    setEnergyMinFilter(null);
    setEnergyMaxFilter(null);
  };

  // Filter tracks based on all applied filters
  const filteredTracks = Object.entries(tracks).filter(([uri, trackData]) => {
    const info = trackInfo[uri];

    // Skip if we don't have info for this track
    // But KEEP local files even if we have no info yet
    if (!info && !uri.startsWith('spotify:local:')) {
      return false;
    }

    // If it's a local file that we don't have info for yet, keep it visible
    // This ensures local files appear while metadata is still loading
    if (!info && uri.startsWith('spotify:local:')) {
      // Only apply tag/rating/energy filters since we can't search without metadata

      // Tag filters
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

      // Rating filter
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

      // If search term is empty, then return based on other filters
      // Otherwise, hide it since we can't search on local files without metadata yet
      return searchTerm === "" && matchesTags && matchesRating && matchesEnergyMin && matchesEnergyMax;
    }

    // For tracks with info (both Spotify and loaded local files)
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

  const handleCreatePlaylist = (name: string, description: string, isPublic: boolean) => {
    if (sortedTracks.length === 0) return;

    // Extract URIs from the filtered tracks
    const trackUris = sortedTracks.map(([uri]) => uri);

    if (onCreatePlaylist) {
      onCreatePlaylist(trackUris, name, description, isPublic);
    }

    setShowCreatePlaylistModal(false);
  };

  const handleCreatePlaylistClick = () => {
    if (sortedTracks.length > 0) {
      setShowCreatePlaylistModal(true);
    }
  };

  const navigateToAlbum = (uri: string) => {
    try {
      // Check if this is a local file
      if (uri.startsWith('spotify:local:')) {
        // For local files, navigate to Local Files section
        Spicetify.Platform.History.push('/collection/local-files');
        return;
      }

      // For Spotify tracks, get the album URI
      const info = trackInfo[uri];
      if (!info) return;

      // If we have a complete trackInfo object with album ID already, use it
      if (info.albumUri) {
        const albumId = info.albumUri.split(':').pop();
        if (albumId) {
          Spicetify.Platform.History.push(`/album/${albumId}`);
          return;
        }
      }

      // Otherwise extract track ID and get album info
      const trackId = uri.split(':').pop();
      if (!trackId) return;

      // Fetch track to get album
      Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${trackId}`)
        .then(response => {
          if (response && response.album && response.album.id) {
            Spicetify.Platform.History.push(`/album/${response.album.id}`);
          }
        })
        .catch(error => {
          console.error("Error navigating to album:", error);
        });
    } catch (error) {
      console.error("Error navigating to album:", error);
    }
  };

  // Navigate to artist
  const navigateToArtist = (artistName: string, trackUri: string) => {
    try {
      // Check if this is a local file
      if (trackUri.startsWith('spotify:local:')) {
        // For local files, we can't navigate to an artist
        Spicetify.showNotification("Cannot navigate to artist for local files", true);
        return;
      }

      // Get track info to find artist
      const info = trackInfo[trackUri];
      if (!info) return;

      // If the info has an artistsData array with URIs, use it
      if (info.artistsData) {
        const artist = info.artistsData.find(a => a.name === artistName);
        if (artist && artist.uri) {
          const artistId = artist.uri.split(':').pop();
          if (artistId) {
            Spicetify.Platform.History.push(`/artist/${artistId}`);
            return;
          }
        }
      }

      // Fallback - search for the artist
      Spicetify.Platform.History.push(`/search/${encodeURIComponent(artistName)}/artists`);
    } catch (error) {
      console.error("Error navigating to artist:", error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>Tagged Tracks</h2>
          <span className={styles.trackCount}>
            {activeFilterCount > 0
              ? `${sortedTracks.length}/${Object.keys(tracks).length} tracks`
              : `${Object.keys(tracks).length} tracks`}
          </span>
        </div>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search tracks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.filterControls}>
        <button
          className={`${styles.filterToggle} ${showFilterOptions ? styles.filterToggleActive : ''}`}
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

        {/* Add Create Playlist button - always visible when there are tracks */}
        {sortedTracks.length > 0 && (
          <button
            className={styles.createPlaylistButton}
            onClick={handleCreatePlaylistClick}
            title={`Create playlist with ${sortedTracks.length} tracks`}
          >
            Create Playlist
          </button>
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
            // Handle case when info isn't available yet (especially for local files)
            const isLocalFile = uri.startsWith('spotify:local:');

            // If no info and not a local file, skip this track
            if (!info && !isLocalFile) return null;

            // For local files without info yet, create temporary display info
            let displayInfo;
            if (!info && isLocalFile) {
              // Use our parser to get better display information
              const parsedLocalFile = parseLocalFileUri(uri);
              displayInfo = {
                name: parsedLocalFile.title,
                artists: parsedLocalFile.artist,
                albumName: parsedLocalFile.album
              };
            } else {
              // Use info as is (for Spotify tracks or already parsed local files)
              displayInfo = info || {
                name: "Unknown Track",
                artists: "Unknown Artist",
                albumName: "Unknown Album"
              };
            }

            // Sort tags based on their position in the category hierarchy
            const sortedTagsArray = categories && categories.length > 0
              ? sortTags(data.tags)
              : data.tags;

            return (
              <div
                key={uri}
                className={styles.trackItem}
              >
                {/* Track info section - title and artist + buttons at top */}
                <div className={styles.trackItemInfo}>
                  {/* Track title and artist on left */}
                  <div className={styles.trackItemTextInfo}>
                    <span
                      className={`${styles.trackItemTitle} ${!isLocalFile ? styles.clickable : ''}`}
                      onClick={() => !isLocalFile && navigateToAlbum(uri)}
                      title={!isLocalFile ? "Go to album" : undefined}
                    >
                      {displayInfo.name}
                      {isLocalFile && <span style={{ fontSize: '0.8em', marginLeft: '6px', opacity: 0.7 }}>(Local)</span>}
                    </span>
                    {displayInfo.artists && displayInfo.artists !== "Local Artist" && (
                      <span className={styles.trackItemArtist}>
                        {/* Split artists and make each clickable */}
                        {!isLocalFile
                          ? displayInfo.artists.split(', ').map((artist, idx, arr) => (
                            <React.Fragment key={idx}>
                              <span
                                className={styles.clickableArtist}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToArtist(artist, uri);
                                }}
                                title={`Go to ${artist}`}
                              >
                                {artist}
                              </span>
                              {idx < arr.length - 1 && ', '}
                            </React.Fragment>
                          ))
                          : displayInfo.artists
                        }
                      </span>
                    )}
                  </div>

                  {/* Action buttons now positioned at top right */}
                  <div className={styles.trackItemActions}>
                    <button
                      className={styles.actionButton}
                      onClick={() => onSelectTrack(uri)}
                      title={isLocalFile ? "Navigate to Local Files" : "Play this track"}
                    >
                      {isLocalFile ? "Go to Local Files" : "Play"}
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
                  {sortedTagsArray.length > 0 ? (
                    <div className={styles.trackItemTags}>
                      {sortedTagsArray.map(({ tag }, i) => (
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
      {showCreatePlaylistModal && (
        <CreatePlaylistModal
          trackCount={sortedTracks.length}
          localTrackCount={sortedTracks.filter(([uri]) => uri.startsWith('spotify:local:')).length}
          tags={activeTagFilters}
          onClose={() => setShowCreatePlaylistModal(false)}
          onCreatePlaylist={handleCreatePlaylist}
        />
      )}
    </div>
  );
};

export default TrackList;