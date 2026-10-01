"""Add scripts/ to the Python path for tests."""
import sys
from pathlib import Path

# Add the project root's scripts/ directory to sys.path
scripts_path = Path(__file__).parent.parent / "scripts"
if str(scripts_path) not in sys.path:
    sys.path.insert(0, str(scripts_path))
