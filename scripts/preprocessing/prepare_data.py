from pathlib import Path

# pyrefly: ignore [missing-import]
import numpy as np
# pyrefly: ignore [missing-import]
import xarray as xr


# ============================================================
# Paths
# ============================================================

ROOT = Path(__file__).resolve().parents[2]

RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"

OUTPUT = PROCESSED / "aligned"
OUTPUT.mkdir(parents=True, exist_ok=True)


FILES = {
    "sst": RAW / "SST" / "project_SST_1992-2021.nc",
    "ssh": RAW / "SSH" / "project_SSH_1992-2021.nc",
    "u_wind": RAW / "WIND" / "project_uSSW_1992-2021.nc",
    "v_wind": RAW / "WIND" / "project_vSSW_1992-2021.nc",
    "target_st": RAW / "GLORYS" / "project_ST_1992-2021_dep-1.nc",
}


# ============================================================
# Helpers
# ============================================================

def check_file(path: Path) -> None:
    """Make sure the required input file exists."""
    if not path.exists():
        raise FileNotFoundError(f"Missing dataset: {path}")


def load_variable(path: Path, variable: str) -> xr.DataArray:
    """Open one NetCDF variable lazily using chunks (or fallback to non-chunked if dask is absent)."""
    check_file(path)

    try:
        ds = xr.open_dataset(
            path,
            decode_times=False,
            chunks={"time": 12},
        )
    except (ImportError, ValueError):
        ds = xr.open_dataset(
            path,
            decode_times=False,
        )

    if variable not in ds:
        ds.close()
        raise KeyError(
            f"Variable '{variable}' not found in {path.name}. "
            f"Available: {list(ds.data_vars)}"
        )

    return ds[variable]


# ============================================================
# Main preprocessing
# ============================================================

def main():

    print("=" * 70)
    print("OceanEmbed preprocessing")
    print("=" * 70)

    # --------------------------------------------------------
    # Load variables
    # --------------------------------------------------------

    print("\nLoading datasets...")

    sst = load_variable(FILES["sst"], "SST")
    ssh = load_variable(FILES["ssh"], "SSH")
    u_wind = load_variable(FILES["u_wind"], "uSSW")
    v_wind = load_variable(FILES["v_wind"], "vSSW")
    target_st = load_variable(FILES["target_st"], "ST")

    print("SST      :", sst.shape)
    print("SSH      :", ssh.shape)
    print("U wind   :", u_wind.shape)
    print("V wind   :", v_wind.shape)
    print("Target ST:", target_st.shape)

    # --------------------------------------------------------
    # Convert SST Kelvin → Celsius
    # --------------------------------------------------------

    print("\nConverting SST from Kelvin to Celsius...")

    sst = sst - 273.15
    sst.attrs["units"] = "degree_Celsius"

    # --------------------------------------------------------
    # Rename variables
    # --------------------------------------------------------

    sst.name = "sst"
    ssh.name = "ssh"
    u_wind.name = "u_wind"
    v_wind.name = "v_wind"
    target_st.name = "subsurface_temperature"

    # --------------------------------------------------------
    # Combine datasets
    # --------------------------------------------------------

    print("\nCombining datasets...")

    ds = xr.merge(
        [
            sst.to_dataset(),
            ssh.to_dataset(),
            u_wind.to_dataset(),
            v_wind.to_dataset(),
            target_st.to_dataset(),
        ],
        compat="equals",
        join="exact",
    )

    # --------------------------------------------------------
    # Basic metadata
    # --------------------------------------------------------

    ds.attrs["project"] = "OceanEmbed"
    ds.attrs["description"] = (
        "Aligned ocean surface predictors and subsurface "
        "temperature target dataset."
    )

    ds["subsurface_temperature"].attrs["depth_m"] = 3.0

    # --------------------------------------------------------
    # Basic validation
    # --------------------------------------------------------

    print("\nDataset dimensions:")
    print(dict(ds.sizes))

    print("\nVariables:")
    for name in ds.data_vars:
        print(f"  {name}: {ds[name].dtype}")

    # --------------------------------------------------------
    # Check expected dimensions
    # --------------------------------------------------------

    expected_dims = {"time", "lat", "lon"}

    for name in ds.data_vars:
        if set(ds[name].dims) != expected_dims:
            raise ValueError(
                f"{name} has unexpected dimensions: {ds[name].dims}"
            )

    # --------------------------------------------------------
    # Save aligned dataset
    # --------------------------------------------------------

    output_file = OUTPUT / "ocean_aligned_1992-2021.nc"

    print("\nWriting:")
    print(output_file)

    ds.to_netcdf(
        output_file,
        format="NETCDF4",
        engine="netcdf4",
    )

    ds.close()

    print("\n" + "=" * 70)
    print("Preprocessing completed successfully.")
    print("=" * 70)


if __name__ == "__main__":
    main()