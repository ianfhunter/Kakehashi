// Spotify Web API Service for searching songs
// Docs: https://developer.spotify.com/documentation/web-api/reference/search

const SPOTIFY_API_BASE_URL =
  process.env.EXPO_PUBLIC_SPOTIFY_API_BASE_URL?.trim() ||
  'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS_URL =
  process.env.EXPO_PUBLIC_SPOTIFY_ACCOUNTS_URL?.trim() ||
  'https://accounts.spotify.com/api/token';
const SPOTIFY_CLIENT_ID =
  process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID?.trim() ?? "";
const SPOTIFY_CLIENT_KEY =
  process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_KEY?.trim() ?? "";

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  source?: 'spotify' | 'apple';
  albumArt: string;
  url: string;
  previewUrl: string | null;
  duration: number; // in milliseconds
  albumName: string;
  releaseDate: string;
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifySearchResponse {
  tracks: {
    items: Array<{
      id: string;
      name: string;
      artists: Array<{
        id: string;
        name: string;
      }>;
      album: {
        name: string;
        images: Array<{
          url: string;
          height: number;
          width: number;
        }>;
        release_date: string;
      };
      external_urls: {
        spotify: string;
      };
      preview_url: string | null;
      duration_ms: number;
    }>;
  };
}

class SpotifyService {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.clientId = SPOTIFY_CLIENT_ID;
    this.clientSecret = SPOTIFY_CLIENT_KEY;
  }

  /**
   * Get access token using Client Credentials flow
   * Token is cached and reused until it expires
   */
  private async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        "Missing Spotify client credentials. Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID and EXPO_PUBLIC_SPOTIFY_CLIENT_KEY."
      );
    }

    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const credentials = `${this.clientId}:${this.clientSecret}`;
      const encodedCredentials = btoa(credentials);

      const response = await fetch(SPOTIFY_ACCOUNTS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${encodedCredentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        throw new Error(`Spotify auth error: ${response.status}`);
      }

      const data: SpotifyTokenResponse = await response.json();

      // Cache the token and set expiration time (subtract 60s for safety margin)
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

      return this.accessToken;
    } catch (error) {
      console.error('Error getting Spotify access token:', error);
      throw error;
    }
  }

  /**
   * Search for tracks on Spotify
   * Returns up to 50 tracks (Spotify's maximum per request)
   */
  async searchTracks(query: string, limit: number = 50): Promise<SpotifyTrack[]> {
    try {
      const accessToken = await this.getAccessToken();

      const params = new URLSearchParams({
        q: query,
        type: 'track',
        limit: Math.min(limit, 50).toString(), // Spotify max is 50
      });

      const response = await fetch(
        `${SPOTIFY_API_BASE_URL}/search?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
      }

      const data: SpotifySearchResponse = await response.json();

      if (!data.tracks || !data.tracks.items) {
        return [];
      }

      // Transform the results to our format
      const tracks: SpotifyTrack[] = data.tracks.items.map((track) => {
        // Get the best quality album art (prefer larger images)
        const albumArt = track.album.images.sort((a, b) => (b.height || 0) - (a.height || 0))[0]?.url || '';

        return {
          id: track.id,
          title: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          artistId: track.artists[0]?.id || '',
          source: 'spotify',
          albumArt,
          url: track.external_urls.spotify,
          previewUrl: track.preview_url,
          duration: track.duration_ms,
          albumName: track.album.name,
          releaseDate: track.album.release_date,
        };
      });

      return tracks;
    } catch (error) {
      console.error('Error searching tracks:', error);
      throw error;
    }
  }

  /**
   * Get track details by ID
   */
  async getTrackById(trackId: string): Promise<SpotifyTrack | null> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${SPOTIFY_API_BASE_URL}/tracks/${trackId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
      }

      const track = await response.json();

      // Get the best quality album art
      const albumArt = track.album.images.sort((a: any, b: any) => (b.height || 0) - (a.height || 0))[0]?.url || '';

      return {
        id: track.id,
        title: track.name,
        artist: track.artists.map((a: any) => a.name).join(', '),
        artistId: track.artists[0]?.id || '',
        source: 'spotify',
        albumArt,
        url: track.external_urls.spotify,
        previewUrl: track.preview_url,
        duration: track.duration_ms,
        albumName: track.album.name,
        releaseDate: track.album.release_date,
      };
    } catch (error) {
      console.error('Error fetching track:', error);
      throw error;
    }
  }

  /**
   * Get new Japanese music releases
   */
  async getNewJapaneseReleases(limit: number = 20): Promise<SpotifyTrack[]> {
    try {
      // Search for recent Japanese artists/bands and popular Japanese songs
      const results = await this.searchTracks('YOASOBI OR Kenshi Yonezu OR Ado OR Official髭男dism OR あいみょん', limit);
      return results;
    } catch (error) {
      console.error('Error fetching new Japanese releases:', error);
      return [];
    }
  }

  /**
   * Get popular Japanese songs
   */
  async getPopularJapaneseSongs(limit: number = 20): Promise<SpotifyTrack[]> {
    try {
      // Search for popular Japanese artists
      const results = await this.searchTracks('米津玄師 OR YOASOBI OR LiSA OR あいみょん', limit);
      return results;
    } catch (error) {
      console.error('Error fetching popular Japanese songs:', error);
      return [];
    }
  }

  /**
   * Get anime music
   */
  async getAnimeSongs(limit: number = 20): Promise<SpotifyTrack[]> {
    try {
      // Search for popular anime song artists
      const results = await this.searchTracks('LiSA OR Aimer OR RADWIMPS OR ONE OK ROCK OR BUMP OF CHICKEN', limit);
      return results;
    } catch (error) {
      console.error('Error fetching anime songs:', error);
      return [];
    }
  }

  /**
   * Get trending Japanese music
   */
  async getTrendingJapaneseSongs(limit: number = 20): Promise<SpotifyTrack[]> {
    try {
      // Search for recent popular Japanese music
      const results = await this.searchTracks('Ado OR 藤井風 OR back number', limit);
      return results;
    } catch (error) {
      console.error('Error fetching trending Japanese songs:', error);
      return [];
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.clientId.length > 0 && this.clientSecret.length > 0;
  }
}

export const spotifyService = new SpotifyService();
