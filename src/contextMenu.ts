// This file handles the context menu integration for TagMaster

// Store the app reference for callbacks
let appReference: any = null;

/**
 * Initialize the context menu integration
 * @param app - Reference to the main App component
 */
export function initializeContextMenu(app: any) {
  try {
    console.log("TagMaster: Initializing context menu with app reference", !!app);
    
    // Store reference to the app
    appReference = app;
    
    if (!Spicetify.ContextMenu) {
      console.error("TagMaster: Spicetify.ContextMenu not available!");
      return;
    }
    
    // Register context menu item for track contexts
    registerTrackContextMenu();
  } catch (error) {
    console.error("TagMaster: Error initializing context menu:", error);
  }
}

/**
 * Register context menu item for track contexts
 */
function registerTrackContextMenu() {
  try {
    // Create a new context menu item using Spicetify.ContextMenu.Item constructor
    const menuItem = new Spicetify.ContextMenu.Item(
      "Tag with TagMaster", // Label/name of the menu item
      (uris) => handleTrackContextMenuClick(uris), // The function to call when item is clicked
      (uris) => shouldAddTrackMenuItem(uris), // Function to determine when to show item
      "heart" // Use an existing Spotify icon - the docs show it accepts a string directly
    );
    
    // Register the menu item to add it to the context menu
    menuItem.register();
    
    console.log("TagMaster: Context menu item registered successfully");
  } catch (error) {
    console.error("TagMaster: Error registering context menu item:", error);
  }
}

/**
 * Determine if the menu item should be shown
 * Show only for track URIs
 */
function shouldAddTrackMenuItem(uris: string[]): boolean {
  // Return true if we have at least one track URI
  const shouldAdd = uris.some(uri => uri.startsWith("spotify:track:"));
  console.log("TagMaster: Should add menu item:", shouldAdd, uris);
  return shouldAdd;
}

/**
 * Handle context menu item click
 * @param uris - Array of Spotify URIs
 */
async function handleTrackContextMenuClick(uris: string[]) {
  console.log("TagMaster: Context menu item clicked for URIs:", uris);
  
  if (!appReference || !appReference.handleTrackSelected || !uris.length) {
    console.error("TagMaster: App reference not available or no URIs provided");
    return;
  }
  
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
    console.error("TagMaster: Error handling context menu click:", error);
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
    console.error("TagMaster: Error fetching track info:", error);
    throw error;
  }
}