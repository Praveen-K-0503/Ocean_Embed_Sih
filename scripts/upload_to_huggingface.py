import os
import sys
from pathlib import Path
from huggingface_hub import HfApi

REPO_ID = "praveendatascience/SIH_DATASET_066"
DATA_DIR = Path("SIH_Final_Data")

print(f"Connecting to Hugging Face Hub (Repo: {REPO_ID})...")
api = HfApi()

user = api.whoami()
print(f"Authenticated as: {user['name']} ({user['fullname']}) - Write Access Confirmed")

files_to_upload = [
    "ARGO_15depths_validation.nc",
    "Final_Training_Dataset_2022_2024.nc",
    "README.md"
]

for filename in files_to_upload:
    local_path = DATA_DIR / filename
    if not local_path.exists():
        print(f"[SKIP] {filename} not found locally.")
        continue
    size_mb = local_path.stat().st_size / (1024 * 1024)
    print(f"\n[UPLOADING] {filename} ({size_mb:.2f} MB) to {REPO_ID}...")
    api.upload_file(
        path_or_fileobj=str(local_path),
        path_in_repo=filename,
        repo_id=REPO_ID,
        repo_type="dataset",
    )
    print(f"[SUCCESS] {filename} uploaded successfully!")

print("\nAll datasets uploaded successfully to Hugging Face Hub!")
