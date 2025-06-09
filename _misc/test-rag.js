require('dotenv').config();

// Import workflow tools from ragTools.js
const { 
  generateEmbeddings, 
  saveToPinecone, 
  createPineconeIndex,
  batchProcessDocuments,
  getIndexStats
} = require('../ragTools');

// Import LLM tool from tools.js
const { 
  executeTool 
} = require('../tools');

// Test data
const testDocuments = [
  {
    id: '7895123456789',
    type: 'Patient Information',
    text: 'Patient: John Smith, DOB: 03/15/1978, MRN: 12345678. Chief Complaint: Chest pain and shortness of breath for 2 days. Patient reports substernal chest pressure radiating to left arm, associated with diaphoresis and nausea. Pain rated 7/10, worsens with exertion.'
  },
  {
    id: '7895123456789',
    type: 'Vital Signs',
    text: 'Vital Signs: BP 145/92 mmHg, HR 98 bpm, RR 22/min, Temp 98.6°F, O2 Sat 94% on room air. Physical Exam: Anxious appearing male, diaphoretic, lungs with bilateral crackles at bases, heart sounds regular with S3 gallop, no murmurs, peripheral edema 2+ bilateral.'
  },
  {
    id: '7895123456789',
    type: 'Past Medical History',
    text: 'Past Medical History: Hypertension diagnosed 2015, Type 2 Diabetes Mellitus since 2018, Hyperlipidemia, Family history of coronary artery disease (father MI at age 55). Current medications: Lisinopril 10mg daily, Metformin 1000mg twice daily, Atorvastatin 40mg nightly.'
  },
  {
    id: '7895123456789',
    type: 'lab',
    text: 'Laboratory Results: Troponin I elevated at 2.8 ng/mL (normal <0.04), CK-MB 15.2 ng/mL (elevated), BNP 450 pg/mL (elevated), Glucose 185 mg/dL, HbA1c 8.2%, Total cholesterol 245 mg/dL, LDL 165 mg/dL, Creatinine 1.2 mg/dL.'
  },
  {
    id: '7895123456789',
    type: 'Diagnostic Imaging',
    text: 'Diagnostic Imaging: ECG shows ST elevation in leads II, III, aVF consistent with inferior STEMI. Chest X-ray reveals mild pulmonary edema and cardiomegaly. Echocardiogram pending. Assessment: Acute ST-elevation myocardial infarction, acute heart failure, poorly controlled diabetes.'
  }
];

async function runTests() {
  console.log('🚀 Starting RAG System Tests\n');

  try {
    // Test 1: Generate embeddings with different models (using ragTools)
    console.log('📝 Test 1: Generating embeddings with different models\n');
    
    const text = 'This is a test sentence for embedding generation.';
    
    // Test text-embedding-3-small
    const embedding1 = await generateEmbeddings(text, 'text-embedding-3-small');
    console.log(`✅ text-embedding-3-small: ${embedding1.dimensions} dimensions\n`);
    
    // Test text-embedding-3-small with reduced dimensions
    const embedding2 = await generateEmbeddings(text, 'text-embedding-3-small', 512);
    console.log(`✅ text-embedding-3-small (reduced): ${embedding2.dimensions} dimensions\n`);
    
    // Test text-embedding-ada-002
    const embedding3 = await generateEmbeddings(text, 'text-embedding-ada-002');
    console.log(`✅ text-embedding-ada-002: ${embedding3.dimensions} dimensions\n`);

    // Test 2: Create Pinecone index (using ragTools)
    console.log('📝 Test 2: Creating Pinecone index\n');
    
    const indexName = 'rag-test-index';
    const indexResult = await createPineconeIndex(indexName, 1536);
    console.log(`✅ Index status:`, indexResult, '\n');

    // Test 3: Process documents using batch processing (using ragTools)
    console.log('📝 Test 3: Batch processing documents\n');
    
    const batchResult = await batchProcessDocuments(
      testDocuments,
      indexName,
      '',
      'text-embedding-3-small',
      3 // Process in batches of 3
    );
    
    console.log(`✅ Batch processing completed:`, batchResult, '\n');

    // Wait for indexing
    console.log('⏳ Waiting for vectors to be indexed...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 4: Get index statistics (using ragTools)
    console.log('📝 Test 4: Getting index statistics\n');
    
    const stats = await getIndexStats(indexName);
    console.log('📊 Index statistics:', stats, '\n');

    // Test 5: Test the LLM tool for querying (using tools.js)
    console.log('📝 Test 5: Testing LLM query tool\n');
    
    const queries = [
      'What is OpenAI?',
      'Tell me about vector databases',
      'How does RAG work?',
      'What are embeddings?'
    ];

    for (const query of queries) {
      console.log(`\n🔍 LLM Query: "${query}"`);
      
      // Execute the tool as the LLM would
      const result = await executeTool('query_rag_system', {
        query: query,
        index_name: indexName,
        top_k: 3
      });
      
      // Parse and display results
      const parsedResult = JSON.parse(result);
      console.log(`Found ${parsedResult.matches_found} matches:`);
      parsedResult.results.forEach((match, i) => {
        console.log(`  ${i + 1}. Score: ${match.score.toFixed(4)} - ${match.metadata.text.substring(0, 100)}...`);
      });
    }

    // Test 6: Test with namespace and filters (using LLM tool)
    console.log('\n\n📝 Test 6: Testing namespace and filter operations\n');
    
    // First, add some documents to a namespace with metadata
    const namespaceDocs = [
      {
        id: 'tech-1',
        text: 'Machine learning is a subset of artificial intelligence that enables systems to learn from data.',
        metadata: { category: 'technical', year: 2024 }
      },
      {
        id: 'tech-2',
        text: 'Deep learning uses neural networks with multiple layers to process complex patterns.',
        metadata: { category: 'technical', year: 2023 }
      }
    ];

    // Process namespace documents
    await batchProcessDocuments(
      namespaceDocs,
      indexName,
      'technical-docs',
      'text-embedding-3-small',
      2
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Query with namespace
    console.log('🔍 Querying with namespace...');
    const namespaceResult = await executeTool('query_rag_system', {
      query: 'What is machine learning?',
      index_name: indexName,
      namespace: 'technical-docs',
      top_k: 2
    });
    
    console.log('Namespace query results:', JSON.parse(namespaceResult).matches_found, 'matches found\n');

    // Query with filter
    console.log('🔍 Querying with metadata filter...');
    const filterResult = await executeTool('query_rag_system', {
      query: 'AI and learning',
      index_name: indexName,
      namespace: 'technical-docs',
      filter: { category: 'technical', year: 2024 },
      top_k: 5
    });
    
    const filterParsed = JSON.parse(filterResult);
    console.log(`Filter query results: ${filterParsed.matches_found} matches found`);
    if (filterParsed.matches_found > 0) {
      console.log('First match metadata:', filterParsed.results[0].metadata);
    }

    console.log('\n🎉 All tests completed successfully!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests }; 