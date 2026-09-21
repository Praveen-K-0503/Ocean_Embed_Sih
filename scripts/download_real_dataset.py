"""
OceanEmbed Production Dataset Downloader
Fetches the 100% genuine MoES / INCOIS Production NetCDF datasets from the free
Hugging Face Hub repository (praveendatascience/SIH_DATASET_066).
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "SIH_Final_Data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

REPO_ID = "praveendatascience/SIH_DATASET_066"
FILES = [
    "Final_Training_Dataset_2022_2024.nc",
    "ARGO_15depths_validation.nc",
    "README.md",
]

def main():
    print("=" * 70)
    print("  OceanEmbed Production Dataset Setup (Hugging Face Hub)")
    print(f"  Source Repository: https://huggingface.co/datasets/{REPO_ID}")
    print("=" * 70)

    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        print("[ERROR] huggingface_hub is required. Install via: pip install huggingface_hub")
        sys.exit(1)

    for filename in FILES:
        target_file = DATA_DIR / filename
        if target_file.exists() and target_file.stat().st_size > 1024 * 1024:
            size_mb = target_file.stat().st_size / (1024 * 1024)
            print(f"[FOUND] {filename} already exists locally ({size_mb:.2f} MB). Skipping download.")
            continue

        print(f"\n[DOWNLOADING] {filename} from {REPO_ID}...")
        downloaded_path = hf_hub_download(
            repo_id=REPO_ID,
            filename=filename,
            repo_type="dataset",
            local_dir=str(DATA_DIR),
            local_dir_use_symlinks=False,
        )
        print(f"[OK] Downloaded: {downloaded_path}")

    print("\n[COMPLETE] All production datasets verified in SIH_Final_Data!")
    print("           Ready for full 3D subsurface temperature reconstruction.")

if __name__ == "__main__":
    main()
