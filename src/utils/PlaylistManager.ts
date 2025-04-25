import { addTrackToPlaylistInCache, getPlaylistsContainingTrack } from "./PlaylistCache";

const TAGGED_PLAYLIST_NAME = "TAGGED";

/**
 * Syncs all tagged tracks to the TAGGED playlist
 * @param tracks Object containing all tagged tracks
 * @returns Number of tracks added to the playlist
 */
export async function syncAllTaggedTracks(tracks: Record<string, any>): Promise<number> {
  try {
    // Get or create the TAGGED playlist
    const playlistId = await getOrCreateTaggedPlaylist();
    if (!playlistId) return 0;

    // Get all Spotify track URIs (filter out local files)
    const trackUris = Object.keys(tracks).filter((uri) => !uri.startsWith("spotify:local:"));

    if (trackUris.length === 0) {
      Spicetify.showNotification("No tracks to sync to TAGGED playlist");
      return 0;
    }

    // Get existing tracks in the playlist to avoid duplicates
    const existingTracks = new Set<string>();

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(uri)),next&offset=${offset}&limit=100`
      );

      if (response && response.items) {
        response.items.forEach((item: any) => {
          if (item.track && item.track.uri) {
            existingTracks.add(item.track.uri);
          }
        });

        offset += response.items.length;
        hasMore = response.items.length === 100;
      } else {
        hasMore = false;
      }
    }

    // Filter out tracks that are already in the playlist
    const tracksToAdd = trackUris.filter((uri) => !existingTracks.has(uri));

    if (tracksToAdd.length === 0) {
      Spicetify.showNotification("All tracks already in TAGGED playlist");
      return 0;
    }

    // Add tracks in batches of 100 (API limit)
    let addedCount = 0;

    for (let i = 0; i < tracksToAdd.length; i += 100) {
      const batch = tracksToAdd.slice(i, Math.min(i + 100, tracksToAdd.length));

      await Spicetify.CosmosAsync.post(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        {
          uris: batch,
        }
      );

      addedCount += batch.length;
    }

    Spicetify.showNotification(`Added ${addedCount} tracks to TAGGED playlist`);
    return addedCount;
  } catch (error) {
    console.error("TagMaster: Error syncing tracks to TAGGED playlist:", error);
    Spicetify.showNotification("Error syncing to TAGGED playlist", true);
    return 0;
  }
}

//  Gets the TAGGED playlist ID, creating it if it doesn't exist
export async function getOrCreateTaggedPlaylist(): Promise<string | null> {
  try {
    // First, get the current user's profile to get the user ID
    const userProfile = await Spicetify.CosmosAsync.get("https://api.spotify.com/v1/me");
    const userId = userProfile.id;

    if (!userId) {
      console.error("TagMaster: Could not get user ID");
      return null;
    }

    // Search for existing TAGGED playlist
    const playlists = await Spicetify.CosmosAsync.get(
      `https://api.spotify.com/v1/users/${userId}/playlists`
    );

    // Look for our TAGGED playlist
    const taggedPlaylist = playlists.items.find(
      (playlist: any) => playlist.name === TAGGED_PLAYLIST_NAME
    );

    // If found, return its ID
    if (taggedPlaylist) {
      console.log(`TagMaster: Found existing TAGGED playlist: ${taggedPlaylist.id}`);
      return taggedPlaylist.id;
    }

    // If not found, create it
    console.log("TagMaster: Creating new TAGGED playlist");
    const newPlaylist = await Spicetify.CosmosAsync.post(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        name: TAGGED_PLAYLIST_NAME,
        description: "Tracks tagged with TagMaster",
        public: false,
      }
    );

    if (newPlaylist && newPlaylist.id) {
      console.log(`TagMaster: Created TAGGED playlist: ${newPlaylist.id}`);
      return newPlaylist.id;
    }

    throw new Error("Failed to create TAGGED playlist");
  } catch (error) {
    console.error("TagMaster: Error getting/creating TAGGED playlist:", error);
    Spicetify.showNotification("Error creating TAGGED playlist", true);
    return null;
  }
}

// Checks if a track already exists in the TAGGED playlist
export async function isTrackInTaggedPlaylist(
  playlistId: string,
  trackUri: string
): Promise<boolean> {
  try {
    // For local files, always return true since we can't add them to playlists
    if (trackUri.startsWith("spotify:local:")) {
      return true;
    }

    // Get tracks from playlist (with pagination)
    let tracks: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=100`
      );

      if (response && response.items) {
        tracks = [...tracks, ...response.items];
        offset += response.items.length;
        hasMore = response.items.length === 100;
      } else {
        hasMore = false;
      }
    }

    // Check if track exists in playlist
    return tracks.some((item) => item.track && item.track.uri === trackUri);
  } catch (error) {
    console.error("TagMaster: Error checking if track is in playlist:", error);
    return false;
  }
}

// Adds a track to the TAGGED playlist if it's not already there
export async function addTrackToTaggedPlaylist(trackUri: string): Promise<boolean> {
  try {
    // Skip local files as they can't be added to playlists via API
    if (trackUri.startsWith("spotify:local:")) {
      console.log("TagMaster: Skipping local file for playlist addition");
      return false;
    }

    // Get or create the playlist
    const playlistId = await getOrCreateTaggedPlaylist();
    if (!playlistId) return false;

    // Get playlist details for cache
    const playlistDetails = await Spicetify.CosmosAsync.get(
      `https://api.spotify.com/v1/playlists/${playlistId}`
    );

    const playlistName = playlistDetails?.name || "TAGGED";
    const playlistOwner = "You";

    // Check if track is already in the playlist
    const isAlreadyInPlaylist = await isTrackInTaggedPlaylist(playlistId, trackUri);
    if (isAlreadyInPlaylist) {
      console.log(`TagMaster: Track ${trackUri} already in TAGGED playlist`);
      return false;
    }

    // Add track to playlist
    console.log(`TagMaster: Adding track ${trackUri} to TAGGED playlist`);
    await Spicetify.CosmosAsync.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      uris: [trackUri],
    });

    // Update the cache
    addTrackToPlaylistInCache(trackUri, playlistId, playlistName, playlistOwner);

    Spicetify.showNotification("Track added to TAGGED playlist");
    return true;
  } catch (error) {
    console.error("TagMaster: Error adding track to TAGGED playlist:", error);
    return false;
  }
}

export function findPlaylistsContainingTrack(
  trackUri: string
): Array<{ id: string; name: string; owner: string }> {
  return getPlaylistsContainingTrack(trackUri);
}
