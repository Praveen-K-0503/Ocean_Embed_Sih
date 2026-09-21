# OceanEmbed Directory Structure & Layout Reference

The directory tree below reflects the organized, predictable, and AI-agent-friendly repository layout of **OceanEmbed**.

```text
Final-oceanembed/
│
├── app/                                # Backend API & Frontend UI Delivery
│   ├── main.py                         # FastAPI web application entrypoint & REST API handlers
│   └── static/                         # Static Frontend Web Application Assets
│       ├── index.html                  # Main operational dashboard UI HTML
│       ├── styles.css                  # UI styling system & responsive design
│       ├── app.js                      # UI logic, Chart.js 2D profiles, Plotly.js 3D volume, Leaflet map
│       ├── data/                       # Static UI data references
│       └── images/                     # UI visual assets & hero images
│
├── src/                                # Core Application Logic, ML & Ocean Physics
│   ├── config.py                       # Global domain parameters, depth grids, and paths
│   ├── data/                           # Ocean physics diagnostics & preprocessing modules
│   │   ├── ocean_physics.py            # Diagnostic calculations (D20, MLD, TCHP, OHC)
│   │   └── preprocessor.py             # Feature scaling & tensor formatting
│   ├── datasets/                       # Data loader implementations
│   │   ├── ocean_dataset.py            # 3D PyTorch NetCDF Dataset class
│   │   └── multidepth_dataset.py       # Multi-depth PyTorch Dataset class
│   ├── evaluation/                     # Model validation & benchmarking tools
│   │   ├── evaluate_argo.py            # ARGO float validation benchmark engine
│   │   ├── compare_models.py           # Model performance comparison tool
│   │   ├── visualize.py                # Profile plot & diagnostic visualization helpers
│   │   └── ...                         # Additional evaluation & benchmark scripts
│   ├── inference/                      # Deep learning inference engine
│   │   └── predict_profile.py          # Production prediction engine (`OceanEmbedPredictor`)
│   ├── models/                         # Neural network architectures
│   │   ├── ocean_embed_net.py          # Primary production network
│   │   ├── pytorch_models.py           # PyTorch implementation variants
│   │   ├── dual_vit_unet.py            # Vision Transformer / UNet hybrid model
│   │   ├── ocean_gnn.py                # Graph Neural Network variant
│   │   └── ...                         # Additional model implementations
│   └── training/                       # Training loss functions and training loops
│       ├── train.py                    # Core training execution loop
│       ├── losses.py                   # Custom physical loss functions
│       └── ...                         # Training variants
│
├── SIH_Final_Data/                     # Production Datasets (Primary NetCDF Data)
│   ├── Final_Training_Dataset_2022_2024.nc # 2022–2024 Daily 0.25° NIO surface observations & target 3D fields
│   ├── ARGO_15depths_validation.nc     # INCOIS gridded ARGO validation benchmark
│   └── README.md                       # Dataset specification metadata
│
├── ocean_embed_inference_assets/       # Machine Learning Model Checkpoints
│   └── oceanembed_best.pt              # Best PyTorch model weight checkpoint
│
├── data/                               # Data Directory for Runtime Outputs & Pipeline Storage
│   ├── realtime/                       # Realtime output cache
│   │   └── evaluation_metrics.json     # Pre-computed ARGO validation metrics JSON
│   ├── raw/                            # Target directory for raw satellite feeds (.gitkeep)
│   └── processed/                      # Target directory for processed alignment arrays (.gitkeep)
│
├── scripts/                            # Operational Scripts & Utility Pipelines
│   ├── check_structure.py              # Repository structure verification tool
│   ├── print_sample_prediction.py      # Command-line prediction and diagnostics printer
│   ├── save_trained_checkpoint.py      # Weights export & checkpoint conversion utility
│   └── preprocessing/                  # Data preparation & normalization pipeline scripts
│       ├── generate_daily_025_dataset.py
│       ├── prepare_data.py
│       └── ...                         # Normalization & masking scripts
│
├── docs/                               # Project & Architectural Documentation
│   ├── ARCHITECTURE.md                 # Complete system architecture, layers, & API flow
│   └── PROJECT_STRUCTURE.md            # Directory tree description and guidelines
│
├── configs/                            # Configuration files (.gitkeep)
├── model_artifacts/                    # Model artifacts & exported weights (.gitkeep)
├── tests/                              # Automated test suites (.gitkeep)
├── notebooks/                          # Interactive Jupyter notebooks (.gitkeep)
├── deployment/                         # Containerization & deployment configs (.gitkeep)
├── outputs/                            # Exported figure, prediction, and metric outputs (.gitkeep)
│   ├── figures/                        # Generated plots (.gitkeep)
│   ├── predictions/                    # Output prediction arrays (.gitkeep)
│   └── metrics/                        # Diagnostic output logs (.gitkeep)
│
├── video/                              # UI Background Video Media Asset
│   └── 244754.mp4                      # Ocean background video
│
├── .gitattributes                      # Git LFS & attribute declarations
├── .gitignore                          # Git exclude patterns
├── README.md                           # Operational project overview
├── requirements.txt                    # Python environment dependencies
├── run_demo.py                         # Complete platform launcher script
├── create_dummy_data.py                # Standalone dummy dataset generator
├── execute_fixes.py                    # Static asset maintenance helper
├── fix_app_data.py                     # Static asset data binding helper
├── update_appjs.py                     # Static asset UI component script helper
└── update_css.py                       # Static asset UI styling script helper
```

---

## Folder Concerns & Architectural Mapping

| Directory / File | Purpose & Responsibilities | Architectural Layer |
| :--- | :--- | :--- |
| `app/` | FastAPI server logic & static UI hosting | Backend API / REST Layer |
| `app/static/` | Interactive web interface (HTML/CSS/JS) | Frontend UI |
| `src/` | ML Models, Ocean Physics, Datasets, Training, & Inference | Core ML / Physics Engine |
| `SIH_Final_Data/` | Primary NetCDF 3D Ocean datasets | Raw Data Layer |
| `ocean_embed_inference_assets/` | Trained PyTorch neural network checkpoints | Model Weights Artifacts |
| `data/` | Runtime evaluation outputs & data processing pipelines | Data Storage Layer |
| `scripts/` | Data preparation, structure checking, CLI tools | Utility / Ops Layer |
| `docs/` | Architecture specification & directory layout docs | Documentation |
| `run_demo.py` | Operational system launcher | System Entrypoint |

---

## Architectural Rationale & Path Preservation

1. **Python Path Constraints**:
   - Python files in `src/`, `scripts/`, `scripts/preprocessing/`, and `app/` use exact relative path mechanics (`Path(__file__).resolve().parents[...]`) to locate `PROJECT_ROOT`.
   - Modifying directory depth of existing code files without changing file contents would break relative imports and root discovery.
   - To strictly obey the **"DO NOT MODIFY FILE CONTENT"** constraint, all existing source code files remain in their verified, working locations.

2. **Standard Target Integration**:
   - All standard conceptual directories (`docs/`, `configs/`, `tests/`, `notebooks/`, `deployment/`, `model_artifacts/`, `outputs/`) have been integrated into the repository to provide clear placeholders for future extension.
