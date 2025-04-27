import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";

// Reference to the app's root element
let appContainer: HTMLElement | null = null;

const Tagify = () => {
  // Get the container element from Spotify
  appContainer = document.createElement("div");
  appContainer.id = "tagify-container";
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
  console.log("Tagify: Starting initialization");

  try {
    // Wait for Spicetify to be available
    while (!Spicetify?.Platform) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Important - make sure required Spicetify components are available
    if (!Spicetify.CosmosAsync) {
      console.error("Tagify: Spicetify.CosmosAsync is not available!");
      Spicetify.showNotification("Tagify: API access not available", true);
    }

    // Initialize our app when Spicetify is ready
    Tagify();

    // Show welcome message
    console.log("Tagify loaded. Right-click tracks to tag them.");
    Spicetify.showNotification("Tagify loaded! Right-click tracks to tag them.");
  } catch (error) {
    console.error("Tagify: Error during initialization:", error);
    Spicetify.showNotification("Error initializing Tagify", true);
  }
}

// This will be called when the app is unloaded
export function getCSS() {
  return `
    #tagify-container {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      z-index: 1; /* Ensure UI elements are clickable */
    }
  `;
}
