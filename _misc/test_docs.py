# Test data
test_documents = [
    {
        'patient_id': '6789',
        'doc_id': '6789PI',
        'type': 'Patient Information',
        'text': 'Patient: John Smith, DOB: 03/15/1978, MRN: 12345678. Chief Complaint: Chest pain and shortness of breath for 2 days. Patient reports substernal chest pressure radiating to left arm, associated with diaphoresis and nausea. Pain rated 7/10, worsens with exertion.'
    },
    {
        'patient_id': '6789',
        'doc_id': '6789VS',
        'type': 'Vital Signs',
        'text': 'Vital Signs: BP 145/92 mmHg, HR 98 bpm, RR 22/min, Temp 98.6°F, O2 Sat 94% on room air. Physical Exam: Anxious appearing male, diaphoretic, lungs with bilateral crackles at bases, heart sounds regular with S3 gallop, no murmurs, peripheral edema 2+ bilateral.'
    },
    {
        'patient_id': '6789',
        'doc_id': '6789PMH',
        'type': 'Past Medical History',
        'text': 'Past Medical History: Hypertension diagnosed 2015, Type 2 Diabetes Mellitus since 2018, Hyperlipidemia, Family history of coronary artery disease (father MI at age 55). Current medications: Lisinopril 10mg daily, Metformin 1000mg twice daily, Atorvastatin 40mg nightly.'
    },
    {
        'patient_id': '6789',
        'doc_id': '6789LR',
        'type': 'Lab Results',
        'text': 'Laboratory Results: Troponin I elevated at 2.8 ng/mL (normal <0.04), CK-MB 15.2 ng/mL (elevated), BNP 450 pg/mL (elevated), Glucose 185 mg/dL, HbA1c 8.2%, Total cholesterol 245 mg/dL, LDL 165 mg/dL, Creatinine 1.2 mg/dL.'
    },
    {
        'patient_id': '6789',
        'doc_id': '6789DI',
        'type': 'Diagnostic Imaging',
        'text': 'Diagnostic Imaging: ECG shows ST elevation in leads II, III, aVF consistent with inferior STEMI. Chest X-ray reveals mild pulmonary edema and cardiomegaly. Echocardiogram pending. Assessment: Acute ST-elevation myocardial infarction, acute heart failure, poorly controlled diabetes.'
    }
]

# Import required libraries
from datetime import datetime
import asyncio
import openai
from pinecone import Pinecone
import os
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Initialize OpenAI client
client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Initialize Pinecone
pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))


def create_index_if_not_exists(index_name: str, dimension: int = 1536):
    """
    Create a Pinecone index if it doesn't already exist
    
    Args:
        index_name (str): Name of the index to create
        dimension (int): Dimension of the vectors (1536 for text-embedding-3-small)
    """
    try:
        # Check if index exists
        existing_indexes = [index.name for index in pc.list_indexes()]
        
        if index_name not in existing_indexes:
            print(f"🔨 Creating Pinecone index: {index_name}")
            pc.create_index(
                name=index_name,
                dimension=dimension,
                metric='cosine',
                spec={
                    'serverless': {
                        'cloud': 'aws',
                        'region': 'us-east-1'
                    }
                }
            )
            print(f"✅ Successfully created index: {index_name}")
        else:
            print(f"✅ Index already exists: {index_name}")
            
    except Exception as error:
        print(f"❌ Error creating index: {error}")
        raise error


def generate_embeddings(text: str) -> List[float]:
    """
    Generate embeddings for the given text using OpenAI's embedding model
    
    Args:
        text (str): The text to generate embeddings for
        
    Returns:
        List[float]: The embedding vector
    """
    try:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding
    except Exception as error:
        print(f"❌ Error generating embeddings: {error}")
        raise error


async def save_to_pinecone(index_name: str, doc_id: str, embedding: List[float], 
                          metadata: Dict[str, Any], namespace: str = '') -> None:
    """
    Save embedding and metadata to Pinecone index
    
    Args:
        index_name (str): Name of the Pinecone index
        doc_id (str): Unique identifier for the document
        embedding (List[float]): The embedding vector
        metadata (Dict[str, Any]): Metadata to store with the vector
        namespace (str): Optional namespace for organizing data
    """
    try:
        # Get the index
        index = pc.Index(index_name)
        
        # Prepare the vector for upserting
        vector = {
            'id': doc_id,
            'values': embedding,
            'metadata': metadata
        }
        
        # Upsert the vector
        if namespace:
            index.upsert(vectors=[vector], namespace=namespace)
        else:
            index.upsert(vectors=[vector])
            
        print(f"✅ Successfully saved vector to Pinecone: {doc_id}")
        
    except Exception as error:
        print(f"❌ Error saving to Pinecone: {error}")
        raise error


async def embed_and_upsert_documents(documents, index_name, namespace=''):
    """
    Simple function to embed test documents and upsert to Pinecone
    
    Args:
        documents (list): Array of document objects with id, type, and text
        index_name (str): Name of the Pinecone index to upsert to
        namespace (str): Optional namespace for organizing data
    """
    try:
        print(f"🚀 Starting to embed and upsert {len(documents)} documents...")
        
        for doc in documents:
            # Generate embedding for the document text
            embedding = generate_embeddings(doc['text'])
            
            # Prepare metadata
            metadata = {
                'patient_id': doc['patient_id'],
                'type': doc['type'],
                'text': doc['text'],
                'timestamp': datetime.now().isoformat()
            }
            
            # Upsert to Pinecone
            await save_to_pinecone(index_name, doc['doc_id'], embedding, metadata, namespace)
            
            print(f"✅ Embedded and upserted document: {doc['doc_id']} ({doc['type']})")
        
        print("🎉 All documents successfully embedded and upserted!")
    except Exception as error:
        print(f"❌ Error embedding and upserting documents: {error}")
        raise error


# Optional: Add a main function to run the test
async def main():
    """Main function to test the embedding and upserting process"""
    index_name = "client-documents"  # Replace with your actual index name
    namespace = test_documents[0]['patient_id']  # Optional namespace
    
    # Create index if it doesn't exist
    create_index_if_not_exists(index_name)
    
    # Wait a moment for index to be ready
    import time
    time.sleep(5)
    
    await embed_and_upsert_documents(test_documents, index_name, namespace)


if __name__ == "__main__":
    asyncio.run(main()) 