# services/vector_store.py
import os
import json
from typing import Optional, List
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()


class VectorStoreManager:
    """Manage FAISS vector stores for hubs"""
    
    def __init__(self, persist_dir: str, openai_api_key: str, openai_api_base: str,
                 embedding_model: str, chunk_size: int, chunk_overlap: int):
        self.persist_dir = persist_dir
        self.openai_api_key = openai_api_key
        self.openai_api_base = openai_api_base
        self.embedding_model = embedding_model
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        os.makedirs(persist_dir, exist_ok=True)
    
    def _get_embeddings(self):
        """Get OpenAI embeddings instance"""
        return OpenAIEmbeddings(
            openai_api_key=self.openai_api_key,
            base_url=self.openai_api_base,
            model=self.embedding_model
        )
    
    def create_vectorstore(self, text: str, hub_name: str) -> FAISS:
        """Create and persist vector store from text"""
        # Split text into chunks
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap
        )
        chunks = splitter.split_text(text)
        
        # Create FAISS index
        embeddings = self._get_embeddings()
        vectorstore = FAISS.from_texts(chunks, embeddings)
        
        # Persist to disk
        self.save_vectorstore(vectorstore, hub_name)
        
        return vectorstore
    
    def save_vectorstore(self, vectorstore: FAISS, hub_name: str):
        """Save vector store to disk"""
        target_dir = os.path.join(self.persist_dir, hub_name)
        os.makedirs(target_dir, exist_ok=True)
        vectorstore.save_local(target_dir)
    
    def load_vectorstore(self, hub_name: str) -> Optional[FAISS]:
        """Load vector store from disk"""
        target_dir = os.path.join(self.persist_dir, hub_name)
        if not os.path.isdir(target_dir):
            return None
        
        embeddings = self._get_embeddings()
        return FAISS.load_local(
            target_dir,
            embeddings,
            allow_dangerous_deserialization=True
        )
    
    def save_manifest(self, hub_name: str, files: List[dict]):
        """Save file manifest for a hub"""
        target_dir = os.path.join(self.persist_dir, hub_name)
        os.makedirs(target_dir, exist_ok=True)
        
        manifest = {
            "files": files,
            "map": {f["id"]: f["etag"] for f in files},
            "count": len(files),
            "created_at": datetime.utcnow().isoformat()
        }
        
        manifest_path = os.path.join(target_dir, "manifest.json")
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)
    
    def load_manifest(self, hub_name: str) -> Optional[dict]:
        """Load file manifest for a hub"""
        manifest_path = os.path.join(self.persist_dir, hub_name, "manifest.json")
        if not os.path.exists(manifest_path):
            return None
        
        with open(manifest_path, "r") as f:
            return json.load(f)
    
    def save_metadata(self, hub_name: str, metadata: dict):
        """Save hub metadata (SharePoint link, sync settings, etc.)"""
        target_dir = os.path.join(self.persist_dir, hub_name)
        os.makedirs(target_dir, exist_ok=True)
        
        metadata_path = os.path.join(target_dir, "metadata.json")
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
    
    def load_metadata(self, hub_name: str) -> Optional[dict]:
        """Load hub metadata"""
        metadata_path = os.path.join(self.persist_dir, hub_name, "metadata.json")
        if not os.path.exists(metadata_path):
            return None
        
        with open(metadata_path, "r") as f:
            return json.load(f)
    
    def list_hubs(self) -> List[str]:
        """List all available hubs"""
        if not os.path.exists(self.persist_dir):
            return []
        
        return [
            d for d in os.listdir(self.persist_dir)
            if os.path.isdir(os.path.join(self.persist_dir, d))
        ]
    
    def delete_hub(self, hub_name: str):
        """Delete a hub and all its data"""
        import shutil
        target_dir = os.path.join(self.persist_dir, hub_name)
        if os.path.exists(target_dir):
            shutil.rmtree(target_dir)