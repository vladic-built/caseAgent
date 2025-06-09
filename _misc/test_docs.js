// Test data
const testDocuments = [
    {
        patient_id: '6789',
        doc_id: '6789PI',
        type: 'Patient Information',
        text: 'Patient: John Smith, DOB: 03/15/1978, MRN: 12345678. Chief Complaint: Chest pain and shortness of breath for 2 days. Patient reports substernal chest pressure radiating to left arm, associated with diaphoresis and nausea. Pain rated 7/10, worsens with exertion.'
    },
    {
        patient_id: '6789',
        doc_id: '6789VS',
        type: 'Vital Signs',
        text: 'Vital Signs: BP 145/92 mmHg, HR 98 bpm, RR 22/min, Temp 98.6°F, O2 Sat 94% on room air. Physical Exam: Anxious appearing male, diaphoretic, lungs with bilateral crackles at bases, heart sounds regular with S3 gallop, no murmurs, peripheral edema 2+ bilateral.'
    },
    {
        patient_id: '6789',
        doc_id: '6789PMH',
        type: 'Past Medical History',
        text: 'Past Medical History: Hypertension diagnosed 2015, Type 2 Diabetes Mellitus since 2018, Hyperlipidemia, Family history of coronary artery disease (father MI at age 55). Current medications: Lisinopril 10mg daily, Metformin 1000mg twice daily, Atorvastatin 40mg nightly.'
    },
    {
        patient_id: '6789',
        doc_id: '6789LR',
        type: 'Lab Results',
        text: 'Laboratory Results: Troponin I elevated at 2.8 ng/mL (normal <0.04), CK-MB 15.2 ng/mL (elevated), BNP 450 pg/mL (elevated), Glucose 185 mg/dL, HbA1c 8.2%, Total cholesterol 245 mg/dL, LDL 165 mg/dL, Creatinine 1.2 mg/dL.'
    },
    {
        patient_id: '6789',
        doc_id: '6789DI',
        type: 'Diagnostic Imaging',
        text: 'Diagnostic Imaging: ECG shows ST elevation in leads II, III, aVF consistent with inferior STEMI. Chest X-ray reveals mild pulmonary edema and cardiomegaly. Echocardiogram pending. Assessment: Acute ST-elevation myocardial infarction, acute heart failure, poorly controlled diabetes.'
    }
];

// Import required libraries
const OpenAI = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Pinecone
const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});

/**
 * Create a Pinecone index if it doesn't already exist
 * @param {string} indexName - Name of the index to create
 * @param {number} dimension - Dimension of the vectors (3072 for text-embedding-3-large)
 */
async function createIndexIfNotExists(indexName, dimension = 1536) {
    try {
        // Check if index exists
        const existingIndexes = await pc.listIndexes();
        const indexNames = existingIndexes.indexes?.map(index => index.name) || [];
        
        if (!indexNames.includes(indexName)) {
            console.log(`🔨 Creating Pinecone index: ${indexName}`);
            await pc.createIndex({
                name: indexName,
                dimension: dimension,
                metric: 'cosine',
                spec: {
                    serverless: {
                        cloud: 'aws',
                        region: 'us-east-1'
                    }
                }
            });
            console.log(`✅ Successfully created index: ${indexName}`);
        } else {
            console.log(`✅ Index already exists: ${indexName}`);
        }
    } catch (error) {
        console.error(`❌ Error creating index: ${error}`);
        throw error;
    }
}

/**
 * Generate embeddings for the given text using OpenAI's embedding model
 * @param {string} text - The text to generate embeddings for
 * @returns {Array<number>} The embedding vector
 */
async function generateEmbeddings(text) {
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error(`❌ Error generating embeddings: ${error}`);
        throw error;
    }
}

/**
 * Save embedding and metadata to Pinecone index
 * @param {string} indexName - Name of the Pinecone index
 * @param {string} docId - Unique identifier for the document
 * @param {Array<number>} embedding - The embedding vector
 * @param {Object} metadata - Metadata to store with the vector
 * @param {string} namespace - Optional namespace for organizing data
 */
async function saveToPinecone(indexName, docId, embedding, metadata, namespace = '') {
    try {
        // Get the index
        const index = pc.Index(indexName);
        
        // Prepare the vector for upserting
        const vector = {
            id: docId,
            values: embedding,
            metadata: metadata
        };
        
        // Upsert the vector
        if (namespace) {
            await index.namespace(namespace).upsert([vector]);
        } else {
            await index.upsert([vector]);
        }
        
        console.log(`✅ Successfully saved vector to Pinecone: ${docId}`);
    } catch (error) {
        console.error(`❌ Error saving to Pinecone: ${error}`);
        throw error;
    }
}
  
/**
 * Simple function to embed test documents and upsert to Pinecone
 * @param {Array} documents - Array of document objects with patient_id, doc_id, type, and text
 * @param {string} indexName - Name of the Pinecone index to upsert to
 * @param {string} namespace - Optional namespace for organizing data
 */
async function embedAndUpsertDocuments(documents, indexName, namespace = '') {
    try {
        console.log(`🚀 Starting to embed and upsert ${documents.length} documents...`);
        
        for (const doc of documents) {
            // Generate embedding for the document text
            const embedding = await generateEmbeddings(doc.text);
            
            // Prepare metadata
            const metadata = {
                patient_id: doc.patient_id,
                type: doc.type,
                text: doc.text,
                timestamp: new Date().toISOString()
            };
            
            // Upsert to Pinecone
            await saveToPinecone(indexName, doc.doc_id, embedding, metadata, namespace);
            
            console.log(`✅ Embedded and upserted document: ${doc.doc_id} (${doc.type})`);
        }
        
        console.log('🎉 All documents successfully embedded and upserted!');
    } catch (error) {
        console.error('❌ Error embedding and upserting documents:', error);
        throw error;
    }
}

// Main function to test the embedding and upserting process
async function main() {
    const indexName = "client-documents"; // Replace with your actual index name
    const namespace = testDocuments[0].patient_id; // Optional namespace
    
    // Create index if it doesn't exist
    await createIndexIfNotExists(indexName);
    
    // Wait a moment for index to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await embedAndUpsertDocuments(testDocuments, indexName, namespace);
}

// Run the main function if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}