from pathlib import Path

root = Path(__file__).resolve().parents[1]
required = [
    "data/raw/SST",
    "data/raw/SSH",
    "data/raw/WIND",
    "data/raw/GLORYS",
    "data/raw/ARGO",
    "data/processed/aligned",
    "notebooks/01_dataset_audit.ipynb",
    "src/data",
    "src/datasets",
    "src/models",
    "src/training",
    "src/evaluation",
    "configs",
    "scripts",
    "checkpoints",
    "outputs/figures",
    "outputs/predictions",
    "outputs/metrics",
    "app",
    "tests",
]
for item in required:
    p = root / item
    print(("OK  " if p.exists() else "MISS"), item)
