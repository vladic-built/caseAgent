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
import tiktoken
from langchain.text_splitter import MarkdownTextSplitter


load_dotenv()

# Initialize OpenAI client
client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Initialize Pinecone
pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))


encoding = tiktoken.get_encoding("cl100k_base")

def count_tokens(text: str) -> int:
    """
    Count the number of tokens in the given text using the cl100k_base encoding
    """
    return len(encoding.encode(text))

def count_tokens_in_folder(folder_path: str = '_Ethan Rodriguez') -> Dict[str, int]:
    """
    Loop through the contents of the specified folder and count tokens in markdown files
    
    Args:
        folder_path (str): Path to the folder to scan (default: '_Ethan Rodriguez')
        
    Returns:
        Dict[str, int]: Dictionary mapping file paths to token counts
    """
    import glob
    
    token_counts = {}
    
    try:
        # Get all markdown files in the folder
        markdown_pattern = os.path.join(folder_path, "*.md")
        markdown_files = glob.glob(markdown_pattern)
        
        print(f"🔍 Scanning folder: {folder_path}")
        print(f"📄 Found {len(markdown_files)} markdown files")
        
        for file_path in markdown_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    token_count = count_tokens(content)
                    token_counts[file_path] = token_count
                    print(f"✅ {os.path.basename(file_path)}: {token_count} tokens")
                    
            except Exception as file_error:
                print(f"❌ Error reading file {file_path}: {file_error}")
                continue
        
        # Print summary
        total_tokens = sum(token_counts.values())
        print(f"\n📊 Summary:")
        print(f"Total markdown files processed: {len(token_counts)}")
        print(f"Total tokens across all files: {total_tokens}")
        
        return token_counts
        
    except Exception as error:
        print(f"❌ Error scanning folder {folder_path}: {error}")
        return {}

def split_markdown_text(markdown_text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> List[str]:
    """
    Split markdown text into chunks using MarkdownTextSplitter
    
    Args:
        markdown_text (str): The markdown text to split
        chunk_size (int): Maximum size of each chunk (default: 1000)
        chunk_overlap (int): Overlap between chunks (default: 200)
        
    Returns:
        List[str]: List of text chunks
    """
    markdown_splitter = MarkdownTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )

    chunks = markdown_splitter.split_text(markdown_text)
    return chunks

def process_all_markdown_files_in_folder(
    folder_path: str = '_Ethan Rodriguez', 
    patient_id: str = None, 
    chunk_size: int = 3000, 
    chunk_overlap: int = 200
) -> List[Dict[str, Any]]:
    """
    Process all markdown files in a folder and return chunked document objects
    
    Args:
        folder_path (str): Path to the folder containing markdown files
        patient_id (str): Patient identifier (if None, extracted from filename)
        chunk_size (int): Maximum size of each chunk (default: 3000)
        chunk_overlap (int): Overlap between chunks (default: 200)
        
    Returns:
        List[Dict[str, Any]]: List of all document chunks from all files
    """
    import glob
    
    all_document_chunks = []
    
    try:
        # Get all markdown files in the folder
        markdown_pattern = os.path.join(folder_path, "*.md")
        markdown_files = glob.glob(markdown_pattern)
        
        print(f"🔍 Processing folder: {folder_path}")
        print(f"📄 Found {len(markdown_files)} markdown files")
        
        for file_path in markdown_files:
            print(f"\n📝 Processing: {os.path.basename(file_path)}")
            
            # Process each file
            file_chunks = process_markdown_file(
                file_path=file_path,
                patient_id=patient_id,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )
            
            # Add chunks to the master list
            all_document_chunks.extend(file_chunks)
            
            print(f"✅ Added {len(file_chunks)} chunks from {os.path.basename(file_path)}")
        
        print(f"\n📊 Summary:")
        print(f"Total files processed: {len(markdown_files)}")
        print(f"Total chunks created: {len(all_document_chunks)}")
        
        return all_document_chunks
        
    except Exception as error:
        print(f"❌ Error processing folder {folder_path}: {error}")
        return []

