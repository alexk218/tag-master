import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";

const TagMaster = () => {
  // Get the container element from Spotify
  const container = document.createElement("div");
  container.id = "tagmaster-container";
  document.body.appendChild(container);

  // Create root and render our React app into the container
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// Wait for Spicetify to load before initializing our app
export default async function main() {
  while (!Spicetify?.Platform) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Initialize our app when Spicetify is ready
  TagMaster();
  
  // Show welcome message
  Spicetify.showNotification("TagMaster loaded! Start tagging your tracks.");
}

// This will be called when the app is unloaded
export function getCSS() {
  return `
    #tagmaster-container {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
  `;
}