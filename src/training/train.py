"""
Physics-Guided Deep Learning Training Pipeline for OceanEmbed (MoES / INCOIS PS 26066).
Trains OceanEmbedNet (7-channel Surface Encoder + Logarithmic Depth Expansion)
directly on SIH_Final_Data (Final_Training_Dataset_2022_2024.nc).
"""

from pathlib import Path
import sys
import time
from typing import Dict, List, Optional, Tuple
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.config import ASSETS_DIR, MODEL_CHECKPOINT, N_INPUT_CHANNELS, N_DEPTHS
from src.datasets.ocean_dataset import create_dataloaders
from src.models.ocean_embed_net import OceanEmbedNet


class PhysicsGuidedOceanLoss(nn.Module):
    """
    Multi-component physics-informed loss for 3D subsurface temperature:
      1. L_mse: Masked MSE loss over valid ocean pixels
      2. L_grad: Vertical thermal gradient penalty (stable ocean stratification: dT/dz <= 0)
      3. L_sst: Surface boundary consistency loss (ensures depth 0m matches input SST)
    """

    def __init__(self, lambda_grad: float = 0.05, lambda_sst: float = 0.1):
        super().__init__()
        self.lambda_grad = lambda_grad
        self.lambda_sst = lambda_sst

    def forward(
        self,
        pred: torch.Tensor,       # (B, 15, H, W)
        target: torch.Tensor,     # (B, 15, H, W)
        mask: torch.Tensor,       # (B, H, W) or (H, W)
        sst_input: torch.Tensor,  # (B, 1, H, W)
    ) -> Tuple[torch.Tensor, Dict[str, float]]:
        if mask.ndim == 2:
            mask = mask.unsqueeze(0).expand(pred.shape[0], -1, -1)
        mask_4d = mask.unsqueeze(1).expand(-1, pred.shape[1], -1, -1)  # (B, 15, H, W)

        # 1. Masked Reconstruction MSE
        diff_sq = (pred - target) ** 2
        l_mse = torch.sum(diff_sq * mask_4d) / (torch.sum(mask_4d) + 1e-6)

        # 2. Vertical Stratification Penalty (dT/dz should not be positive)
        # Deep ocean is stably stratified: temperature should decrease with depth
        dz = pred[:, 1:, :, :] - pred[:, :-1, :, :]  # T(k+1) - T(k)
        inversion = torch.clamp(dz, min=0.0)         # Penalize when deeper is warmer
        mask_grad = mask_4d[:, 1:, :, :]
        l_grad = torch.sum((inversion ** 2) * mask_grad) / (torch.sum(mask_grad) + 1e-6)

        # 3. SST Surface Boundary Consistency
        l_sst = torch.mean((pred[:, 0:1, :, :] - sst_input) ** 2)

        total_loss = l_mse + self.lambda_grad * l_grad + self.lambda_sst * l_sst

        loss_dict = {
            "loss": total_loss.item(),
            "l_mse": l_mse.item(),
            "l_grad": l_grad.item(),
            "l_sst": l_sst.item(),
        }
        return total_loss, loss_dict


def train_model(
    epochs: int = 5,
    batch_size: int = 4,
    lr: float = 1e-4,
    device: str = "cpu",
    save_path: Optional[Path] = None,
):
    print("=" * 72)
    print("  OceanEmbed Production Deep Learning Training (SIH PS 26066)")
    print(f"  Device: {device} | Batch Size: {batch_size} | Epochs: {epochs}")
    print("=" * 72)

    save_path = save_path or MODEL_CHECKPOINT
    train_loader, val_loader, _ = create_dataloaders(batch_size=batch_size)

    model = OceanEmbedNet(in_channels=N_INPUT_CHANNELS, out_depths=N_DEPTHS, embedding_dim=64)
    model.to(device)

    criterion = PhysicsGuidedOceanLoss(lambda_grad=0.05, lambda_sst=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-5)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=2)

    best_val_loss = float("inf")

    for epoch in range(1, epochs + 1):
        t0 = time.time()
        model.train()
        train_losses = []

        for step, (x_surf, y_target, mask) in enumerate(train_loader):
            x_surf = x_surf.to(device)
            y_target = y_target.to(device)
            mask = mask.to(device)

            optimizer.zero_grad()
            pred, _ = model(x_surf, return_embedding=False)
            sst_in = x_surf[:, 0:1, :, :]

            loss, loss_dict = criterion(pred, y_target, mask, sst_in)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            train_losses.append(loss_dict["loss"])

            if (step + 1) % 25 == 0 or (step + 1) == len(train_loader):
                print(f"  Epoch [{epoch}/{epochs}] Step [{step+1}/{len(train_loader)}] Loss: {loss_dict['loss']:.4f} (MSE: {loss_dict['l_mse']:.4f})")

        # Validation phase
        model.eval()
        val_losses = []
        with torch.no_grad():
            for x_surf, y_target, mask in val_loader:
                x_surf = x_surf.to(device)
                y_target = y_target.to(device)
                mask = mask.to(device)

                pred, _ = model(x_surf, return_embedding=False)
                sst_in = x_surf[:, 0:1, :, :]
                _, loss_dict = criterion(pred, y_target, mask, sst_in)
                val_losses.append(loss_dict["loss"])

        mean_train = float(np.mean(train_losses))
        mean_val = float(np.mean(val_losses))
        scheduler.step(mean_val)
        elapsed = time.time() - t0

        print(f"\n=> Epoch {epoch} Finished in {elapsed:.1f}s | Train Loss: {mean_train:.4f} | Val Loss: {mean_val:.4f}")

        if mean_val < best_val_loss:
            best_val_loss = mean_val
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss": mean_val,
            }, save_path)
            print(f"   [SAVED] New best checkpoint saved to: {save_path.name}")

    print("\n[DONE] Model training pipeline complete.")


if __name__ == "__main__":
    train_model(epochs=1, batch_size=4, lr=1e-4)