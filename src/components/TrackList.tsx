import React, { useState, useEffect } from "react";
import styles from "./TrackList.module.css";

interface Tag {
  tag: string;
  category: string;
}

interface TrackData {
  rating: number;
  energy: number;
  tags: Tag[];
}

interface TracksObject {
  [uri: string]: TrackData;
}

interface SpotifyTrackInfo {
  name: string;
  artists: string;
  albumName: string;
}

interface TrackListProps {
  tracks: TracksObject;
  onSelectTrack: (uri: string) => void;
}

const TrackList: React.FC<TrackListProps> = ({ tracks, onSelectTrack }) => {
  const [trackInfo, setTrackInfo] = useState<{[uri: string]: SpotifyTrackInfo}>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  
  // Fetch track info from Spotify on component mount and when tracks change
  useEffect(() => {
    const fetchTrackInfo = async () => {
      const trackUris = Object.keys(tracks);
      const newTrackInfo: {[uri: string]: SpotifyTrackInfo} = {};
      
      // Process tracks in batches of 20 (reduce from 50 to be safer)
      for (let i = 0; i < trackUris.length; i += 20) {
        const batch = trackUris.slice(i, i + 20);
        
        try {
          // Extract track IDs from URIs (spotify:track:1234567 -> 1234567)
          // Map URI to ID and create a lookup
          const uriToIdMap: {[uri: string]: string} = {};
          
          batch.forEach(uri => {
            const parts = uri.split(':');
            if (parts.length >= 3 && parts[1] === 'track') {
              uriToIdMap[uri] = parts[2];
            }
          });
          
          // Get all valid track IDs
          const trackIds = Object.values(uriToIdMap).filter(id => 
            id && id.length > 0 && id !== 'undefined' && id !== 'null'
          );
          
          if (trackIds.length === 0) {
            console.log("No valid track IDs found in batch, skipping");
            continue;
          }
          
          console.log("Fetching track info for IDs:", trackIds);
          
          // Use Spicetify's API to get track info
          const response = await Spicetify.CosmosAsync.get(
            `https://api.spotify.com/v1/tracks?ids=${trackIds.join(',')}`
          );
          
          if (response && response.tracks) {
            // Create a map of ID to track data
            const idToTrackMap: {[id: string]: any} = {};
            response.tracks.forEach((track: any) => {
              if (track && track.id) {
                idToTrackMap[track.id] = track;
              }
            });
            
            // Now match back to original URIs using our map
            Object.entries(uriToIdMap).forEach(([uri, id]) => {
              const track = idToTrackMap[id];
              if (track) {
                newTrackInfo[uri] = {
                  name: track.name,
                  artists: track.artists.map((a: any) => a.name).join(", "),
                  albumName: track.album?.name || "Unknown Album"
                };
              }
            });
          }
        } catch (error) {
          console.error("Error fetching track info:", error);
        }
      }
      
      setTrackInfo(newTrackInfo);
    };
    
    if (Object.keys(tracks).length > 0) {
      fetchTrackInfo();
    }
  }, [tracks]);
  
  // Extract all unique tags from all tracks
  const allTags = new Set<string>();
  Object.values(tracks).forEach(track => {
    track.tags.forEach(({ tag }) => {
      allTags.add(tag);
    });
  });
  
  // Filter tracks based on search term and active filter
  const filteredTracks = Object.entries(tracks).filter(([uri, trackData]) => {
    const info = trackInfo[uri];
    
    // Skip if we don't have info for this track yet
    if (!info) return false;
    
    // Search term filter
    const matchesSearch = 
      searchTerm === "" || 
      info.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      info.artists.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Tag filter
    const matchesFilter = 
      activeFilter === null || 
      trackData.tags.some(({ tag }) => tag === activeFilter);
    
    return matchesSearch && matchesFilter;
  });
  
  // Sort filtered tracks by artist name
  const sortedTracks = [...filteredTracks].sort((a, b) => {
    const infoA = trackInfo[a[0]];
    const infoB = trackInfo[b[0]];
    
    if (!infoA || !infoB) return 0;
    
    return infoA.artists.localeCompare(infoB.artists);
  });
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Tagged Tracks</h2>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search tracks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>
      
      <div className={styles.tagFilters}>
        <button 
          className={`${styles.tagFilter} ${activeFilter === null ? styles.active : ''}`}
          onClick={() => setActiveFilter(null)}
        >
          All
        </button>
        {Array.from(allTags).map(tag => (
          <button
            key={tag}
            className={`${styles.tagFilter} ${activeFilter === tag ? styles.active : ''}`}
            onClick={() => setActiveFilter(activeFilter === tag ? null : tag)}
          >
            {tag}
          </button>
        ))}
      </div>
      
      <div className={styles.trackList}>
        {sortedTracks.length === 0 ? (
          <p className={styles.noTracks}>
            {Object.keys(tracks).length === 0 
              ? "No tagged tracks yet. Start tagging your favorite tracks!" 
              : "No tracks match your filters."}
          </p>
        ) : (
          sortedTracks.map(([uri, data]) => {
            const info = trackInfo[uri];
            if (!info) return null;
            
            return (
              <div 
                key={uri} 
                className={styles.trackItem}
                onClick={() => onSelectTrack(uri)}
              >
                <div className={styles.trackItemInfo}>
                  <span className={styles.trackItemArtist}>{info.artists}</span>
                  <span className={styles.trackItemTitle}>{info.name}</span>
                </div>
                <div className={styles.trackItemMeta}>
                  <div className={styles.trackItemRating}>
                    {Array(5).fill(0).map((_, i) => (
                      <span 
                        key={i} 
                        className={`${styles.miniStar} ${i < data.rating ? styles.active : ''}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <div className={styles.trackItemEnergy}>E{data.energy}</div>
                  <div className={styles.trackItemTags}>
                    {data.tags.length > 0 
                      ? data.tags.map(({tag}, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && ", "}
                            <span className={styles.trackItemTag}>{tag}</span>
                          </React.Fragment>
                        ))
                      : <span className={styles.noTags}>No tags</span>
                    }
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TrackList;