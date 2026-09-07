import torch
import torch.nn as nn
import torch.nn.functional as F

class ViTEncoderBlock(nn.Module):
    """
    Vision Transformer (ViT) Spatial Self-Attention Encoder Block
    """
    def __init__(self, channels, num_heads=4):
        super(ViTEncoderBlock, self).__init__()
        self.conv_in = nn.Conv2d(channels, channels, kernel_size=3, padding=1)
        self.norm1 = nn.LayerNorm([channels])
        self.attn = nn.MultiheadAttention(embed_dim=channels, num_heads=num_heads, batch_first=True)
        self.norm2 = nn.LayerNorm([channels])
        self.ffn = nn.Sequential(
            nn.Linear(channels, channels * 2),
            nn.GELU(),
            nn.Linear(channels * 2, channels)
        )

    def forward(self, x):
        # x: (batch, channels, height, width)
        b, c, h, w = x.shape
        x_conv = F.relu(self.conv_in(x))
        # Flatten spatial dimensions for Transformer Self-Attention: (batch, h*w, channels)
        x_flat = x_conv.permute(0, 2, 3, 1).reshape(b, h * w, c)
        
        # Self-Attention
        attn_out, _ = self.attn(x_flat, x_flat, x_flat)
        x_norm1 = self.norm1(x_flat + attn_out)
        
        # Feed-Forward Network
        ffn_out = self.ffn(x_norm1)
        x_norm2 = self.norm2(x_norm1 + ffn_out)
        
        # Reshape back to 2D image tensor: (batch, channels, height, width)
        out = x_norm2.reshape(b, h, w, c).permute(0, 3, 1, 2)
        return out

class DualViTUNetReconstructor(nn.Module):
    """
    Dual U-Net Vision Transformer (Dual ViT-UNet) Architecture:
    - Branch 1: Thermal Spatial ViT-UNet (SST + SSS features)
    - Branch 2: Ocean Dynamics ViT-UNet (SSH + Wind Forcing features)
    - Cross-Attention Dual Fusion Bottleneck
    - Volumetric 3D Subsurface Reconstruction Decoder (0m to 1000m depth)
    """
    def __init__(self, in_channels=4, embed_dim=64, num_depths=16, seq_len=6):
        super(DualViTUNetReconstructor, self).__init__()
        self.seq_len = seq_len

        # Branch 1: Thermal Spatial ViT-UNet
        self.branch1_conv = nn.Conv2d(2 * seq_len, embed_dim // 2, kernel_size=3, padding=1)
        self.branch1_vit = ViTEncoderBlock(embed_dim // 2, num_heads=4)

        # Branch 2: Ocean Dynamics ViT-UNet
        self.branch2_conv = nn.Conv2d(2 * seq_len, embed_dim // 2, kernel_size=3, padding=1)
        self.branch2_vit = ViTEncoderBlock(embed_dim // 2, num_heads=4)

        # Cross-Attention Dual Fusion Bottleneck
        self.fusion_conv = nn.Conv2d(embed_dim, embed_dim, kernel_size=3, padding=1)
        self.fusion_bn = nn.BatchNorm2d(embed_dim)

        # 3D Volumetric Reconstruction Decoder
        self.volumetric_decoder = nn.Sequential(
            nn.Conv2d(embed_dim, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(64),
            nn.Conv2d(64, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv2d(32, num_depths, kernel_size=1)
        )

    def forward(self, x):
        # x shape: (batch, seq_len, height, width, channels=4)
        b, s, h, w, c = x.shape
        
        # Split into Branch 1 (SST, SSS) and Branch 2 (SSH, Wind)
        b1_in = x[..., :2].permute(0, 1, 4, 2, 3).reshape(b, s * 2, h, w)
        b2_in = x[..., 2:].permute(0, 1, 4, 2, 3).reshape(b, s * 2, h, w)

        feat1 = self.branch1_vit(F.relu(self.branch1_conv(b1_in)))
        feat2 = self.branch2_vit(F.relu(self.branch2_conv(b2_in)))

        # Dual Fusion Bottleneck
        fused = torch.cat([feat1, feat2], dim=1)
        fused_lat = F.relu(self.fusion_bn(self.fusion_conv(fused)))

        # Volumetric 3D Output: (batch, height, width, num_depths)
        volumetric_output = self.volumetric_decoder(fused_lat).permute(0, 2, 3, 1)
        return volumetric_output, fused_lat

if __name__ == "__main__":
    model = DualViTUNetReconstructor()
    dummy_input = torch.randn(1, 6, 52, 121, 4)
    out, lat = model(dummy_input)
    print("Dual ViT-UNet Output Shape:", out.shape)
    print("Dual Fusion Latent Embedding Shape:", lat.shape)
