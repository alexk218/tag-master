import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";

// Reference to the app's root element
let appContainer: HTMLElement | null = null;

const TagMaster = () => {
  // Get the container element from Spotify
  appContainer = document.createElement("div");
  appContainer.id = "tagmaster-container";
  document.body.appendChild(appContainer);

  // Create root and render our React app into the container
  const root = ReactDOM.createRoot(appContainer);

  // Render the app
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// Wait for Spicetify to load before initializing our app
export default async function main() {
  console.log("TagMaster: Starting initialization");

  try {
    // Wait for Spicetify to be available
    while (!Spicetify?.Platform) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Important - make sure required Spicetify components are available
    if (!Spicetify.CosmosAsync) {
      console.error("TagMaster: Spicetify.CosmosAsync is not available!");
      Spicetify.showNotification("TagMaster: API access not available", true);
    }

    // Initialize our app when Spicetify is ready
    TagMaster();

    // Show welcome message
    console.log("TagMaster loaded. Right-click tracks to tag them.");
    Spicetify.showNotification("TagMaster loaded! Right-click tracks to tag them.");
  } catch (error) {
    console.error("TagMaster: Error during initialization:", error);
    Spicetify.showNotification("Error initializing TagMaster", true);
  }
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
