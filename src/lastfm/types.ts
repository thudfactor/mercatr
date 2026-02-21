export interface Tag {
  name: string;
  count: number;
  url: string;
}

export interface SimilarArtist {
  name: string;
  match: number;
  url: string;
  image: Array<{ '#text': string; size: string }>;
}

export interface ArtistInfo {
  name: string;
  url: string;
  bio: {
    summary: string;
    content: string;
  };
  stats: {
    listeners: string;
    playcount: string;
  };
  tags: Tag[];
  similar: SimilarArtist[];
}

export interface TrackTagsResponse {
  tags: Tag[];
}

export interface TopTagsResponse {
  tags: Tag[];
}

export interface SimilarArtistsResponse {
  artists: SimilarArtist[];
}

export interface TagArtist {
  name: string;
  url: string;
  rank: number;
}

export interface TagTrack {
  name: string;
  artist: { name: string; url: string };
  url: string;
  rank: number;
}

export interface TopArtistsForTagResponse {
  artists: TagArtist[];
}

export interface TopTracksForTagResponse {
  tracks: TagTrack[];
}

export interface TagInfo {
  name: string;
  total: number;
  reach: number;
  wiki: {
    summary: string;
    content: string;
  };
}
