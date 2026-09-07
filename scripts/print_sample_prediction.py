from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.inference.predict_profile import OceanEmbedPredictor

def main():
    predictor = OceanEmbedPredictor()
    
    locations = [
        ("Central Arabian Sea", 15.0, 65.0),
        ("Central Bay of Bengal", 14.0, 88.0),
        ("Equatorial NIO", 6.0, 78.0)
    ]
    
    print("\n" + "=" * 80)
    print("  OCEANEMBED — DAILY 0.25° 3D SUBSURFACE TEMPERATURE RECONSTRUCTION TABLE")
    print("  Ministry of Earth Sciences (MoES) / INCOIS Problem Statement 26066")
    print("=" * 80)

    for name, lat, lon in locations:
        res = predictor.predict_profile(lat, lon, "2024-06-01")
        print(f"\nTarget Basin: {name} (Lat: {res['grid_latitude']}°N, Lon: {res['grid_longitude']}°E)")
        print(f"Operational Date: {res['date']}")
        
        obs = res["surface_observations"]
        print(f"Surface Satellite Observations (7 Channels):")
        print(f"  SST: {obs.get('sst')} °C | SSS: {obs.get('sss')} PSU | SSH/SLA: {obs.get('ssh')} m")
        print(f"  Currents: U = {obs.get('u')} m/s, V = {obs.get('v')} m/s")
        print(f"  10m Winds: Eastward = {obs.get('eastward_wind')} m/s, Northward = {obs.get('northward_wind')} m/s")
        
        diag = res.get("diagnostics", {})
        print(f"Derived Physical Ocean Diagnostics:")
        print(f"  Thermocline Depth (D20): {diag.get('thermocline_d20_m')} m | Mixed Layer Depth (MLD): {diag.get('mixed_layer_depth_m')} m")
        print(f"  Tropical Cyclone Heat Potential (TCHP): {diag.get('tchp_kj_cm2')} kJ/cm² | OHC (0-300m): {diag.get('ohc_300m_gj_m2')} GJ/m²")
        
        print("-" * 75)
        print(f"{'Standard Depth':<18} | {'Predicted Temp (°C)':<22} | {'GLORYS Truth (°C)':<20} | {'Error (°C)'}")
        print("-" * 75)
        for point in res["profile"]:
            if point["valid"]:
                depth_str = f"{point['depth_m']} m"
                p_temp = f"{point['temperature_c']:.2f} °C"
                t_temp = f"{point['truth_temperature_c']:.2f} °C" if point.get('truth_temperature_c') is not None else "N/A"
                err = f"{point['error_c']:+.2f} °C" if point.get('error_c') is not None else "N/A"
                print(f"{depth_str:<18} | {p_temp:<22} | {t_temp:<20} | {err}")
        print("-" * 75)

    predictor.close()

if __name__ == "__main__":
    main()