def process_markdown_file(file_path: str, patient_id: str = None, doc_type: str = None, chunk_size: int = 3000, chunk_overlap: int = 200) -> List[Dict[str, Any]]:
    """
    Process a markdown file and return chunked document objects following the medical document schema
    
    Args:
        file_path (str): Path to the markdown file
        patient_id (str): Patient identifier (if None, extracted from filename)
        doc_type (str): Document type (if None, extracted from filename or content)
        chunk_size (int): Maximum size of each chunk (default: 3000)
        chunk_overlap (int): Overlap between chunks (default: 200)
        
    Returns:
        List[Dict[str, Any]]: List of document chunk objects following the schema
    """
    try:
        # Read the markdown file
        with open(file_path, 'r', encoding='utf-8') as file:
            markdown_content = file.read()
        
        # Check token count first
        token_count = count_tokens(markdown_content)
        print(f"📊 File token count: {token_count}")
        
        # Extract patient_id from filename if not provided
        if not patient_id:
            filename = os.path.basename(file_path)
            # Try to extract patient ID from filename (assuming format like "patient_6789_intake.md")
            import re
            patient_match = re.search(r'(\d+)', filename)
            patient_id = patient_match.group(1) if patient_match else "unknown"
        
        # Extract document type from filename if not provided
        if not doc_type:
            filename = os.path.basename(file_path)
            # Try to extract type from filename or use default
            if 'intake' in filename.lower():
                doc_type = "patient_information"
            elif 'vitals' in filename.lower():
                doc_type = "vital_signs"
            elif 'lab' in filename.lower():
                doc_type = "lab_results"
            elif 'imaging' in filename.lower():
                doc_type = "diagnostic_imaging"
            elif 'history' in filename.lower():
                doc_type = "past_medical_history"
            elif 'transcript' in filename.lower():
                doc_type = "transcript"
            else:
                doc_type = "medical_document"
        
        # If document is smaller than chunk_size, treat as single chunk
        if token_count <= chunk_size:
            print(f"📄 Document is small ({token_count} tokens), creating single chunk")
            doc_id = f"{patient_id}_{doc_type.replace(' ', '_').upper()}_0"
            
            document_chunk = {
                "patient_id": patient_id,
                "doc_id": doc_id,
                "type": doc_type,
                "text": markdown_content.strip(),
                "chunk_index": 0,
                "total_chunks": 1,
                "token_count": token_count,
                "timestamp": datetime.now().isoformat(),
                "source_file": os.path.basename(file_path),
                "is_complete_document": True
            }
            
            return [document_chunk]
        
        else:
            print(f"📄 Document is large ({token_count} tokens), splitting into chunks")
            # Split the markdown content into chunks
            chunks = split_markdown_text(markdown_content, chunk_size, chunk_overlap)
            
            # Create document objects for each chunk
            document_chunks = []
            for i, chunk_text in enumerate(chunks):
                # Generate unique doc_id for each chunk
                doc_id = f"{patient_id}_{doc_type.replace(' ', '_').upper()}_{i}"
                
                document_chunk = {
                    "patient_id": patient_id,
                    "doc_id": doc_id,
                    "type": doc_type,
                    "text": chunk_text.strip(),
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "token_count": count_tokens(chunk_text.strip()),
                    "timestamp": datetime.now().isoformat(),
                    "source_file": os.path.basename(file_path),
                    "is_complete_document": False
                }
                document_chunks.append(document_chunk)
            
            return document_chunks
        
    except Exception as error:
        print(f"❌ Error processing markdown file {file_path}: {error}")
        return []

