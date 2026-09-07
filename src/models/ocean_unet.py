"""
OceanUNet: Deep Learning Architecture for Subsurface Ocean Temperature Reconstruction
MoES / INCOIS Problem Statement 26066

Reconstructs vertical temperature profiles at 15 standard depth levels:
(0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000) meters
from 5 daily surface satellite observations at 0.25° resolution:
- Sea Surface Temperature (SST)
- Sea Surface Salinity (SSS)
- Sea Surface Height / Sea Level Anomaly (SSH / SLA)
- Surface Current / Wind U-component
- Surface Current / Wind V-component
"""

from pathlib import Path
from typing import Tuple, Optional
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CHECKPOINT = ROOT / "ocean_embed_inference_assets" / "ocean_unet_model.pth"


class OceanUNet(nn.Module):
    """
    U-Net architecture with 3 encoder stages, bottleneck, 3 decoder stages,
    skip connections, and a 1x1 final convolution projecting to 15 standard depth levels.
    """
    def __init__(self, in_channels: int = 5, out_channels: int = 15):
        super().__init__()
        self.in_channels = in_channels
        self.out_channels = out_channels

        # Stage 1 Encoder: 5 -> 64
        self.enc1 = nn.Sequential(
            nn.Conv2d(in_channels, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )

        # Stage 2 Encoder: 64 -> 128
        self.enc2 = nn.Sequential(
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )

        # Stage 3 Encoder: 128 -> 256
        self.enc3 = nn.Sequential(
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )

        # Latent Bottleneck: 256 -> 512
        self.bottleneck = nn.Sequential(
            nn.Conv2d(256, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )

        self.pool = nn.MaxPool2d(2, 2)

        # Stage 1 Decoder: 512 -> 256
        self.up1 = nn.ConvTranspose2d(512, 256, kernel_size=2, stride=2)
        self.dec1 = nn.Sequential(
            nn.Conv2d(512, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )

        # Stage 2 Decoder: 256 -> 128
        self.up2 = nn.ConvTranspose2d(256, 128, kernel_size=2, stride=2)
        self.dec2 = nn.Sequential(
            nn.Conv2d(256, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )

        # Stage 3 Decoder: 128 -> 64
        self.up3 = nn.ConvTranspose2d(128, 64, kernel_size=2, stride=2)
        self.dec3 = nn.Sequential(
            nn.Conv2d(128, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )

        # Final 1x1 Convolution: 64 -> 15 depth levels
        self.final = nn.Conv2d(64, out_channels, kernel_size=1)

    def extract_latent_embedding(self, x: torch.Tensor) -> torch.Tensor:
        """
        Extract compact 512-channel latent spatial embedding from the bottleneck.
        """
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        b = self.bottleneck(self.pool(e3))
        return b

    def forward(self, x: torch.Tensor, return_embedding: bool = False):
        # Encoder forward pass
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        b = self.bottleneck(self.pool(e3))

        # Decoder forward pass with bilinear interpolation fallback for odd spatial dimensions
        d1 = self.up1(b)
        if d1.shape[2:] != e3.shape[2:]:
            d1 = F.interpolate(d1, size=e3.shape[2:], mode='bilinear', align_corners=False)
        d1 = self.dec1(torch.cat([d1, e3], dim=1))

        d2 = self.up2(d1)
        if d2.shape[2:] != e2.shape[2:]:
            d2 = F.interpolate(d2, size=e2.shape[2:], mode='bilinear', align_corners=False)
        d2 = self.dec2(torch.cat([d2, e2], dim=1))

        d3 = self.up3(d2)
        if d3.shape[2:] != e1.shape[2:]:
            d3 = F.interpolate(d3, size=e1.shape[2:], mode='bilinear', align_corners=False)
        d3 = self.dec3(torch.cat([d3, e1], dim=1))

        out = self.final(d3)

        if return_embedding:
            return out, b
        return out


def load_trained_ocean_unet(checkpoint_path: Optional[Path] = None, device: str = "cpu") -> OceanUNet:
    """
    Load the trained OceanUNet model with weights strictly verified.
    """
    path = checkpoint_path or DEFAULT_CHECKPOINT
    if not path.exists():
        raise FileNotFoundError(f"Model checkpoint not found at: {path}")

    model = OceanUNet(in_channels=5, out_channels=15)
    state_dict = torch.load(path, map_location=device, weights_only=False)
    if "model_state_dict" in state_dict:
        state_dict = state_dict["model_state_dict"]

    model.load_state_dict(state_dict, strict=True)
    model.to(device)
    model.eval()
    return model
