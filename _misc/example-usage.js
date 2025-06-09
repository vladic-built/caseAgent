require('dotenv').config();

// Import workflow tools from ragTools.js for building the RAG system
const { 
  generateEmbeddings, 
  saveToPinecone, 
  createPineconeIndex,
  batchProcessDocuments,
  updateDocumentMetadata,
  getIndexStats
} = require('../ragTools');

// Import the LLM tool execution from tools.js
const { executeTool } = require('../tools');

/**
 * Example: Building a Document Q&A System
 * This example shows how to:
 * 1. Build a RAG system using ragTools.js (developer workflow)
 * 2. Query the system using tools.js (LLM interaction)
 */

// Sample documents about different programming languages
const programmingDocs = [
  {
    id: 'js-1',
    title: 'JavaScript Overview',
    content: 'JavaScript is a high-level, interpreted programming language that conforms to the ECMAScript specification. It is a dynamic, weakly typed, prototype-based, multi-paradigm language. JavaScript is primarily known as the scripting language for Web pages, but it\'s also used in many non-browser environments such as Node.js.'
  },
  {
    id: 'py-1',
    title: 'Python Introduction',
    content: 'Python is a high-level, interpreted, general-purpose programming language. Its design philosophy emphasizes code readability with the use of significant indentation. Python is dynamically typed and garbage-collected. It supports multiple programming paradigms, including structured, object-oriented and functional programming.'
  },
  {
    id: 'java-1',
    title: 'Java Basics',
    content: 'Java is a high-level, class-based, object-oriented programming language that is designed to have as few implementation dependencies as possible. It is a general-purpose programming language intended to let programmers write once, run anywhere (WORA), meaning that compiled Java code can run on all platforms that support Java.'
  },
  {
    id: 'rust-1',
    title: 'Rust Language',
    content: 'Rust is a multi-paradigm, general-purpose programming language designed for performance and safety, especially safe concurrency. Rust is syntactically similar to C++, but can guarantee memory safety by using a borrow checker to validate references. Rust achieves memory safety without garbage collection.'
  },
  {
    id: 'go-1',
    title: 'Go Programming',
    content: 'Go, also known as Golang, is a statically typed, compiled programming language designed at Google. Go is syntactically similar to C, but with memory safety, garbage collection, structural typing, and CSP-style concurrency. It is often used for building scalable network services and cloud infrastructure.'
  }
];

