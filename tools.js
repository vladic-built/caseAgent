const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');

// Load environment variables
require('dotenv').config();

/**
 * Tools Module for LLM Integration
 * This module exposes only the retrieval tool to the LLM
 * The LLM can use this tool to query the RAG system and retrieve relevant information
 * from the vector database based on semantic similarity
 */

/**
 * Enhanced logging function specifically for tool operations
 * Provides timestamped console output with optional structured data
 * @param {string} message - The main log message to display
 * @param {Object|null} data - Optional structured data to log as JSON
 */
function logTool(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[TOOLS ${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * OpenAI client initialization
 * Required for generating query embeddings during retrieval
 */
let openaiClient;
try {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  logTool('✅ OpenAI client initialized successfully');
} catch (error) {
  logTool('❌ Error initializing OpenAI client:', {
    message: error.message,
    stack: error.stack
  });
}

/**
 * Pinecone client initialization
 * Required for querying the vector database
 */
let pineconeClient;
try {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY environment variable is not set');
  }
  
  pineconeClient = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });
  logTool('✅ Pinecone client initialized successfully');
} catch (error) {
  logTool('❌ Error initializing Pinecone client:', {
    message: error.message,
    stack: error.stack
  });
}

/**
 * Tool definition for the LLM
 * Only exposes the RAG query tool for retrieving information
 */
const tools = [
  {
    name: 'query_rag_system',
    description: 'Query the RAG (Retrieval-Augmented Generation) system to retrieve relevant information from the vector database. This tool searches through embedded documents and returns the most semantically similar content based on your query. Use this when you need to find specific information from the knowledge base.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query or question to find relevant information for'
        },
        index_name: {
          type: 'string',
          description: 'The name of the Pinecone index to search in'
        },
        top_k: {
          type: 'integer',
          description: 'Number of most relevant results to return (default: 5, max: 20)',
          minimum: 1,
          maximum: 20
        },
        namespace: {
          type: 'string',
          description: 'Optional namespace to search within. Leave empty to search the default namespace'
        },
        filter: {
          type: 'object',
          description: 'Optional metadata filter to refine search results. Example: {"category": "technical", "year": 2024}'
        }
      },
      required: ['query', 'index_name']
    }
  }
];

/**
 * Internal function to generate embeddings for the query
 * Not exposed to the LLM - used internally by the retrieval function
 */
async function generateQueryEmbedding(query, model = 'text-embedding-3-small') {
  try {
    if (!openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await openaiClient.embeddings.create({
      input: query,
      model: model
    });

    return response.data[0].embedding;
  } catch (error) {
    logTool('❌ Error generating query embedding:', error);
    throw error;
  }
}

/**
 * Query the RAG system to retrieve relevant information
 * This is the main function exposed to the LLM for information retrieval
 * 
 * @param {string} query - The search query
 * @param {string} indexName - The Pinecone index to search
 * @param {number} topK - Number of results to return
 * @param {string} namespace - Optional namespace
 * @param {Object} filter - Optional metadata filter
 * @returns {Object} Search results with relevant documents and metadata
 */
async function queryRAGSystem(query, indexName = 'client-documents', topK = 5, namespace = '6789', filter = null) {
  logTool('🔎 QUERYING RAG SYSTEM', {
    query: query,
    index_name: 'client-documents',
    top_k: topK,
    namespace: '6789',
    has_filter: !!filter
  });

  try {
    // Validate inputs
    if (!query || !indexName) {
      throw new Error('Query and index name are required');
    }

    if (!pineconeClient) {
      throw new Error('Pinecone client not initialized');
    }

    // Limit topK to reasonable bounds
    topK = 5;

    // Step 1: Generate embedding for the query
    logTool('Generating query embedding...');
    const queryVector = await generateQueryEmbedding(query);

    // Step 2: Query Pinecone
    const index = pineconeClient.index(indexName);
    const target = namespace ? index.namespace(namespace) : index;

    const queryParams = {
      vector: queryVector,
      topK: topK,
      includeMetadata: true,
      includeValues: false
    };

    if (filter) {
      queryParams.filter = filter;
    }

    const response = await target.query(queryParams);

    // Step 3: Format results for the LLM
    const results = {
      query: query,
      matches_found: response.matches.length,
      results: response.matches.map(match => ({
        score: match.score,
        id: match.id,
        metadata: match.metadata
      }))
    };

    logTool('✅ RAG query completed successfully', {
      matches_found: results.matches_found
    });

    // Return formatted results
    return JSON.stringify(results, null, 2);

  } catch (error) {
    logTool('❌ RAG query failed:', error);
    throw error;
  }
}

/**
 * Main tool execution function
 * Routes the LLM's tool calls to the appropriate function
 */
async function executeTool(toolName, input) {
  logTool('🔧 EXECUTING TOOL:', toolName);

  try {
    let result;

    switch (toolName) {
      case 'query_rag_system':
        result = await queryRAGSystem(
          input.query,
          'client-documents',
          input.top_k,  
          '6789', //Client ID
          input.filter
        );  
        break;

      default:
        logTool('❌ Unknown tool requested:', toolName);
        throw new Error(`Unknown tool: ${toolName}`);
    }

    logTool('✅ TOOL COMPLETED:', toolName);
    return result;

  } catch (error) {
    logTool('❌ TOOL FAILED:', { tool: toolName, error: error.message });
    throw error;
  }
}

/**
 * Module exports
 * Only exposes the tools array and executeTool function to the LLM
 * The LLM uses these to understand available tools and execute them
 */
module.exports = {
  tools,
  executeTool
};


/**
 * Test script - runs when file is executed directly
 */
// if (require.main === module) {
//   async function runTests() {
//     console.log('🧪 Running tools.js test script...\n');
    
//     try {
//       // Test 1: Generate Query Embedding
//       console.log('📝 Test 1: Generate Query Embedding');
//       const testQuery = "who is Ethan's girlfriend?";
//       console.log(`Query: "${testQuery}"`);
      
//       const embedding = await generateQueryEmbedding(testQuery);
//       console.log(`✅ Embedding generated successfully (length: ${embedding.length})`);
//       console.log(`First 5 values: [${embedding.slice(0, 5).join(', ')}...]\n`);
      
//       // Test 2: Query RAG System
//       console.log('🔍 Test 2: Query RAG System');
//       const ragQuery = "who is Ethan's girlfriend?";
//       console.log(`Query: "${ragQuery}"`);
      
//       const ragResults = await queryRAGSystem(
//         ragQuery,
//         'client-documents',
//         5,  // top_k
//         '6789', // Client ID
//         {} // filter
//       );
      
//       console.log(`✅ RAG query completed successfully`);
//       console.log('📋 Full RAG Results:');
//       console.log(JSON.stringify(ragResults, null, 2));
      
//       console.log('🎉 All tests completed successfully!');
      
//     } catch (error) {
//       console.error('❌ Test failed:', error.message);
//       console.error('Stack trace:', error.stack);
//       process.exit(1);
//     }
//   }
  
//   runTests();
// }
