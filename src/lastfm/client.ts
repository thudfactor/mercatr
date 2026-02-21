import { readCache, writeCache } from './cache.js';
import type {
  Tag,
  SimilarArtist,
  ArtistInfo,
  TagArtist,
  TagTrack,
  TagInfo,
} from './types.js';

const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

// Simple rate limiter: max 5 requests per rolling second
const requestTimestamps: number[] = [];

async function throttle(): Promise<void> {
  const now = Date.now();
  // Remove timestamps older than 1 second
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > 1000) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= 5) {
    const wait = 1000 - (now - requestTimestamps[0]);
    await new Promise(resolve => setTimeout(resolve, wait));
    requestTimestamps.shift();
  }
  requestTimestamps.push(Date.now());
}

async function apiRequest<T>(
  method: string,
  params: Record<string, string>,
  noCache = false
): Promise<T> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) throw new Error('LASTFM_API_KEY environment variable is not set');

  if (!noCache) {
    const cached = readCache<T>(method, params);
    if (cached !== null) return cached;
  }

  await throttle();

  const query = new URLSearchParams({
    method,
    api_key: apiKey,
    format: 'json',
    ...params,
  });

  const response = await fetch(`${BASE_URL}?${query}`);

  if (!response.ok) {
    throw new Error(`Last.fm HTTP error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json() as Record<string, unknown>;

  if (json.error) {
    throw new Error(`Last.fm API error ${json.error}: ${json.message}`);
  }

  if (!noCache) {
    writeCache(method, params, json);
  }

  return json as T;
}

export interface LastfmClientOptions {
  noCache?: boolean;
}

export class LastfmClient {
  private noCache: boolean;

  constructor(options: LastfmClientOptions = {}) {
    this.noCache = options.noCache ?? false;
  }

  async getArtistTopTags(artist: string): Promise<Tag[]> {
    const data = await apiRequest<{ toptags: { tag: Tag[] } }>(
      'artist.getTopTags',
      { artist },
      this.noCache
    );
    return data.toptags.tag ?? [];
  }

  async getTrackTopTags(artist: string, track: string): Promise<Tag[]> {
    const data = await apiRequest<{ toptags: { tag: Tag[] } }>(
      'track.getTopTags',
      { artist, track },
      this.noCache
    );
    return data.toptags.tag ?? [];
  }

  async getSimilarArtists(artist: string, limit = 20): Promise<SimilarArtist[]> {
    const data = await apiRequest<{ similarartists: { artist: SimilarArtist[] } }>(
      'artist.getSimilar',
      { artist, limit: String(limit) },
      this.noCache
    );
    return data.similarartists.artist ?? [];
  }

  async getArtistInfo(artist: string): Promise<ArtistInfo> {
    const data = await apiRequest<{
      artist: {
        name: string;
        url: string;
        bio: { summary: string; content: string };
        stats: { listeners: string; playcount: string };
        tags: { tag: Tag[] };
        similar: { artist: SimilarArtist[] };
      };
    }>('artist.getInfo', { artist }, this.noCache);

    const a = data.artist;
    return {
      name: a.name,
      url: a.url,
      bio: a.bio,
      stats: a.stats,
      tags: a.tags?.tag ?? [],
      similar: a.similar?.artist ?? [],
    };
  }

  async getTopArtistsForTag(tag: string, limit = 20): Promise<TagArtist[]> {
    const data = await apiRequest<{
      topartists: { artist: Array<{ name: string; url: string; '@attr': { rank: string } }> };
    }>('tag.getTopArtists', { tag, limit: String(limit) }, this.noCache);

    return (data.topartists.artist ?? []).map(a => ({
      name: a.name,
      url: a.url,
      rank: parseInt(a['@attr']?.rank ?? '0', 10),
    }));
  }

  async getTopTracksForTag(tag: string, limit = 20): Promise<TagTrack[]> {
    const data = await apiRequest<{
      tracks: {
        track: Array<{
          name: string;
          artist: { name: string; url: string };
          url: string;
          '@attr': { rank: string };
        }>;
      };
    }>('tag.getTopTracks', { tag, limit: String(limit) }, this.noCache);

    return (data.tracks.track ?? []).map(t => ({
      name: t.name,
      artist: t.artist,
      url: t.url,
      rank: parseInt(t['@attr']?.rank ?? '0', 10),
    }));
  }

  async getTagInfo(tag: string): Promise<TagInfo> {
    const data = await apiRequest<{
      tag: {
        name: string;
        total: number;
        reach: number;
        wiki: { summary: string; content: string };
      };
    }>('tag.getInfo', { tag }, this.noCache);

    return data.tag;
  }
}
