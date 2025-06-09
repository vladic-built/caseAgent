# RAG Tools - Retrieval-Augmented Generation System

A comprehensive Node.js system for building Retrieval-Augmented Generation (RAG) applications using OpenAI's latest embedding models and Pinecone vector database.

## Architecture

The system is split into two main modules:

### 1. `ragTools.js` - Developer Workflow Tools
Contains all the tools needed to build and manage a RAG system:
- Generate embeddings from text
- Create and manage Pinecone indexes
- Batch process documents
- Update and delete documents
- Manage namespaces and metadata

### 2. `tools.js` - LLM Integration
Exposes a single tool to the LLM for querying the RAG system:
- `query_rag_system` - Allows the LLM to search for relevant information in the vector database

This separation ensures that the LLM only has access to query capabilities, while developers have full control over building and managing the knowledge base.

## Features

### Developer Tools (`ragTools.js`)
- **OpenAI Embeddings Generation**
  - Support for all OpenAI embedding models:
    - `text-embedding-3-small` (most cost-effective)
    - `text-embedding-3-large` (highest performance)
    - `text-embedding-ada-002` (legacy model)
  - Dimension reduction support for newer models
  - Batch processing capabilities

- **Pinecone Vector Database Management**
  - Create and delete indexes
  - Save embeddings with metadata
  - Update document metadata
  - Namespace support for data organization
  - Batch document processing
  - Index statistics and monitoring

### LLM Tool (`tools.js`)
- **RAG Query System**
  - Semantic search through embedded documents
  - Configurable result count (1-20)
  - Namespace-specific searches
  - Metadata filtering
  - Formatted results for LLM consumption

## Installation

```bash
npm install
```

## Environment Setup

Create a `.env` file in your project root:

```env
OPENAI_API_KEY=your_openai_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
```

## Usage

### Building a RAG System (Developer Workflow)

```javascript
const { 
  createPineconeIndex, 
  batchProcessDocuments,
  getIndexStats 
} = require('./ragTools');

// 1. Create a Pinecone index
await createPineconeIndex('my-knowledge-base', 1536);

// 2. Prepare your documents
const documents = [
  {
    id: 'doc1',
    text: 'Your document content here',
    metadata: { 
      title: 'Document Title',
      category: 'technical'
    }
  }
  // ... more documents
];

// 3. Batch process and embed documents
const result = await batchProcessDocuments(
  documents,
  'my-knowledge-base',
  '', // namespace (optional)
  'text-embedding-3-small',
  100 // batch size
);

// 4. Check index statistics
const stats = await getIndexStats('my-knowledge-base');
console.log('Index stats:', stats);
```

### Querying the RAG System (LLM Integration)

```javascript
const { executeTool } = require('./tools');

// Execute the RAG query tool as the LLM would
const result = await executeTool('query_rag_system', {
  query: 'What is machine learning?',
  index_name: 'my-knowledge-base',
  top_k: 5,
  namespace: '', // optional
  filter: { category: 'technical' } // optional
});

// The result is a JSON string with relevant documents
const parsedResult = JSON.parse(result);
console.log(`Found ${parsedResult.matches_found} relevant documents`);
```

## API Reference

### RAG Tools (`ragTools.js`)

#### `generateEmbeddings(text, model, dimensions)`
Generate embeddings from text using OpenAI models.

#### `createPineconeIndex(indexName, dimension, metric, cloud, region)`
Create a new Pinecone index with serverless configuration.

#### `saveToPinecone(indexName, vectors, namespace)`
Save vector embeddings to Pinecone.

#### `batchProcessDocuments(documents, indexName, namespace, model, batchSize)`
Process multiple documents efficiently in batches.

#### `updateDocumentMetadata(indexName, documentId, metadata, namespace)`
Update metadata for existing documents.

#### `deleteDocuments(indexName, documentIds, namespace)`
Remove documents from the index.

#### `getIndexStats(indexName, namespace)`
Get statistics about index usage and capacity.

### LLM Tool (`tools.js`)

#### Tool: `query_rag_system`
Query the RAG system to retrieve relevant information.

**Parameters:**
- `query` (string, required): The search query
- `index_name` (string, required): The Pinecone index to search
- `top_k` (integer, optional): Number of results (1-20, default: 5)
- `namespace` (string, optional): Namespace to search within
- `filter` (object, optional): Metadata filter for refined search

**Returns:** JSON string with search results including scores and metadata.

## Embedding Models Comparison

| Model | Dimensions | Cost | Best For |
|-------|------------|------|----------|
| text-embedding-3-small | 1536 (reducible) | Lowest | General purpose, cost-sensitive applications |
| text-embedding-3-large | 3072 (reducible) | Higher | Maximum accuracy, performance-critical apps |
| text-embedding-ada-002 | 1536 | Medium | Legacy support |

## Best Practices

### For Developers (Building RAG Systems)

1. **Batch Processing**: Use `batchProcessDocuments` for efficient document ingestion
2. **Namespaces**: Organize different types of content in separate namespaces
3. **Metadata**: Include rich metadata for better filtering and context
4. **Monitoring**: Regularly check index statistics to monitor usage
5. **Updates**: Use `updateDocumentMetadata` to keep information current

### For LLM Integration

1. **Query Optimization**: Keep queries concise and specific
2. **Result Limits**: Use appropriate `top_k` values (3-5 for most cases)
3. **Filtering**: Use metadata filters to improve result relevance
4. **Error Handling**: Always handle potential errors from the tool
5. **Context Usage**: Use retrieved documents as context for response generation

## Example: Complete RAG Implementation

See `example-usage.js` for a complete example showing:
- Building a document Q&A system using `ragTools.js`
- Querying the system using `tools.js`
- Handling namespaces and filters
- Error handling and best practices

## Testing

Run the comprehensive test suite:

```bash
npm test
```

This will test:
- Embedding generation with different models
- Index creation and management
- Document processing and retrieval
- LLM tool integration
- Namespace and filter operations

## Architecture Benefits

1. **Security**: LLM only has read access to the knowledge base
2. **Flexibility**: Developers have full control over content management
3. **Scalability**: Batch processing and namespace support for large datasets
4. **Maintainability**: Clear separation of concerns
5. **Monitoring**: Comprehensive logging and statistics

## License

MIT 