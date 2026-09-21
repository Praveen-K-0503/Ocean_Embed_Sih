# OceanEmbed Architecture & Systems Specification

## Overview

**OceanEmbed** is a high-performance 3D Subsurface Ocean Intelligence Platform developed for the Ministry of Earth Sciences (MoES) and INCOIS (Problem Statement 26066). The system reconstructs full-column 3D ocean temperature fields (0–1000m depth across 15 standard depth levels) from surface satellite observations (SST, SSS, SSH/SLA, Surface Currents U/V, and 10m Winds U/V) across the North Indian Ocean (5°N–30°N, 45°E–105°E) at 0.25° spatial resolution.

---

## Architectural Boundaries

The application is structured into four clean conceptual layers:

```
[ Frontend/UI ]  ──(HTTP / REST / Streaming)──>  [ Backend / API ]
                                                       │
                                               (Python In-Process)
                                                       │
                                                       ▼
[ Datasets & Storage ]  <──(Data Pipelines)──  [ ML Inference Engine ]
```

### 1. Frontend Architecture (`app/static/`)
- **Technology Stack**: Vanilla HTML5, CSS3, JavaScript (ES6+), Chart.js, Plotly.js, Leaflet.js, FontAwesome.
- **Entry Point**: [`index.html`](file:///c:/Users/mitran/Downloads/Final-oceanembed/app/static/index.html)
- **Styles**: [`styles.css`](file:///c:/Users/mitran/Downloads/Final-oceanembed/app/static/styles.css) (Glassmorphism design, floating pill navigation, dark navy/ocean cyan color language).
- **Client Logic**: [`app.js`](file:///c:/Users/mitran/Downloads/Final-oceanembed/app/static/app.js) (Handles interactive Leaflet map, Chart.js 2D profile rendering, Plotly.js 3D volume slicing, real-time input controls, and tab navigation).

### 2. Backend / API Layer (`app/`)
- **Technology Stack**: FastAPI, Uvicorn ASGI Server, StreamingResponse.
- **Entry Point**: [`app/main.py`](file:///c:/Users/mitran/Downloads/Final-oceanembed/app/main.py)
- **Responsibilities**:
  - Serves static UI assets and index page.
  - Exposes REST API endpoints (`/api/predict_profile`, `/api/volume_3d`, `/api/argo_validation`, `/api/stats`, `/video_feed`).
  - Wraps the ML inference engine and physics diagnostic module.

### 3. ML Architecture & Core Logic (`src/`)
- **Config**: [`src/config.py`](file:///c:/Users/mitran/Downloads/Final-oceanembed/src/config.py) (Global domain parameters, depth grids, surface variables, normalization statistics, physical constants).
- **Models (`src/models/`)**: PyTorch Deep Learning models (`OceanEmbedReconstructor`, `ConvLSTM`, `DualViTUNet`, `OceanGNN`).
- **Inference (`src/inference/`)**: [`predict_profile.py`](file:///c:/Users/mitran/Downloads/Final-oceanembed/src/inference/predict_profile.py) (`OceanEmbedPredictor` class for dataset query and neural profile reconstruction).
- **Ocean Physics (`src/data/`)**: [`ocean_physics.py`](file:///c:/Users/mitran/Downloads/Final-oceanembed/src/data/ocean_physics.py) (Calculates Thermocline Depth $D_{20}$, Mixed Layer Depth MLD, Tropical Cyclone Heat Potential TCHP, and Ocean Heat Content OHC).
- **Evaluation (`src/evaluation/`)**: [`evaluate_argo.py`](file:///c:/Users/mitran/Downloads/Final-oceanembed/src/evaluation/evaluate_argo.py) (`ArgoValidationEngine` for computing RMSE, MAE, correlation, and depth-wise validation metrics against INCOIS gridded ARGO observations).
- **Datasets (`src/datasets/`)**: [`ocean_dataset.py`](file:///c:/Users/mitran/Downloads/Final-oceanembed/src/datasets/ocean_dataset.py) (PyTorch `Dataset` wrappers for 3D NetCDF tensors).

### 4. Datasets & Model Artifacts
- **Primary NetCDF Datasets (`SIH_Final_Data/`)**:
  - `Final_Training_Dataset_2022_2024.nc`: 2022–2024 Daily 0.25° NIO surface observations & GLORYS12 3D temperature fields.
  - `ARGO_15depths_validation.nc`: INCOIS gridded ARGO float validation benchmark.
- **Trained Model Weights (`ocean_embed_inference_assets/`)**:
  - `oceanembed_best.pt`: Production PyTorch model weights checkpoint.
- **Runtime Outputs (`data/realtime/`)**:
  - `evaluation_metrics.json`: Pre-computed depth-wise validation metrics cache.

---

## API Communication Flow

```
User Click / Form Input ──> app.js ──> GET /api/predict_profile?lat=...&lon=...&date=...
                                                    │
                                                    ▼
                                           app/main.py
                                                    │
                                                    ▼
                                       src.inference.predict_profile
                                                    │
                                 ┌──────────────────┴──────────────────┐
                                 ▼                                     ▼
                     SIH_Final_Data (NetCDF)                src.data.ocean_physics
                                 │                                     │
                                 └──────────────────┬──────────────────┘
                                                    ▼
                                            JSON Payload Output
                                                    │
                                                    ▼
                                    app.js (Renders 2D Profile & 3D Volume)
```

---

## Key Entry Points & Operations

- **Demonstration & Web Server Launcher**: [`run_demo.py`](file:///c:/Users/mitran/Downloads/Final-oceanembed/run_demo.py) (`python run_demo.py`)
- **FastAPI Direct Entrypoint**: [`app/main.py`](file:///c:/Users/mitran/Downloads/Final-oceanembed/app/main.py) (`python -m uvicorn app.main:app --port 8000 --reload`)
- **Structure Audit Script**: [`scripts/check_structure.py`](file:///c:/Users/mitran/Downloads/Final-oceanembed/scripts/check_structure.py) (`python scripts/check_structure.py`)
- **Sample Prediction CLI**: [`scripts/print_sample_prediction.py`](file:///c:/Users/mitran/Downloads/Final-oceanembed/scripts/print_sample_prediction.py) (`python scripts/print_sample_prediction.py`)

---

## Dependency & Path Resolution Rules

1. **Root Module Import Resolution**:
   - Python code dynamically discovers `PROJECT_ROOT` using `Path(__file__).resolve().parents[...]`.
   - `src/config.py` relies on `parents[1]` pointing to the project root directory.
   - `scripts/*.py` relies on `parents[1]` pointing to the project root directory.
   - `scripts/preprocessing/*.py` relies on `parents[2]` pointing to the project root directory.
2. **File Location Strictness**:
   - Moving any existing Python file inside `src/`, `app/`, `scripts/`, or root would break relative module import resolution (`parents[...]`) and standard `import src...` statements unless file contents are altered.
   - Therefore, all existing Python file locations are strictly preserved in their authoritative original paths.

---

## Guidelines for Future AI Agents & Developers

> [!IMPORTANT]
> **Rules for Future Modifications**:
> 1. **Inspect Before Modifying**: Inspect the relevant module and its dependencies before making changes.
> 2. **Respect Architectural Boundaries**:
>    - Do NOT place frontend UI code (`HTML`/`CSS`/`JS`) inside backend or ML directories.
>    - Do NOT place ML inference/training code inside static frontend directories.
>    - Do NOT place datasets inside source-code directories.
> 3. **Preserve Immutability**: Do NOT modify model artifacts or raw dataset files as if they were source code.
> 4. **Single Source of Truth**: Do NOT create duplicate file implementations (e.g. `model_v2.py`, `app_new.js`). Reuse existing modules and services whenever possible.
> 5. **Path Resolution Awareness**: Always preserve `PROJECT_ROOT` path arithmetic (`parents[...]`) when adding new scripts to maintain consistent execution behavior across environments.

---

## Core Contributors & Maintainers

- **Praveen K** (`@Praveen-K-0503` / `praveen0503k@gmail.com`) — Lead Developer & Project Architect
- **Mitran** (`@vmit-1911` / `mrgvmitran@gmail.com`) — Contributor (OceanGNN & Visualizations)
