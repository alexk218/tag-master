// This file handles the context menu integration for TagMaster

// Store the app reference for callbacks
let appReference: any = null;

/**
 * Initialize the context menu integration
 * @param app - Reference to the main App component
 */
export function initializeContextMenu(app: any) {
  // Store reference to the app
  appReference = app;
  
  // Register context menu items for track contexts
  registerTrackContextMenu();
}

/**
 * Register context menu item for track contexts
 */
function registerTrackContextMenu() {
  // Create a new context menu item
  const tagMasterMenuItem = new Spicetify.ContextMenu.Item(
    "Tag with TagMaster",
    handleTrackContextMenuClick,
    shouldAddTrackMenuItem,
    // Use a Spotify icon that's available - heart icon is a good fallback
    "heart" 
  );
  
  // Register the menu item
  tagMasterMenuItem.register();
}

/**
 * Determine if the menu item should be shown
 * Show only for track URIs
 */
function shouldAddTrackMenuItem(uris: string[]) {
  // Return true if we have at least one track URI
  return uris.some(uri => uri.startsWith("spotify:track:"));
}

/**
 * Handle context menu item click
 * @param uris - Array of Spotify URIs
 */
async function handleTrackContextMenuClick(uris: string[]) {
  if (!appReference || !uris.length) return;
  
  try {
    // Take the first URI (in case multiple are selected)
    const trackUri = uris[0];
    
    // Fetch track info using the Spotify API
    const response = await fetchTrackInfo(trackUri);
    
    if (response) {
      // Format the track info to our needed structure
      const trackInfo = {
        uri: trackUri,
        name: response.name,
        artists: response.artists.map((artist: any) => ({ name: artist.name })),
        album: { name: response.album?.name || "Unknown Album" },
        duration_ms: response.duration_ms
      };
      
      // Call the handler in the App component
      appReference.handleTrackSelected(trackInfo);
      
      // Show notification to the user
      Spicetify.showNotification(`TagMaster: Tagging "${trackInfo.name}"`);
    }
  } catch (error) {
    console.error("Error handling context menu click:", error);
    Spicetify.showNotification("Error loading track for tagging", true);
  }
}

/**
 * Fetch track information from Spotify API
 * @param uri - Spotify track URI
 * @returns Track information object
 */
async function fetchTrackInfo(uri: string) {
  try {
    // Extract the ID from the URI
    const trackId = uri.split(":").pop();
    
    if (!trackId) {
      throw new Error("Invalid track URI");
    }
    
    // Use Spicetify's Cosmos API to fetch track info
    const response = await Spicetify.CosmosAsync.get(
      `https://api.spotify.com/v1/tracks/${trackId}`
    );
    
    return response;
  } catch (error) {
    console.error("Error fetching track info:", error);
    throw error;
  }
}