"""Refresh match data, retrain production models, and export site artifacts."""

from pathlib import Path
import subprocess
import sys

import nbformat
from nbclient import NotebookClient


ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "notebook" / "build_notebook.py"
NOTEBOOK = ROOT / "notebook" / "wc2026_pipeline.ipynb"
VALIDATOR = ROOT / "scripts" / "validate_release.py"


def main() -> None:
    subprocess.run([sys.executable, str(BUILDER)], cwd=ROOT, check=True)
    notebook = nbformat.read(NOTEBOOK, as_version=4)
    NotebookClient(
        notebook,
        timeout=None,
        kernel_name="python3",
        resources={"metadata": {"path": str(ROOT)}},
    ).execute()
    subprocess.run([sys.executable, str(VALIDATOR)], cwd=ROOT, check=True)
    print("Prediction artifacts refreshed successfully.")


if __name__ == "__main__":
    main()
