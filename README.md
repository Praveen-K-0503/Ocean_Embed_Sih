# OceanEmbed — Deep Learning Subsurface Ocean Intelligence Platform

[![SIH 2024](https://img.shields.io/badge/SIH_2024-Problem_Statement_26066-blue?style=for-the-badge&logo=gov.in)](https://sih.gov.in)
[![Ministry of Earth Sciences](https://img.shields.io/badge/MoES%20%2F%20INCOIS-Disaster_Management-0284c7?style=for-the-badge)](https://incois.gov.in)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-3776ab?style=for-the-badge&logo=python)](https://python.org)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0%2B-ee4c2c?style=for-the-badge&logo=pytorch)](https://pytorch.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ed?style=for-the-badge&logo=docker)](https://docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> **Satellite Embedding-Based Deep Learning Framework for Reconstruction of Subsurface Ocean Temperature from Surface Satellite Observations**  
> Developed for the **Ministry of Earth Sciences (MoES)** & **Indian National Centre for Ocean Information Services (INCOIS)** under Smart India Hackathon (SIH) Problem Statement 26066 (Theme: *Disaster Management*).

---

## Table of Contents

1. [Executive Summary & Motivation](#executive-summary--motivation)
2. [Core Deep Learning Architecture](#core-deep-learning-architecture)
3. [Operational Oceanographic Formulations](#operational-oceanographic-formulations)
4. [Platform Workstations & Modules](#platform-workstations--modules)
   - [1. Ocean Observation Dashboard](#1-ocean-observation-dashboard)
   - [2. 3D Volumetric Studio](#2-3d-volumetric-studio)
   - [3. OceanGNN Hydrodynamic Graph Network](#3-oceangnn-hydrodynamic-graph-network)
   - [4. Cyclone Watch & Rapid Intensification (RI)](#4-cyclone-watch--rapid-intensification-ri)
   - [5. Subsurface Marine Heatwave (MHW) Watch](#5-subsurface-marine-heatwave-mhw-watch)
   - [6. Ocean-Agro Climate Teleconnections Simulator](#6-ocean-agro-climate-teleconnections-simulator)
5. [Datasets & Observational Ingestion](#datasets--observational-ingestion)
6. [Validation & Skill Evaluation against ARGO](#validation--skill-evaluation-against-argo)
7. [Directory Structure](#directory-structure)
8. [Local Installation & Setup](#local-installation--setup)
9. [Deployment Guide](#deployment-guide)
   - [Why Vercel is Not Suited for Monolithic ML Deployments](#why-vercel-is-not-suited-for-monolithic-ml-deployments)
   - [Recommended Deployment: Render.com](#recommended-deployment-rendercom-1-click)
   - [Recommended Deployment: Hugging Face Spaces](#recommended-deployment-hugging-face-spaces-free-16gb-ram)
   - [Decoupled Deployment: Vercel Frontend + Render Backend](#decoupled-deployment-vercel-frontend--render-backend)
   - [Docker Deployment](#docker-deployment)
10. [REST API Reference](#rest-api-reference)
11. [Contributors & Maintainers](#contributors--maintainers)
12. [License & Acknowledgments](#license--acknowledgments)

---

## Executive Summary & Motivation

Subsurface ocean temperature is a fundamental variable controlling ocean circulation, upper-ocean heat content (OHC), thermocline dynamics, tropical cyclone intensification, marine heatwaves, and global climate teleconnections. 

### The Operational Challenge
Direct subsurface in-situ measurements (such as ARGO profiling floats, moored buoys, and gliders) remain spatially sparse and temporally intermittent across the North Indian Ocean. Conversely, satellite remote sensing provides daily high-resolution observations, but is strictly restricted to the **surface ocean skin** (OSTIA SST, SMAP SSS, DUACS SSH, OSCAR Currents, and CCMP Winds). Shallow stratification often masks deeper thermal reservoirs, preventing early disaster detection.

### The OceanEmbed Solution
**OceanEmbed** bridges this observational gap. It couples multi-modal satellite observations with physics-guided deep learning to reconstruct the continuous 3D subsurface thermal field ($0\text{–}1000\text{ m}$ depth across 15 standard oceanographic layers) over the entire North Indian Ocean ($5^\circ\text{N}–30^\circ\text{N}, 45^\circ\text{E}–105^\circ\text{E}$) at $0.25^\circ \times 0.25^\circ$ spatial resolution on a daily cadence.

```
+-----------------------------------------------------------------------------------+
|                        7 Surface Satellite Observations                           |
|      OSTIA SST  ·  SMAP SSS  ·  DUACS SSH  ·  Currents (U, V)  ·  Winds (U, V)     |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                    OceanSurfaceEncoder (Deep Convolutional ResNet)                |
|                    Learns 64-Channel Spatial-Physical Latent Embeddings           |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                   SubsurfaceExpansionDecoder (Transposed Convolution)             |
|                   Projects Latent Embeddings to 15 Vertical Ocean Depths          |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|               Reconstructed 3D Subsurface Temperature (0m – 1000m)                |
|  0m · 10m · 20m · 30m · 50m · 75m · 100m · 125m · 150m · 200m · 250m · 300m...  |
+-----------------------------------------------------------------------------------+
                                          │
         ┌────────────────────────────────┼────────────────────────────────┐
         ▼                                ▼                                ▼
+──────────────────+            +──────────────────+            +──────────────────+
|  Cyclone Watch   |            | Marine Heatwave  |            |  Agro Analytics  |
|  TCHP & RI Alert |            | Bleaching Depth  |            | Monsoon Forecast |
+──────────────────+            +──────────────────+            +──────────────────+
```

---

## Core Deep Learning Architecture

### 1. OceanEmbedNet
* **Input Layer**: 7 normalized physical surface channels:
  1. `sst` — Sea Surface Temperature ($^\circ\text{C}$) from OSTIA
  2. `sss` — Sea Surface Salinity ($\text{PSU}$) from SMAP
  3. `ssh` — Sea Surface Height Anomaly ($\text{m}$) from DUACS Altimetry
  4. `u_curr` — Zonal Geostrophic Current Velocity ($\text{m/s}$) from OSCAR
  5. `v_curr` — Meridional Geostrophic Current Velocity ($\text{m/s}$) from OSCAR
  6. `u_wind` — 10m Zonal Atmospheric Wind Vector ($\text{m/s}$) from CCMP
  7. `v_wind` — 10m Meridional Atmospheric Wind Vector ($\text{m/s}$) from CCMP
* **Surface Encoder**: Multi-stage residual 2D convolutional network with batch normalization and GELU activations extracting spatial gradients, mesoscale eddy structures, and wind stress curl. Produces a compact 64-channel latent surface embedding tensor $\mathbf{Z} \in \mathbb{R}^{B \times 64 \times H \times W}$.
* **Depth Expansion Decoder**: Multi-layer transposed convolutional expansion mapping the 2D surface latent representation to 15 standard ocean depths:
  $$\mathbf{D} = [0, 10, 20, 30, 50, 75, 100, 125, 150, 200, 250, 300, 500, 700, 1000]\text{ meters}$$
* **Physics-Informed Loss**:
  $$\mathcal{L} = \mathcal{L}_{\text{MSE}}(T_{\text{pred}}, T_{\text{true}}) + \lambda_{\text{smooth}}\mathcal{L}_{\text{vertical}} + \lambda_{\text{d20}}\mathcal{L}_{\text{thermocline}}$$

### 2. OceanGNN (Hydrodynamic Graph Attention Network)
* Formulates the North Indian Ocean as a hydrodynamic graph $\mathcal{G} = (\mathcal{V}, \mathcal{E})$ with 12 observation nodes placed across the Arabian Sea, Bay of Bengal, and Equatorial Indian Ocean.
* Nodes communicate via multi-head Graph Attention (GATv2) layers weighted by geostrophic distance and wind-driven boundary transport, capturing inter-basin dipole events (e.g., Indian Ocean Dipole teleconnections).

---

## Operational Oceanographic Formulations

OceanEmbed computes operational oceanographic and disaster mitigation parameters directly from reconstructed vertical temperature profiles:

| Variable | Formulation / Definition | Physical & Operational Significance |
| :--- | :--- | :--- |
| **Thermocline Depth ($D_{20}$)** | Depth ($z$) where temperature equals $20.0^\circ\text{C}$ via linear interpolation. | Indicates upwelling/downwelling, internal waves, and warm water barrier. |
| **Warm Layer Depth ($D_{26}$)** | Depth ($z$) where temperature equals $26.0^\circ\text{C}$. | Fundamental lower limit of ocean thermal energy available to cyclones. |
| **Mixed Layer Depth ($\text{MLD}$)** | Depth where $T(z) = \text{SST} - 0.2^\circ\text{C}$ (de Boyer Montégut criterion). | Thickness of the actively mixed surface boundary layer exchanging heat with atmosphere. |
| **Sonic Layer Depth ($\text{SLD}$)** | Depth of maximum sound speed $c_{\text{max}}$ in upper 200m using the Mackenzie (1981) formula. | Submarine acoustic shadow zone boundary for naval sonar defense operations. |
| **Tropical Cyclone Heat Potential ($\text{TCHP}$)** | $\text{TCHP} = \rho c_p \int_{0}^{D_{26}} (T(z) - 26) \, dz$ where $\rho = 1026\text{ kg/m}^3, c_p = 3993\text{ J/(kg}\cdot\text{K)}$. | Thermal energy fuel for cyclones. $\text{TCHP} \ge 60\text{ kJ/cm}^2$ triggers **Rapid Intensification (RI)** warning. |
| **Upper Ocean Heat Content ($\text{OHC}_{300}$)** | $\text{OHC}_{300} = \rho c_p \int_{0}^{300\text{m}} T(z) \, dz$ | Heat reservoir governing monsoon onset timing and seasonal thermal inertia. |
| **Degree Heating Days ($\text{DHD}$)** | $\text{DHD} = \sum \max(0, \text{SST} - T_{\text{bleach}}) \times \Delta t$ per Hobday et al. (2016). | Ecological thermal stress threshold for mass coral reef bleaching and mortality. |

---

## Platform Workstations & Modules

The platform features a high-contrast white card design with a panoramic ocean seascape hero background and a floating glass navigation bar:

```
[ Home ]   [ Dashboard ]   [ 3D Studio ]   [ OceanGNN ]   [ Cyclone Watch ]   [ Marine Heatwave ]   [ Agro Analytics ]
```

### 1. Ocean Observation Dashboard
* **Interactive North Indian Ocean Map**: Leaflet ocean map with bathymetry layers; click anywhere to extract the exact $0\text{–}1000\text{m}$ vertical profile.
* **Vertical Profile Analyzer**: Toggle between Temperature ($^\circ\text{C}$) and Sound Speed / Sonar ($m/s$). Displays live SLD and cyclone RI hazard badges.
* **Ocean Depth Transect**: Horizontal cross-sections across latitude or longitude cuts with continuous D20 isolines and numeric tabular exports.
* **INCOIS ARGO Float Benchmarking**: Compares predictions against independent in-situ floats in real time.
* **Latent Embeddings Viewer**: 2D PCA projections of learned 64-channel surface representations.

### 2. 3D Volumetric Studio
* **WebGL / Three.js 3D Viewport**: Full volumetric spatial rendering of the North Indian Ocean water column.
* **Three Visualization Modes**:
  1. *Block Volume*: Full 3D temperature voxel field.
  2. *Curtains / Slices*: Orthogonal vertical depth slices across critical straits and trenches.
  3. *Isosurfaces*: 3D continuous manifold surfaces of the $20^\circ\text{C}$ thermocline boundary.
* **Interactive Navigation Tools**: 3D compass rose controller, zoom, pan, rotate, and high-resolution screenshot export.

### 3. OceanGNN Hydrodynamic Graph Network
* **Topological Visualization**: Displays 12 in-situ nodes and 48 hydrodynamic edges linking Arabian Sea upwelling zones with Bay of Bengal freshwater plume regions.
* **Message Passing Inspection**: Interactive attention weight matrices and edge flow vectors.

### 4. Cyclone Watch & Rapid Intensification (RI)
* **Along-Track Waypoint Analysis**: Interactive historical tracks (e.g., Cyclone Biparjoy) with waypoint telemetry.
* **TCHP & D26 Charts**: Tracks ocean heat potential along the storm's path, flagging dangerous crossings over the $60\text{ kJ/cm}^2$ critical Rapid Intensification threshold.

### 5. Subsurface Marine Heatwave (MHW) Watch
* **Interactive Leaflet Habitat Map**: Monitored coral reef hotspots with pulsing Hobday category rings:
  - 🏝️ Lakshadweep Archipelago (Arabian Sea Atolls)
  - 🪸 Gulf of Mannar Marine Biosphere (Palk Strait / SW Bay of Bengal)
  - 🌴 Andaman & Nicobar Marine Ridge (Andaman Sea)
  - 🐬 Gulf of Kachchh Marine National Park (NE Arabian Sea)
  - 🐟 Malvan Marine Sanctuary (Sindhudurg, Maharashtra)
  - 🐠 Netrani Island Coral Habitat (Murudeshwar, Karnataka)
* **Click-to-Profile Anywhere on the Ocean**: Users can click any coordinate on the map to extract the full 15-depth vertical column.
* **Interactive Bleaching Depth Profile Chart**: Reconstructed temperature curve highlighting the subsurface danger zone ($T \ge T_{\text{threshold}}$).
* **Dynamic Bleaching Threshold Slider & Pulse Simulator**: Real-time slider ($27.0^\circ\text{C}$ to $31.0^\circ\text{C}$) with a "+1.5°C Heatwave Pulse" stress test button.

### 6. Ocean-Agro Climate Teleconnections Simulator
* **"What-If" Climate Scenario Simulator Bar**: Interactive SST anomaly slider ($-2.0^\circ\text{C}$ to $+3.0^\circ\text{C}$) with presets (*Baseline*, *Moderate El Niño*, *Extreme El Niño*, *La Niña Active*, *Positive IOD*).
* **Dynamic Teleconnection Feedback**: Updates 5 KPI cards, 4 Chart.js charts, and regional agricultural zone contingency advisories in real time without page reload.
* **Interactive Zone Filter**: Detailed ICAR / IMD Agromet contingency plans for Gujarat Coast, Konkan & Goa, Coastal Karnataka & Kerala, Tamil Nadu Delta, Andhra Coastal Belt, and Odisha/Bengal.

---

## Datasets & Observational Ingestion

* **NetCDF Dataset**: CF-1.6 compliant harmonized dataset `Final_Training_Dataset_2022_2024.nc` covering 1096 daily timesteps (2022-01-01 to 2024-12-31) on a $101 \times 241$ grid ($0.25^\circ \approx 27.5\text{ km}$ spatial resolution).
* **Surface Satellite Inputs**: Copernicus Marine Service (CMEMS) / NOAA / NASA (OSTIA SST, SMAP SSS, DUACS SSH, OSCAR Currents, CCMP Winds).
* **Subsurface Ground Truth**: Copernicus GLORYS12V1 global ocean reanalysis (15 depths: 0 to 1000m).
* **Independent In-Situ Validation**: INCOIS ARGO profiling float repository across the Arabian Sea and Bay of Bengal.

---

## Validation & Skill Evaluation against ARGO

Evaluated against independent in-situ ARGO profiling floats chronologically held out from training:

| Depth Level (m) | Layer Classification | RMSE (°C) | MAE (°C) | Mean Bias (°C) | Correlation ($r$) |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **0 m** | Surface Skin | 0.412 | 0.284 | +0.012 | 0.982 |
| **10 m** | Epipelagic Mixed Layer | 0.435 | 0.301 | +0.015 | 0.979 |
| **20 m** | Mixed Layer Base | 0.482 | 0.334 | +0.021 | 0.974 |
| **50 m** | Upper Thermocline | 0.612 | 0.428 | -0.018 | 0.961 |
| **75 m** | Core Thermocline ($D_{20}$) | 0.748 | 0.521 | -0.024 | 0.948 |
| **100 m** | Lower Thermocline | 0.691 | 0.485 | -0.015 | 0.952 |
| **150 m** | Sub-Thermocline | 0.542 | 0.381 | +0.008 | 0.965 |
| **200 m** | Barrier Layer Base | 0.489 | 0.342 | +0.005 | 0.971 |
| **300 m** | Intermediate Water | 0.411 | 0.289 | -0.002 | 0.980 |
| **500 m** | Deep Intermediate | 0.325 | 0.228 | +0.001 | 0.988 |
| **1000 m** | Deep Ocean Abyss | 0.184 | 0.129 | -0.001 | 0.994 |
| **Overall** | **Full 0–1000m Column** | **0.485** | **0.338** | **-0.000** | **0.972** |

---

## Directory Structure

```
OceanEmbed/
├── app/                                 # Web Application Layer
│   ├── main.py                          # FastAPI application (16+ REST endpoints)
│   └── static/                          # High-performance Vanilla Frontend
│       ├── index.html                   # 7 Workstation Single-Page Architecture
│       ├── styles.css                   # Custom high-contrast white card design system
│       ├── app.js                       # Client logic, Leaflet maps, Chart.js charts
│       └── images/                      # Panoramic ocean hero seascape backgrounds
├── src/                                 # Core Machine Learning & Oceanography
│   ├── models/                          # Neural Network Architectures
│   │   ├── ocean_embed_net.py           # OceanEmbedNet (Encoder-Decoder)
│   │   ├── gnn_model.py                 # OceanGNN Graph Attention Network
│   │   └── baseline_models.py           # ConvLSTM & Baseline benchmarks
│   ├── inference/                       # Prediction & Diagnostics Engines
│   │   ├── predict_profile.py           # Vertical profile & diagnostic calculator
│   │   └── export_cf_netcdf.py          # CF-1.6 standard NetCDF generator
│   ├── evaluation/                      # In-Situ ARGO Validation Suite
│   │   └── evaluate_argo.py             # ARGO float validation pipeline
│   ├── data/                            # NetCDF preprocessor & normalizer
│   └── datasets/                        # PyTorch Dataset loaders
├── SIH_Final_Data/                      # MoES / INCOIS NetCDF dataset
│   └── Final_Training_Dataset_2022_2024.nc
├── oceanembed_best.pt                   # Trained PyTorch model weights
├── Dockerfile                           # Production multi-stage Dockerfile
├── .dockerignore                        # Docker build exclusion rules
├── render.yaml                          # 1-Click Render.com deployment blueprint
├── requirements.txt                     # Python production dependencies
└── README.md                            # Complete Project Documentation
```

---

## Local Installation & Setup

### Prerequisites
* Python 3.10 or 3.11
* `pip` and `git`
* Minimum 4GB RAM (8GB recommended for 3D volumetric array slicing)

### 1. Clone the Repository
```bash
git clone https://github.com/Praveen-K-0503/Ocean_Embed_Sih.git
cd Ocean_Embed_Sih
```

### 2. Create and Activate Virtual Environment
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
# Install CPU-optimized PyTorch first (recommended for faster download & lower disk footprint)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
pip install -r requirements.txt
```

### 4. Launch the Platform
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Open your browser and navigate to: **`http://127.0.0.1:8000`**

---

## Deployment Guide

### Why Vercel is Not Suited for Monolithic ML Deployments
* **Serverless Package Limit**: Vercel Serverless Functions have a strict **250 MB (or 500 MB max) unzipped size limit**. Standard Python machine learning packages (`torch`, `torchvision`, `scipy`, `netCDF4`, `xarray`) exceed **1.2 GB** uncompressed.
* **Serverless Lifecycle & Cold Starts**: OceanEmbed keeps the trained PyTorch model weights (`oceanembed_best.pt`) and the NetCDF dataset loaded in active memory for sub-second inference. Serverless environments terminate after short execution periods, causing 15–30 second cold starts on every request.
* **Ephemeral Disk**: Serverless functions cannot persist or mount large NetCDF datasets.

### Recommended Deployment: Render.com (1-Click)
Render runs the application as a persistent web service using the included `Dockerfile` and `render.yaml`.

1. Push your code to your GitHub repository.
2. Sign in to [Render.com](https://render.com) and click **New + $\rightarrow$ Blueprint**.
3. Connect your GitHub repository (`Praveen-K-0503/Ocean_Embed_Sih`).
4. Render automatically detects `render.yaml` and deploys the `Dockerfile`.
5. Your platform is live with an automatic HTTPS URL (e.g. `https://oceanembed-platform.onrender.com`).

### Recommended Deployment: Hugging Face Spaces (Free 16GB RAM)
Hugging Face Spaces offers **free persistent 16 GB RAM + 2 vCPU** hosting for ML applications:
1. Create a new Space on [Hugging Face](https://huggingface.co/new-space).
2. Select **Docker** as the Space SDK.
3. Push your repository to the Hugging Face Space Git remote.
4. Hugging Face builds the `Dockerfile` and hosts the platform with free SSL.

### Decoupled Deployment: Vercel Frontend + Render Backend
If you specifically wish to use Vercel:
1. **Deploy Backend to Render / Railway / Hugging Face**: Follow the Render instructions above to obtain a backend API URL (e.g., `https://oceanembed-api.onrender.com`).
2. **Configure API Base URL in `app/static/app.js`**:
   ```javascript
   const API_BASE_URL = window.location.hostname === "localhost" ? "" : "https://oceanembed-api.onrender.com";
   ```
3. **Deploy Frontend to Vercel**: Deploy only the `app/static/` directory as a static site on Vercel.

### Docker Deployment
Build and run the container locally or on any cloud server:
```bash
# Build Docker image
docker build -t oceanembed:latest .

# Run Docker container on port 8000
docker run -d -p 8000:8000 --name oceanembed oceanembed:latest

# Visit http://localhost:8000 in your browser
```

---

## REST API Reference

| Method | Endpoint | Query Parameters | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dates` | `mode` (optional) | Returns available observation dates from the NetCDF dataset. |
| `GET` | `/api/metrics` | None | Returns overall validation skill scores (RMSE, MAE, Correlation). |
| `GET` | `/api/predict` | `lat`, `lon`, `date` | Reconstructs 15-depth vertical temperature profile, sound speed, MLD, SLD, TCHP, and OHC. |
| `GET` | `/api/volume_3d` | `lat`, `lon`, `date` | Extracts a $20 \times 20$ spatial grid $\times$ 15 depth layers for WebGL 3D rendering. |
| `GET` | `/api/transect` | `axis` (`lat`/`lon`), `val`, `field`, `date` | Computes 2D vertical curtain cross-section with D20 thermocline isoline. |
| `GET` | `/api/argo_validation` | `station_idx`, `date` | Validates model prediction against real in-situ INCOIS ARGO floats. |
| `GET` | `/api/cyclone/tracks` | None | Returns list of historical North Indian Ocean cyclones (e.g., Biparjoy). |
| `GET` | `/api/cyclone/analyze_track` | `cyclone_id` | Returns along-track waypoints, TCHP, D26, and Rapid Intensification hazard risk. |
| `GET` | `/api/mhw_analytics` | `date`, `lat`, `lon`, `threshold_c` | Evaluates vertical heatwave penetration and Hobday categories for coral reef sanctuaries. |
| `GET` | `/api/agro_analytics` | `date`, `simulated_sst_anomaly` | Computes ocean-climate teleconnections, monsoon onset shift, crop yield, and soil moisture. |
| `GET` | `/api/gnn_inference` | `date` | Runs message passing across 12 hydrodynamic nodes in the North Indian Ocean. |
| `GET` | `/api/export_netcdf` | `date` | Generates and downloads INCOIS CF-1.6 compliant NetCDF file ($15 \times 101 \times 241$). |

---

## Contributors & Maintainers

| Contributor | Role | GitHub Profile | Contact |
| :--- | :--- | :--- | :--- |
| **Praveen K** | Lead Developer & Oceanographic AI Architect | [@Praveen-K-0503](https://github.com/Praveen-K-0503) | [praveen0503k@gmail.com](mailto:praveen0503k@gmail.com) |
| **Mitran** | Contributor (OceanGNN & Visualizations) | [@vmit-1911](https://github.com/vmit-1911) | [mrgvmitran@gmail.com](mailto:mrgvmitran@gmail.com) |

---

## License & Acknowledgments

* **License**: Released under the [MIT License](LICENSE).
* **Affiliation**: Ministry of Earth Sciences (MoES), Indian National Centre for Ocean Information Services (INCOIS), Smart India Hackathon (SIH 2024).
* **Data Sources**: Copernicus Marine Environment Monitoring Service (CMEMS), NOAA / Coral Reef Watch, NASA JPL PO.DAAC, and INCOIS Ocean Data Portal.