if __name__ == "__main__":
    # Option 1: Count tokens in all files (for analysis)
    print("🔍 Token Analysis:")
    count_tokens_in_folder()
    
    print("\n" + "="*50 + "\n")
    
    # Option 2: Process all markdown files in the folder
    print("📚 Processing All Documents:")
    all_docs = process_all_markdown_files_in_folder(
        folder_path='_Ethan Rodriguez', 
        patient_id='6789',  # You can set this or let it auto-extract
        chunk_size=3000,    # Adjust based on your needs
        chunk_overlap=200   # Overlap for context preservation
    )
    
    # Display summary of processed documents
    print(f"\n📋 Final Results:")
    print(f"Total document chunks: {len(all_docs)}")
    # Save all_docs to a text file for review
    output_file = f"processed_documents_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("# PROCESSED DOCUMENTS SUMMARY\n\n")
            f.write(f"**Total document chunks:** {len(all_docs)}  \n")
            f.write(f"**Generated on:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            # Group by source file for better overview
            from collections import defaultdict
            files_summary = defaultdict(list)
            for doc in all_docs:
                files_summary[doc['source_file']].append(doc)
            
            f.write("## FILES SUMMARY\n\n")
            for filename, chunks in files_summary.items():
                total_tokens = sum(chunk['token_count'] for chunk in chunks)
                f.write(f"📄 **{filename}:** {len(chunks)} chunks, {total_tokens} total tokens  \n")
                if len(chunks) == 1 and chunks[0].get('is_complete_document'):
                    f.write(f"└── Single complete document\n\n")
                else:
                    f.write(f"└── Split into {len(chunks)} chunks\n\n")
            
            f.write("---\n\n")
            f.write("## DETAILED DOCUMENT CHUNKS\n\n")
            
            # Write detailed information for each document
            for i, doc in enumerate(all_docs):
                f.write(f"### CHUNK {i+1}\n\n")
                f.write(f"- **ID:** {doc['doc_id']}\n")
                f.write(f"- **Patient ID:** {doc['patient_id']}\n")
                f.write(f"- **Type:** {doc['type']}\n")
                f.write(f"- **Source File:** {doc['source_file']}\n")
                f.write(f"- **Token Count:** {doc['token_count']}\n")
                f.write(f"- **Chunk Index:** {doc['chunk_index']+1} of {doc['total_chunks']}\n")
                f.write(f"- **Complete Document:** {doc.get('is_complete_document', False)}\n")
                f.write(f"- **Timestamp:** {doc['timestamp']}\n\n")
                f.write(f"**Text Preview (first 300 chars):**\n")
                f.write(f"```\n{doc['text'][:300]}...\n```\n\n")
                f.write(f"**Full Text:**\n")
                f.write(f"```\n{doc['text']}\n```\n\n")
                f.write("---\n\n")
        
        print(f"✅ Document review file saved: {output_file}")
        
    except Exception as error:
        print(f"❌ Error saving document review file: {error}")

########################################################################################

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
    """Main function to process markdown files and embed them to Pinecone"""
    index_name = "client-documents"  # Replace with your actual index name
    
    print("📚 Processing All Documents:")
    all_docs = process_all_markdown_files_in_folder(
        folder_path='_Ethan Rodriguez', 
        patient_id='6789',  # You can set this or let it auto-extract
        chunk_size=3000,    # Adjust based on your needs
        chunk_overlap=200   # Overlap for context preservation
    )
    
    if not all_docs:
        print("❌ No documents found to process")
        return
    
    # Display summary of processed documents
    print(f"\n📋 Final Results:")
    print(f"Total document chunks: {len(all_docs)}")
    
    # Create index if it doesn't exist
    print(f"\n🔨 Setting up Pinecone index: {index_name}")
    create_index_if_not_exists(index_name)
    
    # Wait a moment for index to be ready
    import time
    time.sleep(5)
    
    # Use patient_id from first document as namespace
    namespace = all_docs[0]['patient_id'] if all_docs else ''
    
    # Embed and upsert all document chunks
    print(f"\n🚀 Starting embedding and upserting process...")
    await embed_and_upsert_documents(all_docs, index_name, namespace)
    
    # Save all_docs to a text file for review
    output_file = f"processed_documents_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("# PROCESSED DOCUMENTS SUMMARY\n\n")
            f.write(f"**Total document chunks:** {len(all_docs)}  \n")
            f.write(f"**Generated on:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            # Group by source file for better overview
            from collections import defaultdict
            files_summary = defaultdict(list)
            for doc in all_docs:
                files_summary[doc['source_file']].append(doc)
            
            f.write("## FILES SUMMARY\n\n")
            for filename, chunks in files_summary.items():
                total_tokens = sum(chunk['token_count'] for chunk in chunks)
                f.write(f"📄 **{filename}:** {len(chunks)} chunks, {total_tokens} total tokens  \n")
                if len(chunks) == 1 and chunks[0].get('is_complete_document'):
                    f.write(f"└── Single complete document\n\n")
                else:
                    f.write(f"└── Split into {len(chunks)} chunks\n\n")
            
            f.write("---\n\n")
            f.write("## DETAILED DOCUMENT CHUNKS\n\n")
            
            # Write detailed information for each document
            for i, doc in enumerate(all_docs):
                f.write(f"### CHUNK {i+1}\n\n")
                f.write(f"- **ID:** {doc['doc_id']}\n")
                f.write(f"- **Patient ID:** {doc['patient_id']}\n")
                f.write(f"- **Type:** {doc['type']}\n")
                f.write(f"- **Source File:** {doc['source_file']}\n")
                f.write(f"- **Token Count:** {doc['token_count']}\n")
                f.write(f"- **Chunk Index:** {doc['chunk_index']+1} of {doc['total_chunks']}\n")
                f.write(f"- **Complete Document:** {doc.get('is_complete_document', False)}\n")
                f.write(f"- **Timestamp:** {doc['timestamp']}\n\n")
                f.write(f"**Text Preview (first 300 chars):**\n")
                f.write(f"```\n{doc['text'][:300]}...\n```\n\n")
                f.write(f"**Full Text:**\n")
                f.write(f"```\n{doc['text']}\n```\n\n")
                f.write("---\n\n")
        
        print(f"✅ Document review file saved: {output_file}")
        
    except Exception as error:
        print(f"❌ Error saving document review file: {error}")


if __name__ == "__main__":
    # Option 1: Count tokens in all files (for analysis)
    # print("🔍 Token Analysis:")
    # count_tokens_in_folder()
    
    # print("\n" + "="*50 + "\n")
    
    # Option 2: Run the main async function to process and embed documents
    print("🚀 Running main embedding process...")
    asyncio.run(main())