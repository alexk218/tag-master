# TagMaster - Spicetify Custom App

A custom Spicetify app for managing tags, ratings, and energy levels for your Spotify tracks with Rekordbox integration.

## Features

- **Rating System**: Rate tracks from 1-5 stars
- **Energy Levels**: Assign energy levels (1-10) to tracks
- **Custom Tags**: Create and manage a hierarchical tag system
- **Tag Categories**: Organize tags into categories
- **Search & Filter**: Find tracks by tags, ratings, or search terms
- **Export**: Export metadata for Rekordbox integration

## Hierarchical Tag Structure

TagMaster supports organizing tags into categories:

- **Genres**: Organic, Minimal, Soul, Beautiful, etc.
- **Label-defined sounds**: Maccabi, HOOM, ADID, PAMPA
- **Artist-inspired styles**: KORA minimal, SIS minimal, RUSSO, etc.

You can create, edit, and organize your own tag categories and tags.

## Installation

### Prerequisites

1. [Spotify Desktop App](https://www.spotify.com/download/)
2. [Spicetify](https://spicetify.app/) installed

### Install TagMaster

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/tagmaster.git
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

## Rekordbox Integration

TagMaster allows you to export your tag data for use with Rekordbox:

1. Use TagMaster to tag and rate your tracks in Spotify
2. Export your data using the "Export for Rekordbox" button
3. Use the companion script (available separately) to apply the metadata to your music files
4. Import the tagged files into Rekordbox

The exported metadata will include:
- Star ratings that map to Rekordbox ratings
- Comments in the format: "Energy Level - Tag1, Tag2, Tag3"

## Development

### Local Development

```
npm run watch
```

This will automatically rebuild the app when you make changes.

### Building for Production

```
npm run build
```

