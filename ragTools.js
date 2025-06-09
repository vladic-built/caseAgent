const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');

// Load environment variables
require('dotenv').config();

/**
 * RAG Tools Module
 * Contains all workflow functions for building and managing RAG systems
 * These tools are used for content processing, embedding generation, and index management
 * Not exposed to the LLM - used by developers to build the knowledge base
 */

/**
 * Enhanced logging function for RAG operations
 * @param {string} message - The main log message to display
 * @param {Object|null} data - Optional structured data to log as JSON
 */
function logRAG(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[RAG ${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Initialize OpenAI client for embedding generation
 */
let openaiClient;
try {
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  logRAG('✅ OpenAI client initialized successfully');
} catch (error) {
  logRAG('❌ Error initializing OpenAI client:', error);
}

/**
 * Initialize Pinecone client for vector database operations
 */
let pineconeClient;
try {
  pineconeClient = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });
  logRAG('✅ Pinecone client initialized successfully');
} catch (error) {
  logRAG('❌ Error initializing Pinecone client:', error);
}

/**
 * Generate embeddings from text using OpenAI's embedding models
 * This is a workflow function used to prepare content for the RAG system
 * 
 * @param {string} text - The input text to convert to embeddings
 * @param {string} model - OpenAI embedding model to use (default: text-embedding-3-small)
 * @param {number|null} dimensions - Optional dimension reduction for newer models
 * @returns {Object} Object containing embedding vector, model info, and usage stats
 */
async function generateEmbeddings(text, model = 'text-embedding-3-small', dimensions = null) {
  logRAG('🔍 GENERATING EMBEDDINGS', {
    text_length: text.length,
    model: model,
    dimensions: dimensions
  });

  try {
    if (!openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const params = {
      input: text,
      model: model
    };

    // Add dimensions parameter only for text-embedding-3-* models
    if (dimensions && model.startsWith('text-embedding-3-')) {
      params.dimensions = dimensions;
    }

    const response = await openaiClient.embeddings.create(params);
    const embedding = response.data[0].embedding;
    
    logRAG('✅ Embeddings generated successfully', {
      model: model,
      dimensions: embedding.length,
      usage: response.usage
    });

    return {
      embedding: embedding,
      model: model,
      dimensions: embedding.length,
      usage: response.usage
    };

  } catch (error) {
    logRAG('❌ Error generating embeddings:', error);
    throw error;
  }
}

/**
 * Save vector embeddings to Pinecone vector database
 * Used during content ingestion phase to build the knowledge base
 * 
 * @param {string} indexName - Name of the Pinecone index to save to
 * @param {Array} vectors - Array of vector objects with id, values, and metadata
 * @param {string} namespace - Optional namespace for data organization
 * @returns {Object} Success status and operation details
 */
async function saveToPinecone(indexName, vectors, namespace = '') {
  logRAG('💾 SAVING TO PINECONE', {
    index_name: indexName,
    vector_count: vectors.length,
    namespace: namespace
  });

  try {
    if (!pineconeClient) {
      throw new Error('Pinecone client not initialized');
    }

    const index = pineconeClient.index(indexName);
    const target = namespace ? index.namespace(namespace) : index;
    const response = await target.upsert(vectors);
    
    logRAG('✅ Vectors saved to Pinecone successfully', {
      upserted_count: response.upsertedCount
    });

    return {
      success: true,
      upserted_count: response.upsertedCount,
      index_name: indexName,
      namespace: namespace
    };

  } catch (error) {
    logRAG('❌ Error saving to Pinecone:', error);
    throw error;
  }
}

/**
 * Create a new Pinecone index for storing embeddings
 * Used during initial setup of a RAG system
 * 
 * @param {string} indexName - Name for the new index
 * @param {number} dimension - Vector dimension size (must match embedding model)
 * @param {string} metric - Distance metric for similarity (default: cosine)
 * @param {string} cloud - Cloud provider (default: aws)
 * @param {string} region - Cloud region (default: us-east-1)
 * @returns {Object} Index creation status and details
 */
async function createPineconeIndex(indexName, dimension, metric = 'cosine', cloud = 'aws', region = 'us-east-1') {
  logRAG('📁 CREATING PINECONE INDEX', {
    index_name: indexName,
    dimension: dimension,
    metric: metric,
    cloud: cloud,
    region: region
  });

  try {
    if (!pineconeClient) {
      throw new Error('Pinecone client not initialized');
    }

    // Check if index already exists
    const indexes = await pineconeClient.listIndexes();
    const indexExists = indexes.indexes?.some(idx => idx.name === indexName);

    if (indexExists) {
      logRAG('ℹ️ Index already exists:', indexName);
      return { exists: true, name: indexName };
    }

    // Create the new index with serverless configuration
    await pineconeClient.createIndex({
      name: indexName,
      dimension: dimension,
      metric: metric,
      spec: {
        serverless: {
          cloud: cloud,
          region: region
        }
      },
      waitUntilReady: true
    });

    logRAG('✅ Pinecone index created successfully:', indexName);
    return { created: true, name: indexName };

  } catch (error) {
    logRAG('❌ Error creating Pinecone index:', error);
    throw error;
  }
}

/**
 * Delete a Pinecone index
 * Used for cleanup or resetting a RAG system
 * 
 * @param {string} indexName - Name of the index to delete
 * @returns {Object} Deletion status
 */
async function deletePineconeIndex(indexName) {
  logRAG('🗑️ DELETING PINECONE INDEX', { index_name: indexName });

  try {
    if (!pineconeClient) {
      throw new Error('Pinecone client not initialized');
    }

    await pineconeClient.deleteIndex(indexName);
    
    logRAG('✅ Pinecone index deleted successfully:', indexName);
    return { deleted: true, name: indexName };

  } catch (error) {
    logRAG('❌ Error deleting Pinecone index:', error);
    throw error;
  }
}

/**
 * List all Pinecone indexes
 * Useful for managing multiple RAG systems
 * 
 * @returns {Array} List of index information
 */
async function listPineconeIndexes() {
  logRAG('📋 LISTING PINECONE INDEXES');

  try {
    if (!pineconeClient) {
      throw new Error('Pinecone client not initialized');
    }

    const response = await pineconeClient.listIndexes();
    
    logRAG('✅ Retrieved index list', {
      count: response.indexes?.length || 0
    });

    return response.indexes || [];

  } catch (error) {
    logRAG('❌ Error listing Pinecone indexes:', error);
    throw error;
  }
}

/**
 * Get statistics for a Pinecone index
 * Useful for monitoring index usage and capacity
 * 
 * @param {string} indexName - Name of the index
 * @param {string} namespace - Optional namespace
 * @returns {Object} Index statistics
 */
async function getIndexStats(indexName, namespace = '') {
  logRAG('📊 GETTING INDEX STATISTICS', {
    index_name: indexName,
    namespace: namespace
  });

  try {
    if (!pineconeClient) {
      throw new Error('Pinecone client not initialized');
    }

    const index = pineconeClient.index(indexName);
    const target = namespace ? index.namespace(namespace) : index;
    const stats = await target.describeIndexStats();
    
    logRAG('✅ Retrieved index statistics', stats);
    return stats;

  } catch (error) {
    logRAG('❌ Error getting index statistics:', error);
    throw error;
  }
}

/**
 * Batch process documents for embedding and storage
 * Efficiently processes multiple documents for RAG system
 * 
 * @param {Array} documents - Array of documents with id and text
 * @param {string} indexName - Pinecone index to store in
 * @param {string} namespace - Optional namespace
 * @param {string} model - Embedding model to use
 * @param {number} batchSize - Number of documents to process at once
 * @returns {Object} Processing results
 */
async function batchProcessDocuments(
  documents, 
  indexName, 
  namespace = '', 
  model = 'text-embedding-3-small',
  batchSize = 100
) {
  logRAG('📦 BATCH PROCESSING DOCUMENTS', {
    total_documents: documents.length,
    index_name: indexName,
    namespace: namespace,
    model: model,
    batch_size: batchSize
  });

  try {
    let processedCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process documents in batches
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const vectors = [];

      logRAG(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);

      // Generate embeddings for batch
      for (const doc of batch) {
        try {
          const embedding = await generateEmbeddings(doc.text, model);
          vectors.push({
            id: doc.id,
            values: embedding.embedding,
            metadata: {
              ...doc.metadata,
              text: doc.text,
              processed_at: new Date().toISOString()
            }
          });
          processedCount++;
        } catch (error) {
          errorCount++;
          errors.push({ document_id: doc.id, error: error.message });
          logRAG(`❌ Error processing document ${doc.id}:`, error.message);
        }
      }

      // Save batch to Pinecone
      if (vectors.length > 0) {
        await saveToPinecone(indexName, vectors, namespace);
      }

      // Add delay to avoid rate limits
      if (i + batchSize < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logRAG('✅ Batch processing completed', {
      processed: processedCount,
      errors: errorCount,
      success_rate: `${((processedCount / documents.length) * 100).toFixed(2)}%`
    });

    return {
      total: documents.length,
      processed: processedCount,
      errors: errorCount,
      error_details: errors
    };

  } catch (error) {
    logRAG('❌ Error in batch processing:', error);
    throw error;
  }
}

/**
 * Update document metadata in Pinecone
 * Useful for maintaining and updating the knowledge base
 * 
 * @param {string} indexName - Name of the index
 * @param {string} documentId - ID of the document to update
 * @param {Object} metadata - New metadata to merge
 * @param {string} namespace - Optional namespace
 * @returns {Object} Update status
 */
async function updateDocumentMetadata(indexName, documentId, metadata, namespace = '') {
  logRAG('📝 UPDATING DOCUMENT METADATA', {
    index_name: indexName,
    document_id: documentId,
    namespace: namespace
  });

  try {
    if (!pineconeClient) {
      throw new Error('Pinecone client not initialized');
    }

    const index = pineconeClient.index(indexName);
    const target = namespace ? index.namespace(namespace) : index;
    
    // Fetch existing document
    const fetchResult = await target.fetch([documentId]);
    const existingDoc = fetchResult.records[documentId];
    
    if (!existingDoc) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Update with merged metadata
    await target.update({
      id: documentId,
      metadata: {
        ...existingDoc.metadata,
        ...metadata,
        updated_at: new Date().toISOString()
      }
    });

    logRAG('✅ Document metadata updated successfully');
    return { success: true, document_id: documentId };

  } catch (error) {
    logRAG('❌ Error updating document metadata:', error);
    throw error;
  }
}

/**
 * Delete documents from Pinecone
 * Used for removing outdated or incorrect information
 * 
 * @param {string} indexName - Name of the index
 * @param {Array} documentIds - Array of document IDs to delete
 * @param {string} namespace - Optional namespace
 * @returns {Object} Deletion status
 */
async function deleteDocuments(indexName, documentIds, namespace = '') {
  logRAG('🗑️ DELETING DOCUMENTS', {
    index_name: indexName,
    document_count: documentIds.length,
    namespace: namespace
  });

  try {
    if (!pineconeClient) {
      throw new Error('Pinecone client not initialized');
    }

    const index = pineconeClient.index(indexName);
    const target = namespace ? index.namespace(namespace) : index;
    
    await target.deleteMany(documentIds);

    logRAG('✅ Documents deleted successfully');
    return { 
      success: true, 
      deleted_count: documentIds.length,
      deleted_ids: documentIds 
    };

  } catch (error) {
    logRAG('❌ Error deleting documents:', error);
    throw error;
  }
}

// Export all RAG workflow tools
module.exports = {
  generateEmbeddings,
  saveToPinecone,
  createPineconeIndex,
  deletePineconeIndex,
  listPineconeIndexes,
  getIndexStats,
  batchProcessDocuments,
  updateDocumentMetadata,
  deleteDocuments,
  // Export clients for advanced usage
  getOpenAIClient: () => openaiClient,
  getPineconeClient: () => pineconeClient
}; 