import {
    AuthenticationError,
    CognitorError,
    ConflictError,
    NotFoundError,
    ServerError,
    ValidationError,
} from "./exceptions.js";
import {
    Collection,
    CompactionResult,
    Document,
    ListDocumentsResult,
    Metadata,
    SearchResponse,
    SearchResult,
    Vector,
} from "./models.js";

interface CognitorOptions {
    apiKey?: string;
    timeout?: number;
    fetchImpl?: typeof fetch;
}

type HealthReadyStatus = "ready" | "loading";

interface SearchResultWire {
    id: string;
    score: number;
    text: string;
    metadata: Metadata;
    vector?: Vector;
    answer_passage?: string;
    answer_passage_start?: number;
    answer_passage_end?: number;
}

interface SearchResponseWire {
    results: SearchResultWire[];
    total: number;
}

interface CollectionWire {
    name: string;
    dim: number;
    doc_count: number;
    emb_model?: string;
}

interface CompactionResultWire {
    collection_name: string;
    vectors_before: number;
    live_count: number;
    deleted_count: number;
}

export class Cognitor {
    private readonly baseUrl: string;
    private readonly headers: Headers;
    private readonly timeoutMs: number;
    private readonly fetchFn: typeof fetch;

    constructor(baseUrl: string, options: CognitorOptions = {}) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
        this.headers = new Headers();
        if (options.apiKey) {
            this.headers.set("Authorization", `Bearer ${options.apiKey}`);
        }
        this.timeoutMs = (options.timeout ?? 30) * 1000;
        this.fetchFn = options.fetchImpl ?? fetch;
    }

    close(): void {
        // Kept for parity with the Python SDK. No explicit teardown is required for fetch.
    }

    async ping(): Promise<string> {
        const response = await this.request("/");
        return (await response.json()) as string;
    }

    async healthReady(): Promise<HealthReadyStatus> {
        const response = await this.requestRaw("/health/ready", { method: "GET" });
        if (response.status === 200) {
            return "ready";
        }
        if (response.status === 503) {
            return "loading";
        }
        await this.raiseForStatus(response);
        return "loading";
    }

    async listCollections(): Promise<Collection[]> {
        const response = await this.request("/collections");
        const body = (await response.json()) as { collections: CollectionWire[] };
        return body.collections.map((collection) => this.mapCollection(collection));
    }

    async getCollection(name: string): Promise<Collection> {
        const response = await this.request(`/collections/${encodeURIComponent(name)}`);
        return this.mapCollection((await response.json()) as CollectionWire);
    }

    async createCollection(
        name: string,
        options: { dim?: number; embModel?: string } = {},
    ): Promise<Collection> {
        const body: { name: string; dim?: number; emb_model?: string } = { name };
        if (options.dim !== undefined) {
            body.dim = options.dim;
        }
        if (options.embModel !== undefined) {
            body.emb_model = options.embModel;
        }
        const response = await this.request("/collections", {
            method: "POST",
            body: JSON.stringify(body),
        });
        return this.mapCollection((await response.json()) as CollectionWire);
    }

    async deleteCollection(name: string): Promise<void> {
        await this.request(`/collections/${encodeURIComponent(name)}`, { method: "DELETE" });
    }

    async addDocuments(
        collection: string,
        texts: string[],
        metadatas: Metadata[],
        options: { vectors?: Vector[] } = {},
    ): Promise<string[]> {
        const body: { texts: string[]; metadatas: Metadata[]; vectors?: Vector[] } = {
            texts,
            metadatas,
        };
        if (options.vectors !== undefined) {
            body.vectors = options.vectors;
        }
        const response = await this.request(
            `/collections/${encodeURIComponent(collection)}/documents`,
            {
                method: "POST",
                body: JSON.stringify(body),
            },
        );
        const data = (await response.json()) as { ids: string[] };
        return data.ids;
    }

    async bulkAddDocuments(
        collection: string,
        texts: string[],
        metadatas: Metadata[],
        options: { vectors?: Vector[]; batchSize?: number } = {},
    ): Promise<string[]> {
        const body: { texts: string[]; metadatas: Metadata[]; vectors?: Vector[] } = {
            texts,
            metadatas,
        };
        if (options.vectors !== undefined) {
            body.vectors = options.vectors;
        }
        const batchSize = options.batchSize ?? 512;
        const query = new URLSearchParams({ batch_size: String(batchSize) }).toString();

        const response = await this.request(
            `/collections/${encodeURIComponent(collection)}/documents/bulk?${query}`,
            {
                method: "POST",
                body: JSON.stringify(body),
            },
        );
        const data = (await response.json()) as { ids: string[] };
        return data.ids;
    }

    async listDocuments(
        collection: string,
        options: { offset?: number; limit?: number } = {},
    ): Promise<ListDocumentsResult> {
        const offset = options.offset ?? 0;
        const limit = options.limit ?? 50;
        const query = new URLSearchParams({
            offset: String(offset),
            limit: String(limit),
        }).toString();

        const response = await this.request(
            `/collections/${encodeURIComponent(collection)}/documents?${query}`,
        );
        return (await response.json()) as ListDocumentsResult;
    }

    async getDocument(collection: string, docId: string): Promise<Document> {
        const response = await this.request(
            `/collections/${encodeURIComponent(collection)}/documents/${encodeURIComponent(docId)}`,
        );
        return (await response.json()) as Document;
    }

    async deleteDocument(collection: string, docId: string): Promise<void> {
        await this.request(
            `/collections/${encodeURIComponent(collection)}/documents/${encodeURIComponent(docId)}`,
            { method: "DELETE" },
        );
    }

    async updateDocumentMetadata(
        collection: string,
        docId: string,
        metadata: Metadata,
    ): Promise<Document> {
        const response = await this.request(
            `/collections/${encodeURIComponent(collection)}/documents/${encodeURIComponent(docId)}/metadata`,
            {
                method: "PATCH",
                body: JSON.stringify({ metadata }),
            },
        );
        return (await response.json()) as Document;
    }

    async search(
        collection: string,
        options: {
            queryText?: string;
            queryVector?: Vector;
            topK?: number;
            filters?: Metadata;
            includeVectors?: boolean;
        } = {},
    ): Promise<SearchResponse> {
        const body: {
            top_k: number;
            include_vectors: boolean;
            query_text?: string;
            query_vector?: Vector;
            filters?: Metadata;
        } = {
            top_k: options.topK ?? 10,
            include_vectors: options.includeVectors ?? false,
        };
        if (options.queryText !== undefined) {
            body.query_text = options.queryText;
        }
        if (options.queryVector !== undefined) {
            body.query_vector = options.queryVector;
        }
        if (options.filters !== undefined) {
            body.filters = options.filters;
        }

        const response = await this.request(
            `/collections/${encodeURIComponent(collection)}/search`,
            {
                method: "POST",
                body: JSON.stringify(body),
            },
        );
        const data = (await response.json()) as SearchResponseWire;
        return {
            total: data.total,
            results: data.results.map((result) => this.mapSearchResult(result)),
        };
    }

    async compact(collection: string): Promise<CompactionResult> {
        const response = await this.request(
            `/admin/collections/${encodeURIComponent(collection)}/compact`,
            { method: "POST" },
        );
        return this.mapCompactionResult((await response.json()) as CompactionResultWire);
    }

    private mapCollection(collection: CollectionWire): Collection {
        return {
            name: collection.name,
            dim: collection.dim,
            docCount: collection.doc_count,
            embModel: collection.emb_model,
        };
    }

    private mapCompactionResult(result: CompactionResultWire): CompactionResult {
        return {
            collectionName: result.collection_name,
            vectorsBefore: result.vectors_before,
            liveCount: result.live_count,
            deletedCount: result.deleted_count,
        };
    }

    private mapSearchResult(result: SearchResultWire): SearchResult {
        return {
            id: result.id,
            score: result.score,
            text: result.text,
            metadata: result.metadata,
            vector: result.vector,
            answerPassage: result.answer_passage,
            answerPassageStart: result.answer_passage_start,
            answerPassageEnd: result.answer_passage_end,
        };
    }

    private async request(path: string, init: RequestInit = {}): Promise<Response> {
        const response = await this.requestRaw(path, init);
        await this.raiseForStatus(response);
        return response;
    }

    private async requestRaw(path: string, init: RequestInit): Promise<Response> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            return await this.fetchFn(`${this.baseUrl}${path}`, {
                ...init,
                headers: this.makeHeaders(init.headers),
                signal: controller.signal,
            });
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                throw new CognitorError(`Request timed out after ${this.timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    private makeHeaders(requestHeaders?: HeadersInit): Headers {
        const headers = new Headers(this.headers);
        if (requestHeaders) {
            const incoming = new Headers(requestHeaders);
            incoming.forEach((value, key) => headers.set(key, value));
        }
        if (!headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }
        return headers;
    }

    private async raiseForStatus(response: Response): Promise<void> {
        if (response.ok) {
            return;
        }

        let message = "";
        try {
            const json = (await response.clone().json()) as { message?: unknown };
            message = typeof json.message === "string" ? json.message : "";
        } catch {
            // Ignore JSON parsing errors and fall back to text.
        }

        if (!message) {
            message = await response.text();
        }

        const code = response.status;
        if (code === 401) {
            throw new AuthenticationError(message, code);
        }
        if (code === 404) {
            throw new NotFoundError(message, code);
        }
        if (code === 409) {
            throw new ConflictError(message, code);
        }
        if (code === 400 || code === 422) {
            throw new ValidationError(message, code);
        }
        if (code >= 500) {
            throw new ServerError(message, code);
        }
        throw new CognitorError(message, code);
    }
}
