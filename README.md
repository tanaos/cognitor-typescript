<p align="center">
    <a href="https://github.com/tanaos/cognitor">
        <img src="https://raw.githubusercontent.com/tanaos/cognitor/master/assets/banner.png" width="90%" alt="Cognitor | All-in-one semantic search engine for AI and humans.">
    </a>
</p>

# cognitor-typescript

TypeScript SDK for [Cognitor](https://github.com/tanaos/cognitor).

## Installation

```bash
npm install cognitor
```

## Quick start

```ts
import { Cognitor } from "cognitor";

const client = new Cognitor("http://localhost:7530", {
	apiKey: "your-api-key",
});

console.log(await client.ping());
console.log(await client.healthReady()); // "ready" or "loading"

client.close();
```

The `apiKey` parameter is optional, omit it if your [cognitor instance](https://github.com/tanaos/cognitor) does not require authentication.

## Usage

### Collections

```ts
// Create a collection (server-side embedding)
const collection = await client.createCollection("my-collection", {
	embModel: "text-embedding-3-small",
});

// Create a collection with a fixed vector dimension (client-side embedding)
const collectionWithDim = await client.createCollection("my-collection-2", {
	dim: 1536,
});

// List all collections
const collections = await client.listCollections();

// Get a single collection
const oneCollection = await client.getCollection("my-collection");

// Delete a collection
await client.deleteCollection("my-collection");
```

### Documents

```ts
// Add documents (texts are embedded server-side when embModel is set)
const ids = await client.addDocuments(
	"my-collection",
	["Hello world", "Cognitor is a vector store"],
	[{ source: "docs" }, { source: "docs" }],
);

// Add documents with explicit vectors (client-side embedding)
const idsWithVectors = await client.addDocuments(
	"my-collection",
	["Hello world"],
	[{ source: "docs" }],
	{ vectors: [[0.1, 0.2]] },
);

// Add a large number of documents in batches
const bulkIds = await client.bulkAddDocuments(
	"my-collection",
	["doc 1", "doc 2"],
	[{ source: "docs" }, { source: "docs" }],
	{ batchSize: 512 },
);

// List documents (paginated)
const page = await client.listDocuments("my-collection", { offset: 0, limit: 50 });
console.log(page.total, page.documents);

// Get a single document
const doc = await client.getDocument("my-collection", ids[0]);

// Update document metadata
const updated = await client.updateDocumentMetadata("my-collection", ids[0], {
	source: "updated",
});

// Delete a document
await client.deleteDocument("my-collection", ids[0]);
```

### Search

```ts
// Search by text (requires server-side embedding model)
const byText = await client.search("my-collection", {
	queryText: "Hello",
	topK: 10,
});

// Search by vector
const byVector = await client.search("my-collection", {
	queryVector: [0.1, 0.2],
	topK: 10,
});

// Filter results by metadata
const filtered = await client.search("my-collection", {
	queryText: "Hello",
	filters: { source: "docs" },
});

// Include vectors in results
const withVectors = await client.search("my-collection", {
	queryText: "Hello",
	includeVectors: true,
});

for (const hit of withVectors.results) {
	console.log(`score=${hit.score.toFixed(4)} text=${JSON.stringify(hit.text)}`);
}
```

### Admin

```ts
// Compact a collection (removes deleted vectors)
const result = await client.compact("my-collection");
console.log(result.deletedCount, "vectors removed");
```

### Health

```ts
// Readiness probe status
const status = await client.healthReady();
if (status === "ready") {
	console.log("Server is ready");
} else {
	console.log("Server is still loading models");
}
```

### Authentication helpers

```ts
// Register a user and obtain an API key
const apiKey = await client.register("username", "password");

// Login and obtain an API key
const newApiKey = await client.login("username", "password");
```