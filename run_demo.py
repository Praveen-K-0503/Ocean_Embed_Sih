import os
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from src.config import SIH_FINAL_TRAINING_NC, SIH_FINAL_ARGO_NC

def main():
    print("=" * 76)
    print("  OceanEmbed: 3D Subsurface Ocean Intelligence Platform")
    print("  Ministry of Earth Sciences (MoES) / INCOIS Problem Statement 26066")
    print("=" * 76)

    # Step 1: Validate SIH_Final_Data
    print("\n[1/3] Validating SIH_Final_Data Production Datasets...")
    if not SIH_FINAL_TRAINING_NC.exists():
        raise FileNotFoundError(
            f"Required primary dataset missing: {SIH_FINAL_TRAINING_NC}\n"
            "Please ensure Final_Training_Dataset_2022_2024.nc is in SIH_Final_Data directory."
        )
    if not SIH_FINAL_ARGO_NC.exists():
        raise FileNotFoundError(
            f"Required validation dataset missing: {SIH_FINAL_ARGO_NC}\n"
            "Please ensure ARGO_15depths_validation.nc is in SIH_Final_Data directory."
        )

    size_gb = SIH_FINAL_TRAINING_NC.stat().st_size / (1024 ** 3)
    size_mb = SIH_FINAL_ARGO_NC.stat().st_size / (1024 ** 2)
    print(f"      [OK] Primary 2022–2024 Daily 0.25° Dataset: {size_gb:.2f} GB")
    print(f"      [OK] INCOIS Gridded ARGO Benchmark: {size_mb:.1f} MB")

    # Step 2: Test Predictor Engine & Ocean Physics Diagnostics
    print("\n[2/3] Initializing Deep Learning Inference & Ocean Physics Engine...")
    from src.inference.predict_profile import OceanEmbedPredictor
    from src.evaluation.evaluate_argo import ArgoValidationEngine

    predictor = OceanEmbedPredictor()
    test_res = predictor.predict_profile(15.0, 65.0, "2024-06-01")
    sst_val = test_res["profile"][0]["temperature_c"] if test_res["profile"] else "N/A"
    d20 = test_res.get("diagnostics", {}).get("thermocline_d20_m", "N/A")
    mld = test_res.get("diagnostics", {}).get("mixed_layer_depth_m", "N/A")
    tchp = test_res.get("diagnostics", {}).get("tchp_kj_cm2", "N/A")
    print(f"      Prediction Test: SST = {sst_val} °C, D20 = {d20} m, MLD = {mld} m, TCHP = {tchp} kJ/cm²")
    predictor.close()

    validator = ArgoValidationEngine()
    metrics = validator.compute_metrics()
    print(f"      INCOIS ARGO Validation: Overall RMSE = {metrics['overall_rmse_c']} °C, Correlation = {metrics['overall_correlation_r']}")

    # Step 3: Launch Web Platform
    print("\n[3/3] Launching OceanEmbed Operational Web Platform on http://127.0.0.1:8000 ...")
    print("      Opening browser automatically...")
    webbrowser.open("http://127.0.0.1:8000")

    import uvicorn
    from app.main import app
    uvicorn.run(app, host="127.0.0.1", port=8000)

if __name__ == "__main__":
    main()
