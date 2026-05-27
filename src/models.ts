export type Vector = number[];
export type Metadata = Record<string, unknown>;

export interface Collection {
    name: string;
    dim: number;
    docCount: number;
    embModel?: string;
}

export interface Document {
    id: string;
    vector: Vector;
    text: string;
    metadata: Metadata;
}

export interface ListDocumentsResult {
    documents: Document[];
    total: number;
    offset: number;
    limit: number;
}

export interface SearchResult {
    id: string;
    score: number;
    text: string;
    metadata: Metadata;
    vector?: Vector;
    answerPassage?: string;
    answerPassageStart?: number;
    answerPassageEnd?: number;
}

export interface SearchResponse {
    results: SearchResult[];
    total: number;
}

export interface CompactionResult {
    collectionName: string;
    vectorsBefore: number;
    liveCount: number;
    deletedCount: number;
}
