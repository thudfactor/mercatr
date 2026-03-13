export type QueryType = 'explore' | 'bridge' | 'theme';

export interface ExploreQuery {
  type: 'explore';
  artist: string;
  track?: string;
}

export interface BridgeQuery {
  type: 'bridge';
  fromArtist: string;
  toArtist: string;
  fromSong?: string;
  toSong?: string;
}

export interface ThemeQuery {
  type: 'theme';
  theme: string;
  seedArtist?: string;
  translatedTags?: string[];
  translateMetadata?: {
    moodTerms: string[];
    genreHints: string[];
  };
}

export type Query = ExploreQuery | BridgeQuery | ThemeQuery;

export interface BuiltContext {
  queryType: QueryType;
  query: Query;
  contextText: string;
  summary: string;
  translationResultCount?: number;
}
