import os
import shutil
import pytest
from gateway.config import settings
from gateway.storage import BaseStorage, LocalStorage, get_storage_provider

def test_local_storage_lifecycle():
    # Setup custom storage directory for testing
    original_dir = settings.LOCAL_STORAGE_DIR
    test_dir = "data/test_storage_run"
    settings.LOCAL_STORAGE_DIR = test_dir
    
    # Cleanup any leftovers
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
        
    try:
        storage = get_storage_provider()
        assert isinstance(storage, LocalStorage)
        
        # Directory should be auto-created
        assert os.path.exists(test_dir)
        
        # Store file
        content = b"Pluggable storage class content"
        filename = "hello.txt"
        cid = storage.store_file(content, filename)
        
        # Verify file is written
        expected_path = os.path.join(test_dir, cid)
        assert os.path.exists(expected_path)
        with open(expected_path, "rb") as f:
            assert f.read() == content
            
        # Verify file_exists
        assert storage.file_exists(cid) is True
        assert storage.file_exists("nonexistentcid") is False
        
    finally:
        # Cleanup
        if os.path.exists(test_dir):
            shutil.rmtree(test_dir)
        settings.LOCAL_STORAGE_DIR = original_dir

def test_unsupported_provider():
    original_provider = settings.STORAGE_PROVIDER
    settings.STORAGE_PROVIDER = "invalid_provider"
    try:
        with pytest.raises(ValueError) as excinfo:
            get_storage_provider()
        assert "Unsupported storage provider" in str(excinfo.value)
    finally:
        settings.STORAGE_PROVIDER = original_provider
