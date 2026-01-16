#!/usr/bin/env python3
"""
Quick test script to verify Qdrant client API
"""
from qdrant_client import QdrantClient

try:
    # Connect to Qdrant
    client = QdrantClient(host="localhost", port=6333, timeout=5)

    # Check available methods
    print("Available search-related methods:")
    methods = [m for m in dir(client) if not m.startswith('_')]
    search_methods = [m for m in methods if 'search' in m.lower() or 'query' in m.lower()]
    for method in search_methods:
        print(f"  - {method}")

    # Try to get collections
    try:
        collections = client.get_collections()
        print(f"\nCollections: {[c.name for c in collections.collections]}")
    except Exception as e:
        print(f"\nError getting collections: {e}")

    print("\n✅ Qdrant client test complete")

except Exception as e:
    print(f"❌ Error: {e}")
