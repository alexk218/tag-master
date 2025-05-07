import { useState } from "react";

export function usePlaylistState() {
  const [showLocalTracksModal, setShowLocalTracksModal] = useState(false);
  const [localTracksForPlaylist, setLocalTracksForPlaylist] = useState<string[]>([]);
  const [createdPlaylistInfo, setCreatedPlaylistInfo] = useState<{
    name: string;
    id: string | null;
  }>({ name: "", id: null });

  const createPlaylistFromFilters = async (
    trackUris: string[],
    playlistName: string,
    playlistDescription: string,
    isPublic: boolean
  ) => {
    if (trackUris.length === 0) {
      Spicetify.showNotification("No tracks to add to playlist", true);
      return;
    }

    try {
      // First, get the current user's profile to get the user ID
      const userProfile = await Spicetify.CosmosAsync.get("https://api.spotify.com/v1/me");
      const userId = userProfile.id;

      if (!userId) {
        throw new Error("Could not get user ID");
      }

      // Split tracks into Spotify tracks and local tracks
      const spotifyTrackUris = trackUris.filter((uri) => !uri.startsWith("spotify:local:"));
      const localTrackUris = trackUris.filter((uri) => uri.startsWith("spotify:local:"));

      // Check if we have any Spotify tracks to add
      if (spotifyTrackUris.length === 0 && localTrackUris.length > 0) {
        // If we only have local tracks, we need a different approach
        // First create an empty playlist
        const playlistResponse = await Spicetify.CosmosAsync.post(
          `https://api.spotify.com/v1/users/${userId}/playlists`,
          {
            name: playlistName,
            description: playlistDescription,
            public: isPublic,
          }
        );

        const playlistId = playlistResponse.id;

        if (!playlistId) {
          throw new Error("Failed to create playlist");
        }

        // Store the created playlist info and local tracks for the modal
        setCreatedPlaylistInfo({
          name: playlistName,
          id: playlistId,
        });
        setLocalTracksForPlaylist(localTrackUris);
        setShowLocalTracksModal(true);

        return;
      }

      // Create the playlist if we have Spotify tracks
      const playlistResponse = await Spicetify.CosmosAsync.post(
        `https://api.spotify.com/v1/users/${userId}/playlists`,
        {
          name: playlistName,
          description: playlistDescription,
          public: isPublic,
        }
      );

      const playlistId = playlistResponse.id;

      if (!playlistId) {
        throw new Error("Failed to create playlist");
      }

      // Add tracks to the playlist in batches of 100 (API limit)
      for (let i = 0; i < spotifyTrackUris.length; i += 100) {
        const batch = spotifyTrackUris.slice(i, Math.min(i + 100, spotifyTrackUris.length));
        await Spicetify.CosmosAsync.post(
          `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
          {
            uris: batch,
          }
        );
      }

      // Show different notifications based on whether we have local tracks or not
      if (localTrackUris.length > 0) {
        // Store the created playlist info and local tracks for the modal
        setCreatedPlaylistInfo({
          name: playlistName,
          id: playlistId,
        });
        setLocalTracksForPlaylist(localTrackUris);

        // Show notification about playlist creation success
        Spicetify.showNotification(
          `Created playlist "${playlistName}" with ${spotifyTrackUris.length} tracks. Local tracks need to be added manually.`,
          false,
          4000
        );

        // Show the modal with instructions for adding local tracks
        setShowLocalTracksModal(true);
      } else {
        // Simple success notification for Spotify-only playlists
        Spicetify.showNotification(
          `Created playlist "${playlistName}" with ${spotifyTrackUris.length} tracks.`
        );

        // Navigate to the newly created playlist
        Spicetify.Platform.History.push(`/playlist/${playlistId}`);
      }
    } catch (error) {
      console.error("Error creating playlist:", error);
      Spicetify.showNotification("Failed to create playlist. Please try again.", true);
    }
  };

  return {
    showLocalTracksModal,
    setShowLocalTracksModal,
    localTracksForPlaylist,
    setLocalTracksForPlaylist,
    createdPlaylistInfo,
    setCreatedPlaylistInfo,
    createPlaylistFromFilters,
  };
}
