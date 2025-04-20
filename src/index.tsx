import React, { useRef } from "react";
import ReactDOM from "react-dom/client";
import App, { AppRef } from "./app";
import { initializeContextMenu } from "./contextMenu";

// Reference to the app's root element
let appContainer: HTMLElement | null = null;

const TagMaster = () => {
  // Get the container element from Spotify
  appContainer = document.createElement("div");
  appContainer.id = "tagmaster-container";
  document.body.appendChild(appContainer);

  // Create root and render our React app into the container
  const root = ReactDOM.createRoot(appContainer);
  
  // Create a ref that we can use to access the app component
  const appRef = React.createRef<AppRef>();
  
  // Render the app with the ref
  root.render(
    <React.StrictMode>
      <App ref={appRef} />
    </React.StrictMode>
  );
  
  // Once the app is rendered, initialize the context menu
  // We need to wait a bit to ensure the app is fully mounted
  setTimeout(() => {
    if (appRef.current) {
      console.log("TagMaster: Initializing context menu integration");
      initializeContextMenu({
        handleTrackSelected: appRef.current.handleTrackSelected
      });
    } else {
      console.error("TagMaster: Failed to initialize context menu - App ref not available");
    }
  }, 1000);
};

// Wait for Spicetify to load before initializing our app
export default async function main() {
  console.log("TagMaster: Starting initialization");
  
  while (!Spicetify?.Platform) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Make sure ContextMenu is available
  if (!Spicetify.ContextMenu) {
    console.error("TagMaster: Spicetify.ContextMenu is not available!");
    Spicetify.showNotification("TagMaster: Context menu API not available", true);
  }
  
  // Initialize our app when Spicetify is ready
  TagMaster();
  
  // Show welcome message
  Spicetify.showNotification("TagMaster loaded! Right-click tracks to tag them.");
}

// This will be called when the app is unloaded
export function getCSS() {
  return `
    #tagmaster-container {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      z-index: 1; /* Ensure UI elements are clickable */
    }
  `;
}