from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.inference.predict_profile import OceanEmbedPredictor

def main():
    predictor = OceanEmbedPredictor()
    
    locations = [
        ("Arabian Sea", 15.0, 65.0),
        ("Bay of Bengal", 14.0, 88.0),
        ("Equatorial NIO", 6.0, 78.0)
    ]
    
    print("\n" + "=" * 76)
    print("  OCEANEMBED — DAILY 0.25° 3D SUBSURFACE TEMPERATURE RECONSTRUCTION TABLE")
    print("  Ministry of Earth Sciences (MoES) / INCOIS Problem Statement 26066")
    print("=" * 76)

    for name, lat, lon in locations:
        res = predictor.predict_profile(lat, lon)
        print(f"\nLocation: {name} (Lat: {res['requested_latitude']}°N, Lon: {res['requested_longitude']}°E)")
        print(f"Date: {res['date']}")
        print(f"Surface Observations (5 Channels):")
        print(f"  SST: {res['surface_sst_c']} °C | SSS: {res['surface_sss_psu']} PSU | SLA: {res['surface_ssh_m']} m | U: {res['surface_u_ms']} m/s | V: {res['surface_v_ms']} m/s")
        print("-" * 55)
        print(f"{'Standard Depth (meters)':<26} | {'Reconstructed Temp (°C)':<25}")
        print("-" * 55)
        for point in res["profile"]:
            if point["valid"]:
                depth_str = f"{point['depth_m']} m"
                temp_str = f"{point['temperature_c']:.2f} °C"
                print(f"{depth_str:<26} | {temp_str:<25}")
        print("-" * 55)

    predictor.close()

if __name__ == "__main__":
    main()
