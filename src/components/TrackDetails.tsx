import React, { useEffect, useState } from "react";
import styles from "./TrackDetails.module.css";
import { Category, TrackTag } from "../hooks/useTagData";
import ReactStars from "react-rating-stars-component";
import { findPlaylistsContainingTrack } from "../utils/PlaylistManager";
import { getPlaylistSettings } from "../utils/PlaylistSettings";

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
  activeTagFilters: string[];
  onFilterByTag?: (tag: string) => void;
  onPlayTrack?: (uri: string) => void;
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
  activeTagFilters,
  onSetRating,
  onSetEnergy,
  onRemoveTag,
  onFilterByTag,
  onPlayTrack,
}) => {
  const [contextUri, setContextUri] = useState<string | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const artistNames = track.artists ? track.artists.map((artist) => artist.name).join(", ") : "";
  const [albumCover, setAlbumCover] = useState<string | null>(null);
  const [isLoadingCover, setIsLoadingCover] = useState(true);
  const containingPlaylists = track.uri ? findPlaylistsContainingTrack(track.uri) : [];
  const [trackMetadata, setTrackMetadata] = useState<TrackMetadata>({
    releaseDate: "",
    trackLength: "",
    bpm: null,
    playCount: null,
    sourceContext: null,
    genres: [],
  });

  // Format milliseconds to mm:ss
  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Format date to YYYY-MM-DD
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return "";

    // Check if we only have a year
    if (dateStr.length === 4) {
      return dateStr;
    }

    try {
      const date = new Date(dateStr);
      return date.toISOString().split("T")[0];
    } catch (e) {
      return dateStr;
    }
  };

  // Fetch additional track metadata
  useEffect(() => {
    const fetchTrackMetadata = async () => {
      setIsLoadingMetadata(true);

      try {
        // Check if this is a local file
        if (track.uri.startsWith("spotify:local:")) {
          // For local files, we set limited metadata
          setTrackMetadata({
            releaseDate: "",
            trackLength: "",
            bpm: null,
            playCount: null,
            sourceContext: "Local Files",
            genres: [],
          });
          setIsLoadingMetadata(false);
          return;
        }

        // Extract track ID from URI for Spotify tracks
        const trackId = track.uri.split(":").pop();

        if (!trackId) {
          console.error("Invalid track URI:", track.uri);
          setIsLoadingMetadata(false);
          return;
        }

        // Fetch track info
        const trackInfo = await Spicetify.CosmosAsync.get(
          `https://api.spotify.com/v1/tracks/${trackId}`
        );

        // Fetch audio features for tempo (BPM)
        const audioFeatures = await Spicetify.CosmosAsync.get(
          `https://api.spotify.com/v1/audio-features/${trackId}`
        );

        // Try to get source context from Spicetify
        let sourceContext = null;
        try {
          if (Spicetify.Player && Spicetify.Player.data && Spicetify.Player.data.context) {
            const playerContextUri = Spicetify.Player.data.context.uri;

            if (playerContextUri) {
              // Store the context URI for navigation
              setContextUri(playerContextUri);

              // Parse the context URI
              const parts = playerContextUri.split(":");
              if (parts.length >= 3) {
                const contextType = parts[1];
                let contextName = "";

                // Special case for Liked Songs (collection)
                if (contextType === "collection" && parts.includes("tracks")) {
                  contextName = "Liked Songs";
                } else if (contextType === "playlist") {
                  try {
                    const playlistData = await Spicetify.CosmosAsync.get(
                      `https://api.spotify.com/v1/playlists/${parts[2]}`
                    );
                    contextName = playlistData.name || "";
                  } catch (e) {
                    contextName = "Playlist";
                  }
                } else if (contextType === "album") {
                  contextName = track.album.name;
                } else if (contextType === "artist") {
                  contextName = artistNames ? artistNames.split(",")[0] : "Artist";
                } else if (contextType === "user") {
                  contextName = "Liked Songs"; // Default for user context is often Liked Songs
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
        let genres: string[] = [];

        if (trackInfo?.artists && trackInfo.artists.length > 0 && trackInfo.artists[0]?.id) {
          const artistId = trackInfo.artists[0].id;
          try {
            const artistInfo = await Spicetify.CosmosAsync.get(
              `https://api.spotify.com/v1/artists/${artistId}`
            );
            genres = artistInfo.genres || [];
          } catch (e) {
            console.error("Error fetching artist info:", e);
          }
        }

        let playCount = null;
        try {
          if (!track.uri.startsWith("spotify:local:")) {
            // Only try to get play count for Spotify tracks (not local files)
            playCount = await getTrackPlayCount(track.uri);
          }
        } catch (error) {
          console.error("Error fetching play count:", error);
        }

        setTrackMetadata({
          releaseDate: formatDate(trackInfo.album?.release_date || ""),
          trackLength: formatDuration(trackInfo.duration_ms || 0),
          bpm: audioFeatures?.tempo ? Math.round(audioFeatures.tempo) : null,
          playCount, // Add the play count here
          sourceContext,
          genres: genres.slice(0, 3),
        });
      } catch (error) {
        console.error("Error fetching track metadata:", error);

        // Set minimal metadata for error cases
        setTrackMetadata({
          releaseDate: "",
          trackLength: "",
          bpm: null,
          playCount: null,
          sourceContext: null,
          genres: [],
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
        if (track.uri.startsWith("spotify:local:")) {
          // For local files, we don't have album art from Spotify
          // Set a null album cover to show the placeholder
          setAlbumCover(null);
          setIsLoadingCover(false);
          return;
        }

        // Extract track ID from URI for Spotify tracks
        const trackId = track.uri.split(":").pop();

        if (!trackId) {
          console.error("Invalid track URI:", track.uri);
          setIsLoadingCover(false);
          return;
        }

        // Fetch track info to get album ID and cover
        const trackInfo = await Spicetify.CosmosAsync.get(
          `https://api.spotify.com/v1/tracks/${trackId}`
        );

        if (
          trackInfo &&
          trackInfo.album &&
          trackInfo.album.images &&
          trackInfo.album.images.length > 0
        ) {
          // Get medium size image (or the first available if medium doesn't exist)
          const image =
            trackInfo.album.images.find((img: any) => img.height === 300) ||
            trackInfo.album.images[0];
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
  }, [track.uri]);

  async function getTrackPlayCount(trackUri: string): Promise<number | null> {
    try {
      // Extract track ID and album ID
      const trackId = trackUri.split(":").pop();
      if (!trackId) return null;

      // First, get the track info to get the album ID
      const trackInfo = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/tracks/${trackId}`
      );

      if (!trackInfo || !trackInfo.album || !trackInfo.album.id) {
        console.error("Could not get album ID for track:", trackUri);
        return null;
      }

      const albumId = trackInfo.album.id;

      // Use GraphQL to get album data with play counts
      const { Locale, GraphQL } = Spicetify;
      const res = await GraphQL.Request(GraphQL.Definitions.getAlbum, {
        uri: `spotify:album:${albumId}`,
        locale: Locale.getLocale(),
        offset: 0,
        limit: 500,
      });

      if (!res.data?.albumUnion) {
        console.error("No albumUnion in response for album:", albumId);
        return null;
      }

      // Get tracks from the response
      const tracks = res.data.albumUnion.tracksV2 || res.data.albumUnion.tracks;
      if (!tracks?.items) {
        console.error("No track items found in album data");
        return null;
      }

      // Find our track in the album and get its play count
      const trackItem = tracks.items.find(
        (item: { track: { uri: string } }) => item.track && item.track.uri === trackUri
      );

      if (!trackItem || !trackItem.track) {
        console.error("Track not found in album data");
        return null;
      }

      // Parse the play count
      const playcount = parseInt(trackItem.track.playcount, 10) || 0;
      return playcount;
    } catch (error) {
      console.error("Error fetching track play count:", error);
      return null;
    }
  }

  const handlePlayTrack = () => {
    if (onPlayTrack && track.uri) {
      onPlayTrack(track.uri);
    }
  };

  // Helper function to find tag name by ids
  const findTagInfo = (categoryId: string, subcategoryId: string, tagId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return null;

    const subcategory = category.subcategories.find((s) => s.id === subcategoryId);
    if (!subcategory) return null;

    const tag = subcategory.tags.find((t) => t.id === tagId);
    if (!tag) return null;

    return {
      categoryName: category.name,
      subcategoryName: subcategory.name,
      tagName: tag.name,
      tagOrder: subcategory.tags.findIndex((t) => t.id === tagId), // Add order information
    };
  };

  // Group tags by category and maintain original order
  const organizeTagsByCategory = () => {
    const groupedTags: {
      [categoryId: string]: {
        categoryName: string;
        categoryOrder: number; // Add category order
        subcategories: {
          [subcategoryId: string]: {
            subcategoryName: string;
            subcategoryOrder: number; // Add subcategory order
            tags: {
              id: string;
              name: string;
              order: number; // Add tag order
            }[];
          };
        };
      };
    } = {};

    // First get all categories with their order in the original array
    categories.forEach((category, categoryIndex) => {
      groupedTags[category.id] = {
        categoryName: category.name,
        categoryOrder: categoryIndex,
        subcategories: {},
      };

      // Initialize subcategories with their order
      category.subcategories.forEach((subcategory, subcategoryIndex) => {
        groupedTags[category.id].subcategories[subcategory.id] = {
          subcategoryName: subcategory.name,
          subcategoryOrder: subcategoryIndex,
          tags: [],
        };
      });
    });

    // Now add the tags from the track data
    trackData.tags.forEach((tag) => {
      const tagInfo = findTagInfo(tag.categoryId, tag.subcategoryId, tag.tagId);
      if (!tagInfo) return;

      // Add the tag with its original order to ensure proper sorting later
      groupedTags[tag.categoryId].subcategories[tag.subcategoryId].tags.push({
        id: tag.tagId,
        name: tagInfo.tagName,
        order: tagInfo.tagOrder,
      });
    });

    // For each subcategory, sort tags by their original order
    Object.values(groupedTags).forEach((category) => {
      Object.values(category.subcategories).forEach((subcategory) => {
        subcategory.tags.sort((a, b) => a.order - b.order);
      });
    });

    return groupedTags;
  };

  const groupedTags = organizeTagsByCategory();

  // Handle removing energy rating
  const handleRemoveEnergy = () => {
    onSetEnergy(0);
  };

  // Handle tag filtering
  const handleTagFilter = (tagName: string) => {
    if (onFilterByTag) {
      onFilterByTag(tagName);
    }
  };

  const isPlaylistExcluded = (playlistId: string, playlistName: string): boolean => {
    // Get the current playlist settings
    const settings = getPlaylistSettings();

    // Check if this is a playlist that's specifically excluded
    if (settings.excludedPlaylistIds.includes(playlistId)) return true;

    // Check for excluded keywords in name
    if (
      settings.excludedKeywords.some((keyword) =>
        playlistName.toLowerCase().includes(keyword.toLowerCase())
      )
    ) {
      return true;
    }

    // Also check hardcoded exclusions like MASTER
    if (playlistName === "MASTER") return true;

    return false;
  };

  const shouldShowLikedOnlyWarning = (): boolean => {
    // If no playlists at all, don't show warning
    if (containingPlaylists.length === 0) return false;

    // Find if there's at least one non-excluded, non-Liked Songs playlist
    const hasNonExcludedPlaylists = containingPlaylists.some((playlist) => {
      // Skip Liked Songs and excluded playlists
      return playlist.id !== "liked" && !isPlaylistExcluded(playlist.id, playlist.name);
    });

    // Show warning if either:
    // 1. Only in Liked Songs, or
    // 2. Only in Liked Songs and excluded playlists
    return !hasNonExcludedPlaylists;
  };

  const showLikedOnlyWarning = shouldShowLikedOnlyWarning();

  const navigateToPlaylist = (playlistId: string) => {
    if (playlistId === "liked") {
      // Navigate to Liked Songs
      Spicetify.Platform.History.push("/collection/tracks");
    } else {
      // Navigate to the playlist
      Spicetify.Platform.History.push(`/playlist/${playlistId}`);
    }
  };

  // Navigation functions
  const navigateToAlbum = () => {
    try {
      // Check if this is a local file first
      if (track.uri.startsWith("spotify:local:")) {
        // For local files, try to navigate to Local Files section
        Spicetify.Platform.History.push("/collection/local-files");
        return;
      }

      // Extract album URI from track data or try to build it
      let albumUri = "";

      // Try to extract from track info if available
      if (
        Spicetify.Player &&
        Spicetify.Player.data &&
        Spicetify.Player.data.track &&
        Spicetify.Player.data.track.album &&
        Spicetify.Player.data.track.album.uri
      ) {
        albumUri = Spicetify.Player.data.track.album.uri;
      } else {
        // Try to extract album ID from track URI and build album URI
        const trackId = track.uri.split(":").pop();
        if (trackId) {
          // We'll need to use Spotify API to get the album ID
          Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${trackId}`)
            .then((response) => {
              if (response && response.album && response.album.id) {
                const albumId = response.album.id;
                albumUri = `spotify:album:${albumId}`;

                // Navigate to album page
                Spicetify.Platform.History.push(`/album/${albumId}`);
              }
            })
            .catch((error) => {
              console.error("Error fetching album info:", error);
              Spicetify.showNotification("Couldn't navigate to album", true);
            });
          return; // Exit early as we're using async approach
        }
      }

      if (albumUri) {
        // Extract album ID from URI
        const albumId = albumUri.split(":").pop();
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

  // Add this function with the other navigation functions
  const navigateToArtist = (artistName: string) => {
    try {
      // Check if this is a local file first
      if (track.uri.startsWith("spotify:local:")) {
        Spicetify.showNotification("Cannot navigate to artist for local files", true);
        return;
      }

      // Try to get artist URI from track data
      if (track.artists && track.artists.length > 0) {
        const artist = track.artists.find((a) => a.name === artistName);
        if (artist && (artist as any).uri) {
          // If we have the artist URI directly
          const artistId = (artist as any).uri.split(":").pop();
          if (artistId) {
            Spicetify.Platform.History.push(`/artist/${artistId}`);
            return;
          }
        }
      }

      const trackId = track.uri.split(":").pop();
      if (trackId) {
        Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${trackId}`)
          .then((response) => {
            if (response && response.artists) {
              const artist = response.artists.find((a: any) => a.name === artistName);
              if (artist && artist.id) {
                Spicetify.Platform.History.push(`/artist/${artist.id}`);
                return;
              }
            }

            // Fallback - search for the artist
            Spicetify.Platform.History.push(`/search/${encodeURIComponent(artistName)}/artists`);
          })
          .catch((error) => {
            console.error("Error finding artist:", error);
            // Fallback - search for the artist
            Spicetify.Platform.History.push(`/search/${encodeURIComponent(artistName)}/artists`);
          });
      } else {
        // Fallback - search for the artist
        Spicetify.Platform.History.push(`/search/${encodeURIComponent(artistName)}/artists`);
      }
    } catch (error) {
      console.error("Error navigating to artist:", error);
      Spicetify.showNotification("Error navigating to artist", true);
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
      const parts = contextUri.split(":");
      if (parts.length < 3) {
        Spicetify.showNotification("Invalid context URI", true);
        return;
      }

      const contextType = parts[1];
      const contextId = parts[2];

      // Navigate based on context type
      switch (contextType) {
        case "playlist":
          Spicetify.Platform.History.push(`/playlist/${contextId}`);
          break;
        case "album":
          Spicetify.Platform.History.push(`/album/${contextId}`);
          break;
        case "artist":
          Spicetify.Platform.History.push(`/artist/${contextId}`);
          break;
        case "show":
          Spicetify.Platform.History.push(`/show/${contextId}`);
          break;
        case "collection":
          // Special case for Liked Songs
          if (parts.includes("tracks")) {
            Spicetify.Platform.History.push("/collection/tracks");
          }
          break;
        case "user":
          // For user context, likely Liked Songs
          Spicetify.Platform.History.push("/collection/tracks");
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

  // Handle energy level input value
  const handleEnergyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    // Always update energy value, even if it's already 5
    onSetEnergy(value);
  };

  // Handle click on the energy slider
  const handleEnergyClick = (e: React.MouseEvent<HTMLInputElement>) => {
    // Get the clicked position and calculate the corresponding energy value
    const sliderElement = e.currentTarget;
    const rect = sliderElement.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const sliderWidth = rect.width;
    const percentage = clickPosition / sliderWidth;

    // Calculate energy value (1-10)
    const min = 1;
    const max = 10;
    let energy = Math.round(min + percentage * (max - min));

    // Ensure we stay within bounds
    energy = Math.max(min, Math.min(max, energy));

    // Always update, even if the value is the same as the current energy level
    onSetEnergy(energy);
  };

  return (
    <div className={styles.container}>
      {showLikedOnlyWarning && (
        <div
          className={styles.warningIconContainer}
          title="This track is only in Liked Songs or excluded playlists. Consider organizing it into appropriate playlists."
        >
          <span className={styles.warningIcon}>⚠️</span>
        </div>
      )}
      <div className={styles.contentLayout}>
        {/* Left side - Track info with album art */}
        <div className={styles.trackInfoContainer}>
          <div className={styles.albumCoverContainer}>
            <div
              className={styles.albumCoverClickable}
              onClick={() => navigateToAlbum()}
              title={track.uri?.startsWith("spotify:local:") ? "Go to Local Files" : "Go to album"}
            >
              {isLoadingCover ? (
                <div className={styles.albumCoverPlaceholder}>
                  <div className={styles.albumCoverLoading}></div>
                </div>
              ) : albumCover ? (
                <img
                  src={albumCover}
                  alt={`${track.album?.name || "Album"} cover`}
                  className={styles.albumCover}
                />
              ) : (
                <div className={styles.albumCoverPlaceholder}>
                  <span className={styles.albumCoverIcon}>♫</span>
                </div>
              )}
            </div>
            <button
              className={styles.playButton}
              onClick={handlePlayTrack}
              title={
                track.uri?.startsWith("spotify:local:") ? "Go to Local Files" : "Play this track"
              }
            >
              {track.uri?.startsWith("spotify:local:") ? "Go to Local Files" : "Play"}
            </button>
          </div>
          <div className={styles.trackInfo}>
            <h2
              className={styles.trackTitle}
              onClick={() => navigateToAlbum()}
              title={track.uri?.startsWith("spotify:local:") ? "Go to Local Files" : "Go to album"}
            >
              {track.name || "Unknown Track"}
              {track.uri?.startsWith("spotify:local:") && (
                <span style={{ fontSize: "0.8em", opacity: 0.7, marginLeft: "6px" }}>(Local)</span>
              )}
            </h2>
            <p className={styles.trackArtist}>
              {track.artists && track.artists.length > 0
                ? track.artists.map((artist, idx, arr) => (
                    <React.Fragment key={idx}>
                      <span
                        className={`${styles.clickableArtist}`}
                        onClick={() => navigateToArtist(artist.name)}
                        title={`Go to ${artist.name}`}
                      >
                        {artist.name}
                      </span>
                      {idx < arr.length - 1 && ", "}
                    </React.Fragment>
                  ))
                : "Unknown Artist"}
            </p>
            <p className={styles.trackAlbum}>{track.album?.name || "Unknown Album"}</p>

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

                    {trackMetadata.playCount !== null && (
                      <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>Plays:</span>
                        <span className={styles.metadataValue}>
                          {trackMetadata.playCount.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {trackMetadata.sourceContext && (
                    <div className={styles.metadataContext}>
                      <span className={styles.metadataLabel}>Playing from:</span>{" "}
                      <span
                        className={`${styles.metadataValue} ${styles.contextLink}`}
                        onClick={() => navigateToContext()}
                        title="Go to source"
                      >
                        {trackMetadata.sourceContext}
                      </span>
                    </div>
                  )}

                  {/* {trackMetadata.genres.length > 0 && (
                    <div className={styles.metadataGenres}>
                      <span className={styles.metadataLabel}>Genres:</span>{" "}
                      <div className={styles.genreTags}>
                        {trackMetadata.genres.map((genre, index) => (
                          <span key={index} className={styles.genreTag}>
                            {genre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )} */}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Controls and metadata */}
        <div className={styles.controlsContainer}>
          {/* Rating */}
          <div className={styles.controlSection}>
            <label className={styles.label}>
              Rating: {trackData.rating > 0 ? trackData.rating : ""}
            </label>
            <div className={styles.ratingContainer}>
              <div className={styles.stars} key={`stars-${trackData.rating}`}>
                <ReactStars
                  count={5}
                  value={trackData.rating || 0}
                  onChange={(newRating: number) => onSetRating(newRating)}
                  size={24}
                  isHalf={true}
                  emptyIcon={<i className="far fa-star"></i>}
                  halfIcon={<i className="fa fa-star-half-alt"></i>}
                  fullIcon={<i className="fa fa-star"></i>}
                  activeColor="#ffd700"
                  color="var(--spice-button-disabled)"
                />
              </div>

              {trackData.rating > 0 && (
                <button
                  className={styles.clearButton}
                  onClick={() => onSetRating(0)}
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
              {trackData.energy > 0 && (
                <span className={styles.energyValue}>{trackData.energy}</span>
              )}
            </label>
            <div className={styles.energyContainer}>
              <input
                type="range"
                min="1"
                max="10"
                value={trackData.energy || 5}
                data-is-set={trackData.energy > 0 ? "true" : "false"}
                className={`${styles.energySlider} ${
                  trackData.energy === 0 ? styles.energySliderUnset : ""
                }`}
                onChange={handleEnergyInput}
                onClick={handleEnergyClick}
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

      {/* Playlists Section - moved to full-width below the main content */}
      <div className={styles.playlistsWrapper}>
        {containingPlaylists.length > 0 ? (
          <>
            <div className={styles.playlistsSection}>
              <h4 className={styles.sectionTitle}>In Playlists:</h4>
              <div className={styles.playlistList}>
                {containingPlaylists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className={styles.playlistItem}
                    onClick={() => navigateToPlaylist(playlist.id)}
                    title={`Go to ${playlist.name} (Owner: ${playlist.owner})`}
                  >
                    <span className={styles.playlistName}>{playlist.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.noPlaylists}>Not found in any playlists in cache</div>
        )}
      </div>

      {/* Tags section - Moved below in a horizontal layout */}
      <div className={styles.tagsSection}>
        {Object.keys(groupedTags).length === 0 ? (
          <p className={styles.noTags}>No tags applied</p>
        ) : (
          <div className={styles.tagCategories}>
            {/* Filter categories to only show those with tags */}
            {Object.entries(groupedTags)
              .filter(([, categoryData]) => {
                // Check if this category has any subcategories with tags
                return Object.values(categoryData.subcategories).some(
                  (subcategory) => subcategory.tags.length > 0
                );
              })
              .sort(([, a], [, b]) => a.categoryOrder - b.categoryOrder)
              .map(([categoryId, category]) => (
                <div key={categoryId} className={styles.tagCategory}>
                  <h4 className={styles.categoryName}>{category.categoryName}</h4>

                  {/* Only show subcategories that have tags */}
                  {Object.entries(category.subcategories)
                    .filter(([, subcategory]) => subcategory.tags.length > 0)
                    .sort(([, a], [, b]) => a.subcategoryOrder - b.subcategoryOrder)
                    .map(([subcategoryId, subcategory]) => (
                      <div key={subcategoryId} className={styles.tagSubcategory}>
                        <h5 className={styles.subcategoryName}>{subcategory.subcategoryName}</h5>

                        <div className={styles.tagList}>
                          {subcategory.tags.map((tag) => {
                            const isFiltered = activeTagFilters.includes(tag.name);

                            return (
                              <div
                                key={tag.id}
                                className={`${styles.tagItem} ${
                                  isFiltered ? styles.tagFilter : ""
                                }`}
                                onClick={() => handleTagFilter(tag.name)}
                              >
                                <span className={styles.tagName}>{tag.name}</span>
                                <button
                                  className={styles.removeTag}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveTag(categoryId, subcategoryId, tag.id);
                                  }}
                                  aria-label={`Remove tag ${tag.name}`}
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
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
