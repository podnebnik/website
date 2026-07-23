import sys
from pathlib import Path

# precompute_datasette.py lives one level up in sources/, not in the tests tree,
# so it is not importable by default when pytest runs from here. Put sources/ on
# the path so the T-3.5 tests can `import precompute_datasette`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
