import os
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

def main():
    print("=" * 70)
    print("  OceanEmbed — SIH Prototype Launcher")
    print("  Ministry of Earth Sciences (MoES) / INCOIS Problem Statement 26066")
    print("=" * 70)

    # Step 1: Check / Generate Data
    dataset_file = ROOT / "data" / "processed" / "normalized" / "nio_daily_025_2018.nc"
    if not dataset_file.exists():
        print("\n[1/3] Generating daily 0.25° North Indian Ocean NetCDF dataset (2018-01 to 2018-07)...")
        from scripts.preprocessing.generate_daily_025_dataset import generate_daily_dataset
        generate_daily_dataset()
    else:
        print("\n[1/3] Daily 0.25° NetCDF Dataset validated.")

    # Step 2: Test Predictor Engine
    print("\n[2/3] Initializing Deep Learning Inference & ARGO Validation Engine...")
    from src.inference.predict_profile import OceanEmbedPredictor
    predictor = OceanEmbedPredictor()
    test_res = predictor.predict_profile(15.0, 65.0)
    sst_val = test_res['profile'][0]['temperature_c'] if test_res['profile'] else "N/A"
    print(f"      Validation test prediction successful: SST = {sst_val} °C, Max Depth = {test_res.get('max_valid_depth_m', 1000)} m")
    predictor.close()

    # Step 3: Launch FastAPI Web Dashboard
    print("\n[3/3] Launching Web Prototype Server on http://localhost:8000 ...")
    print("      Opening browser automatically...")
    
    webbrowser.open("http://localhost:8000")

    import uvicorn
    from app.main import app
    uvicorn.run(app, host="127.0.0.1", port=8000)

if __name__ == "__main__":
    main()
