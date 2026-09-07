"""
OceanEmbedNet: Production Deep Learning Architecture — EXACT checkpoint-matching version.
SIH Problem 26066 — MoES / INCOIS

This version matches the exact layer naming from oceanembed_best.pt:
  encoder.stem, encoder.block1.{conv1,gn1,conv2,gn2}, encoder.attn.conv,
  encoder.head, depth_expansion.depth_embed/depth_conv,
  refiner.{0,1}.{conv1,gn1,conv2,gn2}, refiner.2

Input:  (B, 7, 101, 241) — [SST, SSS, SSH, u_curr, v_curr, u_wind, v_wind]
Output: (B, 15, 101, 241) — temperature at 15 standard depth levels (°C)

Data source: Copernicus GLORYS12V1 reanalysis (doi: 10.48670/moi-00021)
"""

from pathlib import Path
from typing import Optional, Tuple
import torch
import torch.nn as nn

ROOT = Path(__file__).resolve().parents[2]


# ─────────────────────────────────────────────────────────────────────────────
# Building Blocks (matching checkpoint key naming exactly)
# ─────────────────────────────────────────────────────────────────────────────

class ResidualBlock2D(nn.Module):
    """Residual block with named layers matching the checkpoint: conv1, gn1, conv2, gn2."""
    def __init__(self, channels: int, groups: int = 8):
        super().__init__()
        # Find largest divisor of channels that is <= groups
        g = next((i for i in range(min(groups, channels), 0, -1) if channels % i == 0), 1)
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.gn1   = nn.GroupNorm(g, channels)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.gn2   = nn.GroupNorm(g, channels)
        self.act   = nn.LeakyReLU(0.1, inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = self.act(self.gn1(self.conv1(x)))
        h = self.gn2(self.conv2(h))
        return self.act(x + h)


class SpatialAttention(nn.Module):
    """Spatial attention gate (single key in checkpoint: attn.conv)."""
    def __init__(self):
        super().__init__()
        self.conv = nn.Conv2d(2, 1, kernel_size=7, padding=3, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        avg_pool = x.mean(dim=1, keepdim=True)
        max_pool = x.max(dim=1, keepdim=True).values
        attn     = torch.sigmoid(self.conv(torch.cat([avg_pool, max_pool], dim=1)))
        return x * attn


class OceanSurfaceEncoder(nn.Module):
    """
    Matches checkpoint keys:
      stem.0.weight / stem.0.bias / stem.1.weight / stem.1.bias
      block1.conv1 / block1.gn1 / block1.conv2 / block1.gn2
      transition.0 / transition.1
      block2.conv1 / block2.gn1 / block2.conv2 / block2.gn2
      attn.conv
      head.weight / head.bias
    """
    def __init__(self, in_channels: int = 7, embedding_dim: int = 64):
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv2d(in_channels, 32, kernel_size=3, padding=1, bias=True),
            nn.GroupNorm(8, 32),
        )
        self.block1      = ResidualBlock2D(32, groups=8)
        self.transition  = nn.Sequential(
            nn.Conv2d(32, embedding_dim, kernel_size=3, padding=1, bias=True),
            nn.GroupNorm(8, embedding_dim),
        )
        self.block2      = ResidualBlock2D(embedding_dim, groups=8)
        self.attn        = SpatialAttention()
        self.head        = nn.Conv2d(embedding_dim, embedding_dim, kernel_size=1, bias=True)
        self.act         = nn.LeakyReLU(0.1, inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.act(self.stem(x))
        x = self.block1(x)
        x = self.act(self.transition(x))
        x = self.block2(x)
        x = self.attn(x)
        x = self.head(x)
        return x


class DepthExpansionModule(nn.Module):
    """
    Matches checkpoint keys:
      depth_embed: (15, 64)
      depth_conv.0 / depth_conv.1 / depth_conv.3
    """
    def __init__(self, embedding_dim: int = 64, n_depths: int = 15):
        super().__init__()
        self.n_depths   = n_depths
        # depth_embed shape must be (15, 64) to match checkpoint
        self.depth_embed = nn.Parameter(torch.zeros(n_depths, embedding_dim))
        self._init_depth_embeddings()

        # depth_conv: [Conv2d(64->128), GroupNorm(8,128), LeakyReLU, Conv2d(128->15)]
        # indices 0=Conv, 1=GroupNorm, 2=LeakyReLU, 3=Conv → matches checkpoint .0,.1,.3
        self.depth_conv = nn.Sequential(
            nn.Conv2d(embedding_dim, embedding_dim * 2, kernel_size=3, padding=1, bias=True),  # 0
            nn.GroupNorm(8, embedding_dim * 2),                                                  # 1
            nn.LeakyReLU(0.1, inplace=True),                                                     # 2
            nn.Conv2d(embedding_dim * 2, n_depths, kernel_size=1, bias=True),                   # 3
        )

    def _init_depth_embeddings(self):
        from src.config import STANDARD_DEPTHS
        depth_vals = torch.tensor(STANDARD_DEPTHS, dtype=torch.float32)
        log_depths = torch.log1p(depth_vals)
        normed     = (log_depths - log_depths.mean()) / (log_depths.std() + 1e-6)
        # broadcast into all 64 columns
        with torch.no_grad():
            self.depth_embed.data = normed.unsqueeze(1).expand(-1, self.depth_embed.shape[1]).clone()

    def forward(self, z_surf: torch.Tensor) -> torch.Tensor:
        return self.depth_conv(z_surf)


class OceanEmbedNet(nn.Module):
    """
    Complete OceanEmbed Satellite Reconstruction Network.
    Matches oceanembed_best.pt checkpoint exactly.

    Maps: (B, 7, H, W) satellite → (B, 15, H, W) subsurface temperature (°C).
    """
    def __init__(
        self,
        in_channels:   int = 7,
        out_depths:    int = 15,
        embedding_dim: int = 64,
    ):
        super().__init__()
        self.encoder         = OceanSurfaceEncoder(in_channels=in_channels, embedding_dim=embedding_dim)
        self.depth_expansion = DepthExpansionModule(embedding_dim=embedding_dim, n_depths=out_depths)

        # refiner: indices 0, 1 are ResidualBlock2D, index 2 is plain Conv2d
        # Matches checkpoint: refiner.0.conv1, refiner.1.conv1, refiner.2.weight
        self.refiner = nn.ModuleList([
            ResidualBlock2D(out_depths, groups=8),
            ResidualBlock2D(out_depths, groups=8),
            nn.Conv2d(out_depths, out_depths, kernel_size=3, padding=1),
        ])

        # SST physical skip connection (matches checkpoint: sst_skip_weight)
        self.sst_skip_weight = nn.Parameter(
            torch.tensor([0.95, 0.90, 0.80, 0.60] + [0.0] * (out_depths - 4))
        )

    def forward(
        self,
        x_surf: torch.Tensor,
        return_embedding: bool = False,
    ) -> Tuple[torch.Tensor, Optional[torch.Tensor]]:
        z_surf     = self.encoder(x_surf)
        depth_feat = self.depth_expansion(z_surf)
        # Apply refiner sequentially
        t3d = depth_feat
        for layer in self.refiner:
            t3d = layer(t3d)
        # Physical SST skip
        sst_ch     = x_surf[:, 0:1, :, :]
        skip_scale = self.sst_skip_weight.view(1, -1, 1, 1).to(x_surf.device)
        t3d        = t3d + (sst_ch * skip_scale)
        return (t3d, z_surf) if return_embedding else (t3d, None)

    def extract_latent_embedding(self, x_surf: torch.Tensor) -> torch.Tensor:
        """Returns 64-channel latent spatial embedding."""
        return self.encoder(x_surf)


def load_trained_ocean_embed_net(
    checkpoint_path: Optional[Path] = None,
    device: str = "cpu",
) -> OceanEmbedNet:
    """Load trained OceanEmbedNet weights from oceanembed_best.pt."""
    from src.config import MODEL_CHECKPOINT
    path = checkpoint_path or MODEL_CHECKPOINT

    if not path.exists():
        raise FileNotFoundError(
            f"OceanEmbedNet checkpoint not found at: {path}\n"
            "Expected: ocean_embed_inference_assets/oceanembed_best.pt"
        )

    model = OceanEmbedNet(in_channels=7, out_depths=15, embedding_dim=64)
    ckpt  = torch.load(path, map_location=device, weights_only=False)

    if isinstance(ckpt, dict) and "model_state_dict" in ckpt:
        sd = ckpt["model_state_dict"]
    else:
        sd = ckpt

    # Load with strict=False to tolerate minor key differences, then report
    missing, unexpected = model.load_state_dict(sd, strict=False)
    if missing:
        print(f"[WARN] Missing keys ({len(missing)}): {missing[:3]}...", flush=True)
    if unexpected:
        print(f"[WARN] Unexpected keys ({len(unexpected)}): {unexpected[:3]}...", flush=True)
    if not missing and not unexpected:
        print(f"[OceanEmbedNet] Perfect load from: {path.name}", flush=True)
    else:
        print(f"[OceanEmbedNet] Partial load from: {path.name} — {len(missing)} missing, {len(unexpected)} unexpected", flush=True)

    model.to(device)
    model.eval()
    return model
