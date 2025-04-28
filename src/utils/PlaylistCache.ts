import { getPlaylistSettings, shouldExcludePlaylist } from "./PlaylistSettings";

interface PlaylistInfo {
  id: string;
  name: string;
  owner: string;
}

interface PlaylistCache {
  tracks: Record<string, PlaylistInfo[]>;
  lastUpdated: number; // timestamp
}

// Storage key for the cache
const PLAYLIST_CACHE_KEY = "tagify:playlistCache";

// Function to get the cache from localStorage
export function getPlaylistCache(): PlaylistCache {
  try {
    const cacheString = localStorage.getItem(PLAYLIST_CACHE_KEY);
    if (cacheString) {
      return JSON.parse(cacheString);
    }
  } catch (error) {
    console.error("Tagify: Error reading playlist cache:", error);
  }

  // Return empty cache if not found or error
  return {
    tracks: {},
    lastUpdated: 0,
  };
}

// Function to save the cache to localStorage
export function savePlaylistCache(cache: PlaylistCache): void {
  try {
    localStorage.setItem(PLAYLIST_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("Tagify: Error saving playlist cache:", error);
  }
}

// Function to add a track to a playlist in the cache
export function addTrackToPlaylistInCache(
  trackUri: string,
  playlistId: string,
  playlistName: string,
  playlistOwner: string
): void {
  const cache = getPlaylistCache();

  if (!cache.tracks[trackUri]) {
    cache.tracks[trackUri] = [];
  }

  // Check if the playlist is already in the track's list
  const existingIndex = cache.tracks[trackUri].findIndex((p) => p.id === playlistId);

  if (existingIndex === -1) {
    // Add playlist info to the track's list
    cache.tracks[trackUri].push({
      id: playlistId,
      name: playlistName,
      owner: playlistOwner,
    });

    // Update the timestamp
    cache.lastUpdated = Date.now();

    // Save the updated cache
    savePlaylistCache(cache);
  }
}

// Function to get playlists containing a track from the cache
export function getPlaylistsContainingTrack(trackUri: string): PlaylistInfo[] {
  const cache = getPlaylistCache();
  return cache.tracks[trackUri] || [];
}

// Function to refresh the entire cache
export async function refreshPlaylistCache(): Promise<number> {
  try {
    // Get user profile
    const userProfile = await Spicetify.CosmosAsync.get("https://api.spotify.com/v1/me");
    const userId = userProfile.id;

    if (!userId) {
      throw new Error("Could not get user ID");
    }

    // Create a new empty cache
    const newCache: PlaylistCache = {
      tracks: {},
      lastUpdated: Date.now(),
    };

    // Get all user's playlists
    const playlists: Array<{
      id: string;
      name: string;
      owner: { id: string; display_name: string };
      tracks: { total: number };
      description: string;
    }> = [];

    let offset = 0;
    let hasMore = true;

    // First, fetch all playlists
    while (hasMore) {
      const response = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/me/playlists?limit=50&offset=${offset}&fields=items(id,name,owner,tracks.total,description)`
      );

      if (response && response.items && response.items.length > 0) {
        playlists.push(...response.items);
        offset += response.items.length;
        hasMore = response.items.length === 50;
      } else {
        hasMore = false;
      }
    }

    console.log(`Tagify: Found ${playlists.length} total playlists`);

    // Filter playlists based on exclusion settings
    const filteredPlaylists = playlists.filter(
      (playlist) =>
        !shouldExcludePlaylist(
          playlist.id,
          playlist.name,
          playlist.owner.id,
          playlist.description || "",
          userId
        )
    );

    console.log(
      `Tagify: After filtering, processing ${filteredPlaylists.length} playlists (excluded ${
        playlists.length - filteredPlaylists.length
      })`
    );

    // Clear previous cached data for excluded playlists
    const oldCache = getPlaylistCache();

    // For each track in the old cache
    Object.entries(oldCache.tracks).forEach(([trackUri, playlistsArray]) => {
      // Filter out playlists that should be excluded
      const filteredPlaylistsForTrack = playlistsArray.filter(
        (playlist) =>
          // Keep "Liked Songs" and any playlists that aren't excluded
          playlist.id === "liked" || filteredPlaylists.some((p) => p.id === playlist.id)
      );

      // If there are still playlists for this track after filtering
      if (filteredPlaylistsForTrack.length > 0) {
        newCache.tracks[trackUri] = filteredPlaylistsForTrack;
      }
    });

    // Process filtered playlists
    let totalTracksProcessed = 0;
    let playlistsProcessed = 0;

    // Process playlists one by one to avoid rate limits
    for (const playlist of filteredPlaylists) {
      // Skip very large playlists (optional)
      if (playlist.tracks.total > 1000) {
        console.log(
          `Tagify: Skipping large playlist ${playlist.name} with ${playlist.tracks.total} tracks`
        );
        continue;
      }

      try {
        // Show progress notification every 5 playlists
        if (playlistsProcessed % 5 === 0) {
          Spicetify.showNotification(
            `Refreshing playlist cache: ${playlistsProcessed}/${filteredPlaylists.length} playlists`
          );
        }

        // Get all tracks from this playlist
        let tracksOffset = 0;
        let hasMoreTracks = true;

        while (hasMoreTracks) {
          // Add a delay to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 100));

          const tracksResponse = await Spicetify.CosmosAsync.get(
            `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=100&offset=${tracksOffset}&fields=items(track(uri)),next`
          );

          if (tracksResponse && tracksResponse.items && tracksResponse.items.length > 0) {
            // Process tracks
            tracksResponse.items.forEach((item: any) => {
              if (item.track && item.track.uri) {
                const trackUri = item.track.uri;

                // Skip local tracks
                if (trackUri.startsWith("spotify:local:")) {
                  return;
                }

                // Add to cache
                if (!newCache.tracks[trackUri]) {
                  newCache.tracks[trackUri] = [];
                }

                // Check if playlist already exists for this track
                const existingIndex = newCache.tracks[trackUri].findIndex(
                  (p) => p.id === playlist.id
                );

                if (existingIndex === -1) {
                  newCache.tracks[trackUri].push({
                    id: playlist.id,
                    name: playlist.name,
                    owner: playlist.owner.id === userId ? "You" : playlist.owner.display_name,
                  });
                }
              }
            });

            totalTracksProcessed += tracksResponse.items.length;
            tracksOffset += tracksResponse.items.length;
            hasMoreTracks = tracksResponse.items.length === 100;
          } else {
            hasMoreTracks = false;
          }
        }

        playlistsProcessed++;
      } catch (error) {
        console.error(`Tagify: Error processing playlist ${playlist.name}:`, error);
      }
    }

    // Add Liked Songs information
    try {
      Spicetify.showNotification("Refreshing playlist cache: Processing Liked Songs");

      let likedOffset = 0;
      let hasMoreLiked = true;

      while (hasMoreLiked) {
        // Add a delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));

        const likedResponse = await Spicetify.CosmosAsync.get(
          `https://api.spotify.com/v1/me/tracks?limit=50&offset=${likedOffset}`
        );

        if (likedResponse && likedResponse.items && likedResponse.items.length > 0) {
          likedResponse.items.forEach((item: any) => {
            if (item.track && item.track.uri) {
              const trackUri = item.track.uri;

              // Skip local tracks
              if (trackUri.startsWith("spotify:local:")) {
                return;
              }

              // Add to cache
              if (!newCache.tracks[trackUri]) {
                newCache.tracks[trackUri] = [];
              }

              // Check if Liked Songs already exists for this track
              const existingIndex = newCache.tracks[trackUri].findIndex((p) => p.id === "liked");

              if (existingIndex === -1) {
                newCache.tracks[trackUri].push({
                  id: "liked",
                  name: "Liked Songs",
                  owner: "You",
                });
              }
            }
          });

          totalTracksProcessed += likedResponse.items.length;
          likedOffset += likedResponse.items.length;
          hasMoreLiked = likedResponse.items.length === 50;
        } else {
          hasMoreLiked = false;
        }
      }
    } catch (error) {
      console.error("Tagify: Error processing Liked Songs:", error);
    }

    // Save the new cache
    savePlaylistCache(newCache);

    await scanLocalFilesInPlaylists();

    console.log(
      `Tagify: Refreshed playlist cache with ${
        Object.keys(newCache.tracks).length
      } unique tracks across ${filteredPlaylists.length} playlists`
    );
    Spicetify.showNotification(
      `Playlist data refreshed: ${Object.keys(newCache.tracks).length} tracks in ${
        filteredPlaylists.length
      } playlists`
    );

    return totalTracksProcessed;
  } catch (error) {
    console.error("Tagify: Error refreshing playlist cache:", error);
    Spicetify.showNotification("Error refreshing playlist data", true);
    return 0;
  }
}

