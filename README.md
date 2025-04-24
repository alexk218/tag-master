# TagMaster - Spicetify Custom App

Organize your music by adding ratings, energy levels, and custom tags to your tracks. 
Filter through your tags, and generate playlists for tracks that satisfy those filters.
Intended for DJs and music curators.

Future: Will integrate with rekordbox. Sync your custom tags with "My Tags". Export your star ratings to rekordbox, etc.

## Features

- **Rating System**: Rate tracks from 1-5 stars
- **Energy Levels**: Assign energy levels (1-10) to tracks
- **Custom Tags**: Create and manage a hierarchical tagging system for your tracks
- **Search & Filter**: Find tracks by tags, ratings, or search terms
- **Playlist Generation**: Apply filters to your tagged track, and generate playlists for tracks satisfying those filters
- **Export**: Export metadata for Rekordbox integration (SOON)


## Installation

### Prerequisites

1. [Spotify Desktop App](https://www.spotify.com/download/)
2. [Spicetify](https://spicetify.app/) installed

### Install TagMaster

1. Clone the repository:
   ```
   git clone https://github.com/alexk218/tagmaster.git
   cd tagmaster
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the app:
   ```
   npm run build
   ```

4. Copy the app to your Spicetify custom apps folder:
   ```
   # Windows
   cp -r dist "$(spicetify -c | Split-Path)\CustomApps\tagmaster"

   # MacOS/Linux
   cp -r dist "$(dirname "$(spicetify -c)")/CustomApps/tagmaster"
   ```

5. Add the app to your Spicetify config:
   ```
   spicetify config custom_apps tagmaster
   spicetify apply
   ```
