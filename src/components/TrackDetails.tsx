import React, { useEffect, useState } from "react";
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

interface TrackMetadata {
  releaseDate: string;
  trackLength: string;
  bpm: number | null;
  playCount: number | null;
  sourceContext: string | null;
  genres: string[];
}

const TrackDetails: React.FC<TrackDetailsProps> = ({
  track,
  trackData,
  categories,
  onSetRating,
  onSetEnergy,
  onRemoveTag
}) => {
  const [albumCover, setAlbumCover] = useState<string | null>(null);
  const [isLoadingCover, setIsLoadingCover] = useState(true);
  const [trackMetadata, setTrackMetadata] = useState<TrackMetadata>({
    releaseDate: '',
    trackLength: '',
    bpm: null,
    playCount: null,
    sourceContext: null,
    genres: []
  });

  // Track the context URI for navigation
  const [contextUri, setContextUri] = useState<string | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);

  // Get track artist names as a string
  const artistNames = track.artists.map(artist => artist.name).join(", ");

  // Format milliseconds to mm:ss
  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format date to YYYY-MM-DD
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';

    // Check if we only have a year
    if (dateStr.length === 4) {
      return dateStr;
    }

    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch (e) {
      return dateStr;
    }
  };

  // Fetch additional track metadata
  useEffect(() => {
    const fetchTrackMetadata = async () => {
      setIsLoadingMetadata(true);

      try {
        // Extract track ID from URI
        const trackId = track.uri.split(':').pop();

        if (!trackId) {
          console.error("Invalid track URI:", track.uri);
          setIsLoadingMetadata(false);
          return;
        }

        // Fetch track info
        const trackInfo = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${trackId}`);

        // Fetch audio features for tempo (BPM)
        const audioFeatures = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/audio-features/${trackId}`);

        // Try to get source context from Spicetify
        let sourceContext = null;
        try {
          if (Spicetify.Player && Spicetify.Player.data && Spicetify.Player.data.context) {
            const playerContextUri = Spicetify.Player.data.context.uri;

            if (playerContextUri) {
              // Store the context URI for navigation
              setContextUri(playerContextUri);

              // Parse the context URI
              const parts = playerContextUri.split(':');
              if (parts.length >= 3) {
                const contextType = parts[1];
                let contextName = '';

                // Special case for Liked Songs (collection)
                if (contextType === 'collection' && parts.includes('tracks')) {
                  contextName = 'Liked Songs';
                } else if (contextType === 'playlist') {
                  try {
                    const playlistData = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/playlists/${parts[2]}`);
                    contextName = playlistData.name || '';
                  } catch (e) {
                    contextName = 'Playlist';
                  }
                } else if (contextType === 'album') {
                  contextName = track.album.name;
                } else if (contextType === 'artist') {
                  contextName = artistNames.split(',')[0];
                } else if (contextType === 'user') {
                  contextName = 'Liked Songs'; // Default for user context is often Liked Songs
                }

                // Simply use the context name without the type prefix
                sourceContext = contextName;
              }
            }
          }
        } catch (e) {
          console.error("Error getting source context:", e);
        }

        // Try to get artist genres
        const artistId = trackInfo.artists[0]?.id;
        let genres: string[] = [];

        if (artistId) {
          try {
            const artistInfo = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/artists/${artistId}`);
            genres = artistInfo.genres || [];
          } catch (e) {
            console.error("Error fetching artist info:", e);
          }
        }

        setTrackMetadata({
          releaseDate: formatDate(trackInfo.album?.release_date || ''),
          trackLength: formatDuration(trackInfo.duration_ms || 0),
          bpm: audioFeatures?.tempo ? Math.round(audioFeatures.tempo) : null,
          playCount: null, // Not directly available from Spotify API
          sourceContext,
          genres: genres.slice(0, 3) // Limit to top 3 genres
        });

      } catch (error) {
        console.error("Error fetching track metadata:", error);

        // Set minimal metadata for error cases
        setTrackMetadata({
          releaseDate: '',
          trackLength: '',
          bpm: null,
          playCount: null,
          sourceContext: null,
          genres: []
        });
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    if (track.uri) {
      fetchTrackMetadata();
    }
  }, [track.uri, track.album.name, artistNames]);

  // Fetch album cover when track changes
  useEffect(() => {
    const fetchAlbumCover = async () => {
      setIsLoadingCover(true);

      try {
        // Check if this is a local file
        if (track.uri.startsWith('spotify:local:')) {
          // For local files, we don't have album art from Spotify
          // Set a null album cover to show the placeholder
          setAlbumCover(null);
          setIsLoadingCover(false);
          return;
        }

        // Extract track ID from URI for Spotify tracks
        const trackId = track.uri.split(':').pop();

        if (!trackId) {
          console.error("Invalid track URI:", track.uri);
          setIsLoadingCover(false);
          return;
        }

        // Fetch track info to get album ID and cover
        const trackInfo = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${trackId}`);

        if (trackInfo && trackInfo.album && trackInfo.album.images && trackInfo.album.images.length > 0) {
          // Get medium size image (or the first available if medium doesn't exist)
          const image = trackInfo.album.images.find((img: any) => img.height === 300) || trackInfo.album.images[0];
          setAlbumCover(image.url);
        } else {
          setAlbumCover(null);
        }
      } catch (error) {
        console.error("Error fetching album cover:", error);
        setAlbumCover(null);
      } finally {
        setIsLoadingCover(false);
      }
    };

    if (track.uri) {
      fetchAlbumCover();
    }
  }, [track.uri]);;

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

  // Handle removing rating
  const handleRemoveRating = () => {
    onSetRating(0);
  };

  // Handle removing energy rating
  const handleRemoveEnergy = () => {
    onSetEnergy(0);
  };

  // Navigation functions
  const navigateToAlbum = () => {
    try {
      // Check if this is a local file first
      if (track.uri.startsWith('spotify:local:')) {
        // For local files, try to navigate to Local Files section
        Spicetify.Platform.History.push('/collection/local-files');
        return;
      }

      // Extract album URI from track data or try to build it
      let albumUri = '';

      // Try to extract from track info if available
      if (Spicetify.Player && Spicetify.Player.data && Spicetify.Player.data.track && Spicetify.Player.data.track.album && Spicetify.Player.data.track.album.uri) {
        albumUri = Spicetify.Player.data.track.album.uri;
      } else {
        // Try to extract album ID from track URI and build album URI
        const trackId = track.uri.split(':').pop();
        if (trackId) {
          // We'll need to use Spotify API to get the album ID
          Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${trackId}`)
            .then(response => {
              if (response && response.album && response.album.id) {
                const albumId = response.album.id;
                albumUri = `spotify:album:${albumId}`;

                // Navigate to album page
                Spicetify.Platform.History.push(`/album/${albumId}`);
              }
            })
            .catch(error => {
              console.error("Error fetching album info:", error);
              Spicetify.showNotification("Couldn't navigate to album", true);
            });
          return; // Exit early as we're using async approach
        }
      }

      if (albumUri) {
        // Extract album ID from URI
        const albumId = albumUri.split(':').pop();
        if (albumId) {
          // Navigate to album page
          Spicetify.Platform.History.push(`/album/${albumId}`);
        }
      } else {
        console.error("Could not determine album URI");
        Spicetify.showNotification("Couldn't navigate to album", true);
      }
    } catch (error) {
      console.error("Error navigating to album:", error);
      Spicetify.showNotification("Error navigating to album", true);
    }
  };

  // Navigate to context (playlist, album, etc.)
  const navigateToContext = () => {
    if (!contextUri) {
      Spicetify.showNotification("No context available to navigate to", true);
      return;
    }

    try {
      // Parse context URI
      const parts = contextUri.split(':');
      if (parts.length < 3) {
        Spicetify.showNotification("Invalid context URI", true);
        return;
      }

      const contextType = parts[1];
      const contextId = parts[2];

      // Navigate based on context type
      switch (contextType) {
        case 'playlist':
          Spicetify.Platform.History.push(`/playlist/${contextId}`);
          break;
        case 'album':
          Spicetify.Platform.History.push(`/album/${contextId}`);
          break;
        case 'artist':
          Spicetify.Platform.History.push(`/artist/${contextId}`);
          break;
        case 'show':
          Spicetify.Platform.History.push(`/show/${contextId}`);
          break;
        case 'collection':
          // Special case for Liked Songs
          if (parts.includes('tracks')) {
            Spicetify.Platform.History.push('/collection/tracks');
          }
          break;
        case 'user':
          // For user context, likely Liked Songs
          Spicetify.Platform.History.push('/collection/tracks');
          break;
        default:
          console.log(`Unsupported context type: ${contextType}`);
          Spicetify.showNotification(`Cannot navigate to ${contextType}`, true);
      }
    } catch (error) {
      console.error("Error navigating to context:", error);
      Spicetify.showNotification("Error navigating to context", true);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.contentLayout}>
        {/* Left side - Track info with album art */}
        <div className={styles.trackInfoContainer}>
          <div className={styles.albumCoverContainer}>
            <div
              className={styles.albumCoverClickable}
              onClick={() => navigateToAlbum()}
              title="Go to album"
            >
              {isLoadingCover ? (
                <div className={styles.albumCoverPlaceholder}>
                  <div className={styles.albumCoverLoading}></div>
                </div>
              ) : albumCover ? (
                <img
                  src={albumCover}
                  alt={`${track.album.name} cover`}
                  className={styles.albumCover}
                />
              ) : (
                <div className={styles.albumCoverPlaceholder}>
                  <span className={styles.albumCoverIcon}>♫</span>
                </div>
              )}
            </div>
          </div>
          <div className={styles.trackInfo}>
            <h2
              className={styles.trackTitle}
              onClick={() => navigateToAlbum()}
              title={track.uri.startsWith('spotify:local:') ? "Go to Local Files" : "Go to album"}
            >
              {track.name}
              {track.uri.startsWith('spotify:local:') && <span style={{ fontSize: '0.8em', opacity: 0.7, marginLeft: '6px' }}>(Local)</span>}
            </h2>
            <p className={styles.trackArtist}>{artistNames}</p>
            <p className={styles.trackAlbum}>{track.album.name}</p>

            {/* New Track Metadata Section */}
            <div className={styles.trackMetadata}>
              {isLoadingMetadata ? (
                <div className={styles.metadataLoading}>Loading details...</div>
              ) : (
                <>
                  <div className={styles.metadataGrid}>
                    {trackMetadata.releaseDate && (
                      <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>Released:</span>
                        <span className={styles.metadataValue}>{trackMetadata.releaseDate}</span>
                      </div>
                    )}

                    {trackMetadata.trackLength && (
                      <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>Length:</span>
                        <span className={styles.metadataValue}>{trackMetadata.trackLength}</span>
                      </div>
                    )}

                    {trackMetadata.bpm && (
                      <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>BPM:</span>
                        <span className={styles.metadataValue}>{trackMetadata.bpm}</span>
                      </div>
                    )}

                    {trackMetadata.playCount && (
                      <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>Plays:</span>
                        <span className={styles.metadataValue}>{trackMetadata.playCount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {trackMetadata.sourceContext && (
                    <div className={styles.metadataContext}>
                      <span className={styles.metadataLabel}>Playing from:</span>{' '}
                      <span
                        className={`${styles.metadataValue} ${styles.contextLink}`}
                        onClick={() => navigateToContext()}
                        title="Go to source"
                      >
                        {trackMetadata.sourceContext}
                      </span>
                    </div>
                  )}

                  {trackMetadata.genres.length > 0 && (
                    <div className={styles.metadataGenres}>
                      <span className={styles.metadataLabel}>Genres:</span>{' '}
                      <div className={styles.genreTags}>
                        {trackMetadata.genres.map((genre, index) => (
                          <span key={index} className={styles.genreTag}>
                            {genre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Controls and metadata */}
        <div className={styles.controlsContainer}>
          {/* Rating */}
          <div className={styles.controlSection}>
            <label className={styles.label}>Rating:</label>
            <div className={styles.ratingContainer}>
              <div className={styles.stars}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    className={`${styles.star} ${star <= trackData.rating ? styles.starActive : ''}`}
                    onClick={() => onSetRating(star === trackData.rating ? 0 : star)}
                    aria-label={`Rate ${star} stars`}
                  >
                    ★
                  </button>
                ))}
              </div>
              {trackData.rating > 0 && (
                <button
                  className={styles.clearButton}
                  onClick={handleRemoveRating}
                  aria-label="Clear rating"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Energy Level */}
          <div className={styles.controlSection}>
            <label className={styles.label}>
              Energy Level:
              {trackData.energy > 0 && <span className={styles.energyValue}>{trackData.energy}</span>}
            </label>
            <div className={styles.energyContainer}>
              <input
                type="range"
                min="1"
                max="10"
                value={trackData.energy || 5}
                data-is-set={trackData.energy > 0 ? "true" : "false"}
                className={`${styles.energySlider} ${trackData.energy === 0 ? styles.energySliderUnset : ''}`}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  // Only update if the value is different or energy is not set
                  if (newValue !== trackData.energy || trackData.energy === 0) {
                    onSetEnergy(newValue);
                  }
                }}
                onDoubleClick={() => {
                  // Clear on double click
                  onSetEnergy(0);
                }}
              />
              {trackData.energy > 0 && (
                <button
                  className={styles.clearButton}
                  onClick={handleRemoveEnergy}
                  aria-label="Clear energy rating"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tags section - Moved below in a horizontal layout */}
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
  );
};

export default TrackDetails;