// Check if the cache should be automatically updated (once per day)
export async function checkAndUpdateCacheIfNeeded(): Promise<void> {
  const cache = getPlaylistCache();
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  // If cache is empty or older than a day, update it
  if (Object.keys(cache.tracks).length === 0 || now - cache.lastUpdated > oneDayMs) {
    console.log("Tagify: Playlist cache is outdated, updating...");
    await refreshPlaylistCache();
  } else {
    console.log("Tagify: Playlist cache is up to date");

    // Always scan for local files even if the cache is up to date
    console.log("Tagify: Scanning for local files anyway...");
    await scanLocalFilesInPlaylists();
  }
}

export async function scanLocalFilesInPlaylists(): Promise<number> {
  try {
    console.log("Tagify: Scanning playlists for local files...");

    // Get user profile
    const userProfile = await Spicetify.CosmosAsync.get("https://api.spotify.com/v1/me");
    const userId = userProfile.id;

    if (!userId) {
      throw new Error("Could not get user ID");
    }

    // Get the current cache
    const cache = getPlaylistCache();
    let localFilesAdded = 0;

    // Log the current state of cache for local files
    const localFilesInCache = Object.keys(cache.tracks).filter((uri) =>
      uri.startsWith("spotify:local:")
    );
    console.log(`Tagify: Currently ${localFilesInCache.length} local files in cache before scan`);

    // Get all playlists (except excluded ones)
    const allPlaylists: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/me/playlists?limit=50&offset=${offset}`
      );

      if (response && response.items && response.items.length > 0) {
        allPlaylists.push(...response.items);
        offset += response.items.length;
        hasMore = response.items.length === 50;
      } else {
        hasMore = false;
      }
    }

    console.log(`Tagify: Found ${allPlaylists.length} playlists to check for local files`);

    const settings = getPlaylistSettings();

    // IMPORTANT: Filter playlists BEFORE making any API calls
    const filteredPlaylists = allPlaylists.filter((playlist) => {
      // Apply all exclusion rules
      if (settings.excludeNonOwnedPlaylists && playlist.owner.id !== userId) {
        return false;
      }

      // Check for excluded keywords in name
      if (
        settings.excludedKeywords.some((keyword) =>
          playlist.name.toLowerCase().includes(keyword.toLowerCase())
        )
      ) {
        console.log(
          `Tagify: Skipping excluded playlist "${playlist.name}" (matched excluded keyword)`
        );
        return false;
      }

      // Check for excluded playlist IDs
      if (settings.excludedPlaylistIds.includes(playlist.id)) {
        console.log(
          `Tagify: Skipping excluded playlist "${playlist.name}" (in excludedPlaylistIds)`
        );
        return false;
      }

      // Check for description exclusions
      if (
        playlist.description &&
        settings.excludeByDescription.some((term) =>
          playlist.description.toLowerCase().includes(term.toLowerCase())
        )
      ) {
        console.log(
          `Tagify: Skipping excluded playlist "${playlist.name}" (description contains excluded term)`
        );
        return false;
      }

      // Skip special playlists
      if (
        playlist.name === "MASTER" ||
        playlist.name === "TAGGED" ||
        playlist.name === "Local Files"
      ) {
        console.log(`Tagify: Skipping special playlist "${playlist.name}"`);
        return false;
      }

      return true;
    });

    console.log(
      `Tagify: After filtering, will check ${
        filteredPlaylists.length
      } playlists for local files (excluded ${allPlaylists.length - filteredPlaylists.length})`
    );

    // For each playlist, we'll directly check if it contains local files
    for (const playlist of filteredPlaylists) {
      // Skip the "Local Files" special playlist
      if (playlist.name === "Local Files") continue;

      try {
        console.log(`Tagify: Checking playlist "${playlist.name}" for local files`);

        // Try using Spicetify's internal APIs to get playlist contents
        // First try the PlaylistAPI
        let playlistTracks = [];

        // Try using PlaylistAPI first
        if (
          Spicetify.Platform.PlaylistAPI &&
          typeof Spicetify.Platform.PlaylistAPI.getContents === "function"
        ) {
          try {
            const result = await Spicetify.Platform.PlaylistAPI.getContents(playlist.id);
            if (result && result.items) {
              playlistTracks = result.items;
              console.log(
                `Tagify: Found ${playlistTracks.length} tracks in playlist via PlaylistAPI`
              );
            }
          } catch (error) {
            console.log(
              `Tagify: PlaylistAPI failed for ${playlist.name}, trying Cosmos API instead`
            );
            // Don't log the full error - just fall through to Cosmos API
          }
        }

        // If that didn't work, try the Cosmos API
        try {
          const result = await Spicetify.CosmosAsync.get(
            `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=100&fields=items(track(uri,name,artists,local))`
          );
          if (result && result.items && result.items.length > 0) {
            // Carefully extract tracks with proper validation
            const cosmosPlaylistTracks = result.items
              .filter((item: { track: any }) => item && item.track) // Filter out null/invalid items
              .map((item: { track: any }) => item.track);

            console.log(
              `Tagify: Found ${cosmosPlaylistTracks.length} tracks in playlist via Cosmos API`
            );

            // If PlaylistAPI gave us tracks, merge them with Cosmos results
            if (playlistTracks.length > 0) {
              // Merge but avoid duplicates
              const trackUris = new Set(playlistTracks.map((t: { uri: any }) => t.uri));
              cosmosPlaylistTracks.forEach((track: { uri: unknown }) => {
                if (!trackUris.has(track.uri)) {
                  playlistTracks.push(track);
                }
              });
              console.log(`Tagify: Combined total of ${playlistTracks.length} tracks`);
            } else {
              playlistTracks = cosmosPlaylistTracks;
            }
          }
        } catch (error) {
          console.error(
            `Tagify: Error getting tracks from Cosmos API for ${playlist.name}:`,
            error
          );
        }

        // Look for local files in the tracks
        let localFilesInPlaylist = 0;
        for (const track of playlistTracks) {
          if (track && track.uri && track.uri.startsWith("spotify:local:")) {
            console.log(`Tagify: Found local file ${track.uri} in playlist ${playlist.name}`);
            localFilesInPlaylist++;

            // Add this track-playlist relationship to the cache
            if (!cache.tracks[track.uri]) {
              cache.tracks[track.uri] = [];
            }

            // Check if this playlist is already in the track's list
            const existingIndex = cache.tracks[track.uri].findIndex((p) => p.id === playlist.id);

            if (existingIndex === -1) {
              // Add the playlist to the track's list
              cache.tracks[track.uri].push({
                id: playlist.id,
                name: playlist.name,
                owner: playlist.owner.id === userId ? "You" : playlist.owner.display_name,
              });

              localFilesAdded++;
            }
          }
        }

        if (localFilesInPlaylist > 0) {
          console.log(
            `Tagify: Added ${localFilesInPlaylist} local files from playlist ${playlist.name}`
          );
        }
      } catch (error) {
        console.error(`Tagify: Error processing playlist ${playlist.name}:`, error);
      }
    }

    // Update the cache timestamp
    cache.lastUpdated = Date.now();

    // Save the updated cache
    savePlaylistCache(cache);

    // Log the new state after scan
    const newLocalFilesInCache = Object.keys(cache.tracks).filter((uri) =>
      uri.startsWith("spotify:local:")
    );
    console.log(
      `Tagify: Now ${newLocalFilesInCache.length} local files in cache after scan (added ${localFilesAdded} references)`
    );

    return localFilesAdded;
  } catch (error) {
    console.error("Tagify: Error finding local files in playlists:", error);
    return 0;
  }
}