async function setupDocumentQA() {
  console.log('🚀 Setting up Document Q&A System\n');
  console.log('=== PHASE 1: Building the RAG System (Developer Workflow) ===\n');

  try {
    // Step 1: Create or connect to Pinecone index
    const indexName = 'programming-qa';
    console.log('📁 Creating Pinecone index...');
    await createPineconeIndex(indexName, 1536, 'cosine');
    console.log('✅ Index ready\n');

    // Step 2: Prepare documents for batch processing
    console.log('📄 Preparing documents for processing...');
    const documentsForProcessing = programmingDocs.map(doc => ({
      id: doc.id,
      text: `${doc.title}: ${doc.content}`,
      metadata: {
        title: doc.title,
        type: 'programming-language',
        source: 'documentation'
      }
    }));

    // Step 3: Batch process and embed documents
    console.log('🔄 Batch processing documents...');
    const batchResult = await batchProcessDocuments(
      documentsForProcessing,
      indexName,
      '', // default namespace
      'text-embedding-3-small',
      3 // batch size
    );
    
    console.log(`✅ Processing complete:`, batchResult, '\n');

    // Wait for indexing
    console.log('⏳ Waiting for indexing to complete...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check index statistics
    const stats = await getIndexStats(indexName);
    console.log('📊 Index statistics:', stats, '\n');

    // Step 4: Add specialized documents to different namespace
    console.log('📚 Adding specialized documents to namespace...');
    const specializedDocs = [
      {
        id: 'js-frameworks',
        text: 'JavaScript Frameworks: Popular JavaScript frameworks include React, Vue.js, and Angular. React, developed by Facebook, uses a virtual DOM for efficient updates. Vue.js is known for its simplicity and gentle learning curve. Angular, maintained by Google, is a full-featured framework with TypeScript support.',
        metadata: {
          title: 'JavaScript Frameworks',
          category: 'frameworks',
          year: 2024
        }
      },
      {
        id: 'py-datascience',
        text: 'Python for Data Science: Python is the leading language for data science and machine learning. Libraries like NumPy, Pandas, and Scikit-learn provide powerful tools for data analysis. TensorFlow and PyTorch are popular frameworks for deep learning applications.',
        metadata: {
          title: 'Python for Data Science',
          category: 'data-science',
          year: 2024
        }
      }
    ];

    await batchProcessDocuments(
      specializedDocs,
      indexName,
      'specialized', // namespace for specialized content
      'text-embedding-3-small',
      2
    );
    console.log('✅ Specialized documents added\n');

    // Update metadata for a document
    console.log('📝 Updating document metadata...');
    await updateDocumentMetadata(
      indexName,
      'js-1',
      { last_updated: new Date().toISOString(), version: '2.0' }
    );
    console.log('✅ Metadata updated\n');

    console.log('=== PHASE 2: Querying the RAG System (LLM Interaction) ===\n');
    console.log('🤖 Demonstrating how an LLM would query the system:\n');

    // Example questions that an LLM might need to answer
    const llmQueries = [
      {
        question: 'What makes Python good for beginners?',
        context: 'User is asking about Python\'s beginner-friendliness'
      },
      {
        question: 'Which language is best for web development?',
        context: 'User wants to know about web development languages'
      },
      {
        question: 'Tell me about memory safety in programming',
        context: 'User is interested in memory-safe languages'
      },
      {
        question: 'What frameworks are available for JavaScript?',
        context: 'User specifically asking about JS frameworks',
        useNamespace: 'specialized'
      },
      {
        question: 'Which languages are used for data science?',
        context: 'User interested in data science languages',
        useFilter: { category: 'data-science' }
      }
    ];

    for (const queryInfo of llmQueries) {
      console.log(`\n❓ User Question: "${queryInfo.question}"`);
      console.log(`📋 Context: ${queryInfo.context}`);
      
      // Build the tool input as the LLM would
      const toolInput = {
        query: queryInfo.question,
        index_name: indexName,
        top_k: 3
      };

      // Add namespace if specified
      if (queryInfo.useNamespace) {
        toolInput.namespace = queryInfo.useNamespace;
        console.log(`🏷️  Using namespace: ${queryInfo.useNamespace}`);
      }

      // Add filter if specified
      if (queryInfo.useFilter) {
        toolInput.filter = queryInfo.useFilter;
        console.log(`🔍 Using filter:`, queryInfo.useFilter);
      }

      // Execute the tool as the LLM would
      console.log('\n🤖 LLM executing query_rag_system tool...');
      const result = await executeTool('query_rag_system', toolInput);
      
      // Parse and display results
      const parsedResult = JSON.parse(result);
      console.log(`\n📚 Retrieved ${parsedResult.matches_found} relevant documents:`);
      
      parsedResult.results.forEach((match, i) => {
        console.log(`\n${i + 1}. [Score: ${match.score.toFixed(3)}]`);
        console.log(`   Title: ${match.metadata.title || 'N/A'}`);
        console.log(`   Content: ${match.metadata.text ? match.metadata.text.substring(0, 150) + '...' : 'N/A'}`);
      });

      console.log('\n💡 The LLM would now use these contexts to generate a response');
      console.log('─'.repeat(80));
    }

    // Demonstrate error handling
    console.log('\n\n=== Error Handling Example ===\n');
    console.log('🔴 Testing with invalid index name...');
    
    try {
      await executeTool('query_rag_system', {
        query: 'Test query',
        index_name: 'non-existent-index',
        top_k: 3
      });
    } catch (error) {
      console.log('✅ Error properly caught:', error.message);
    }

    console.log('\n\n✨ Document Q&A System Demo Complete!\n');
    console.log('Summary:');
    console.log('- Built RAG system using ragTools.js (developer workflow)');
    console.log('- Demonstrated LLM queries using tools.js (LLM interaction)');
    console.log('- Showed namespace and filter capabilities');
    console.log('- Demonstrated error handling\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Utility function showing how to integrate the RAG query into an LLM response
 * This simulates how an LLM would use the retrieved context
 */
async function simulateLLMResponse(question, indexName) {
  console.log('\n🤖 Simulating LLM Response Generation');
  console.log(`Question: "${question}"`);

  try {
    // Step 1: LLM queries the RAG system
    const ragResult = await executeTool('query_rag_system', {
      query: question,
      index_name: indexName,
      top_k: 3
    });

    const contexts = JSON.parse(ragResult);
    
    // Step 2: LLM would use these contexts to generate response
    console.log('\nRetrieved contexts:');
    contexts.results.forEach((ctx, i) => {
      console.log(`${i + 1}. ${ctx.metadata.title} (relevance: ${(ctx.score * 100).toFixed(1)}%)`);
    });

    console.log('\n📝 LLM would now generate response using these contexts...');
    console.log('(In a real system, this would be sent to an LLM for response generation)');

    return contexts;
  } catch (error) {
    console.error('Error in LLM response generation:', error);
    return null;
  }
}

// Run the example
if (require.main === module) {
  setupDocumentQA();
}

module.exports = { setupDocumentQA, simulateLLMResponse }; 