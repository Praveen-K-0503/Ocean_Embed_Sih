import torch
import torch.nn as nn
import torch.nn.functional as F

class SatelliteEncoder(nn.Module):
    """
    Satellite Embedding Engine:
    Transforms multi-channel surface observation sequences (SST, SSS, SSH, Wind)
    into compact 2D latent spatial embeddings (latent representations of upper ocean dynamics).
    """
    def __init__(self, in_channels=4, embed_dim=64, seq_len=6):
        super(SatelliteEncoder, self).__init__()
        self.seq_len = seq_len
        self.conv1 = nn.Conv2d(in_channels * seq_len, 32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.conv2 = nn.Conv2d(32, embed_dim, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(embed_dim)
        self.attention = nn.Sequential(
            nn.Conv2d(embed_dim, embed_dim, kernel_size=1),
            nn.Sigmoid()
        )

    def forward(self, x):
        # x: (batch, seq_len, height, width, channels)
        b, s, h, w, c = x.shape
        x_reshaped = x.permute(0, 1, 4, 2, 3).reshape(b, s * c, h, w)
        
        feat = F.relu(self.bn1(self.conv1(x_reshaped)))
        embed = self.bn2(self.conv2(feat))
        attn = self.attention(embed)
        latent_embedding = embed * attn
        return latent_embedding  # (batch, embed_dim, height, width)

class OceanEmbedReconstructor(nn.Module):
    """
    3D Subsurface Temperature Reconstruction Model:
    Maps latent satellite embeddings to multi-depth temperature profiles (16 standard depths: 0m to 1000m).
    """
    def __init__(self, embed_dim=64, num_depths=16):
        super(OceanEmbedReconstructor, self).__init__()
        self.encoder = SatelliteEncoder(in_channels=4, embed_dim=embed_dim)
        self.decoder = nn.Sequential(
            nn.Conv2d(embed_dim, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(64),
            nn.Conv2d(64, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv2d(32, num_depths, kernel_size=1)
        )

    def extract_embedding(self, x):
        return self.encoder(x)

    def forward(self, x):
        embedding = self.encoder(x)
        output = self.decoder(embedding)
        # Permute output to (batch, height, width, num_depths)
        output = output.permute(0, 2, 3, 1)
        return output, embedding

if __name__ == "__main__":
    model = OceanEmbedReconstructor()
    dummy = torch.randn(1, 6, 52, 121, 4)
    out, emb = model(dummy)
    print("Output shape:", out.shape)
    print("Embedding shape:", emb.shape)
