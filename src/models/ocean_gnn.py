"""
OceanGraphNeuralNetwork (OceanGNN): Hydrodynamic Spatial-Temporal Graph Architecture.
SIH Problem 26066 — MoES / INCOIS

Models North Indian Ocean satellite observations and in-situ ARGO stations as a
Spatial Hydrodynamic Graph:
  - Nodes: Observation stations & regional basin centroids (7 surface satellite features: SST, SSS, SSH, U, V, Winds U/V)
  - Edges: Hydrodynamic connectivity combining spatial geodesic distance and surface current advection vectors (u, v)
  - Message Passing: Graph Attention / GCN layers learning latent ocean representations
  - Output: 3D Subsurface ocean temperature profiles at the 15 INCOIS standard depths (0 to 1000m)
"""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from src.config import STANDARD_DEPTHS, N_DEPTHS, NORM_STATS


class GraphAttentionLayer(nn.Module):
    """
    Graph Attention Layer with Hydrodynamic Edge Weight Modulation.
    Propagates surface satellite signatures along ocean current advection corridors.
    """
    def __init__(self, in_features: int, out_features: int, dropout: float = 0.1, alpha: float = 0.2):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.dropout = dropout
        self.alpha = alpha

        self.W = nn.Linear(in_features, out_features, bias=False)
        self.a_src = nn.Parameter(torch.zeros(out_features, 1))
        self.a_dst = nn.Parameter(torch.zeros(out_features, 1))
        self.bias = nn.Parameter(torch.zeros(out_features))

        nn.init.xavier_uniform_(self.W.weight)
        nn.init.xavier_uniform_(self.a_src)
        nn.init.xavier_uniform_(self.a_dst)

    def forward(self, h: torch.Tensor, adj: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        h: Node features tensor [N, in_features]
        adj: Normalized hydrodynamic adjacency matrix [N, N]
        """
        Wh = self.W(h)  # [N, out_features]
        
        # Self-attention coefficients
        f_src = torch.matmul(Wh, self.a_src)  # [N, 1]
        f_dst = torch.matmul(Wh, self.a_dst)  # [N, 1]
        attn_logits = f_src + f_dst.T         # [N, N]
        attn_logits = F.leaky_relu(attn_logits, self.alpha)

        # Mask non-edges with very negative numbers
        mask = (adj > 0).float()
        zero_vec = -9e15 * torch.ones_like(attn_logits)
        attn_weights = torch.where(mask > 0, attn_logits, zero_vec)
        attn_weights = F.softmax(attn_weights, dim=-1)
        attn_weights = F.dropout(attn_weights, p=self.dropout, training=self.training)

        # Modulate attention by hydrodynamic edge weights
        attn_weights = attn_weights * adj

        # Aggregate neighbor features
        h_prime = torch.matmul(attn_weights, Wh) + self.bias
        return h_prime, attn_weights


class OceanGNN(nn.Module):
    """
    OceanGraphNeuralNetwork for Subsurface Ocean Temperature Reconstruction:
      1. Node Feature Encoder: 7 Surface Channels -> 64-dim Node Feature
      2. Layer 1 Graph Attention: Spatial proximity & mesoscale eddy coupling
      3. Layer 2 Graph Attention: Hydrodynamic basin-scale teleconnection
      4. Latent Graph Embedding: Compact 64-dim satellite ocean representation
      5. Subsurface Temperature Decoder: Projects latent graph state to 15 standard depths
    """
    def __init__(self, in_features: int = 7, hidden_dim: int = 64, out_depths: int = 15):
        super().__init__()
        self.in_features = in_features
        self.hidden_dim = hidden_dim
        self.out_depths = out_depths

        # 1. Node Encoder (Transforms 7 surface satellite variables)
        self.encoder = nn.Sequential(
            nn.Linear(in_features, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.LeakyReLU(0.1, inplace=True),
            nn.Linear(hidden_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.LeakyReLU(0.1, inplace=True),
        )

        # 2. Graph Attention Message Passing Layers
        self.gat1 = GraphAttentionLayer(hidden_dim, hidden_dim, dropout=0.05)
        self.gat2 = GraphAttentionLayer(hidden_dim, hidden_dim, dropout=0.05)

        # 3. Residual and LayerNorm
        self.norm1 = nn.LayerNorm(hidden_dim)
        self.norm2 = nn.LayerNorm(hidden_dim)

        # 4. Subsurface Vertical Depth Decoder (15 standard depths: 0m to 1000m)
        self.decoder = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim * 2),
            nn.LayerNorm(hidden_dim * 2),
            nn.LeakyReLU(0.1, inplace=True),
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.LeakyReLU(0.1, inplace=True),
            nn.Linear(hidden_dim, out_depths)
        )

    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        x: [N, 7] surface variables for N nodes
        adj: [N, N] hydrodynamic adjacency matrix
        Returns:
          pred_profiles: [N, 15] predicted vertical temperature profiles (°C)
          latent_embeddings: [N, 64] compact satellite graph embeddings
          attn_weights: [N, N] learned attention matrix
        """
        # Encode surface features
        h0 = self.encoder(x)  # [N, 64]

        # First Graph Message Passing Block
        h1, attn1 = self.gat1(h0, adj)
        h1 = self.norm1(F.leaky_relu(h0 + h1, 0.1))

        # Second Graph Message Passing Block
        h2, attn2 = self.gat2(h1, adj)
        latent_embeddings = self.norm2(F.leaky_relu(h1 + h2, 0.1))

        # Reconstruct vertical temperature profiles across all 15 depths
        pred_profiles = self.decoder(latent_embeddings)

        return pred_profiles, latent_embeddings, attn2


def build_hydrodynamic_adjacency(
    nodes: List[Dict[str, Any]],
    distance_threshold_deg: float = 12.0
) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    Builds a normalized hydrodynamic spatial adjacency matrix for a set of ocean nodes.
    Combines spatial inverse distance with surface ocean current advection vectors.
    """
    N = len(nodes)
    A = np.zeros((N, N), dtype=np.float32)
    edges = []

    for i in range(N):
        lat_i, lon_i = nodes[i]["lat"], nodes[i]["lon"]
        u_i = nodes[i].get("u", 0.0)
        v_i = nodes[i].get("v", 0.0)

        for j in range(N):
            if i == j:
                A[i, j] = 1.0  # Self-loop
                continue

            lat_j, lon_j = nodes[j]["lat"], nodes[j]["lon"]
            d_lat = lat_j - lat_i
            d_lon = lon_j - lon_i
            dist = np.sqrt(d_lat**2 + d_lon**2)

            if dist <= distance_threshold_deg:
                # Spatial proximity weight (Gaussian kernel)
                w_dist = np.exp(- (dist**2) / (2 * (distance_threshold_deg / 2.5)**2))

                # Hydrodynamic advection alignment
                # Dot product between surface current vector and direction to neighbor node
                norm_dir = np.array([d_lon, d_lat]) / (dist + 1e-6)
                curr_vec = np.array([u_i, v_i])
                advection = np.dot(curr_vec, norm_dir)
                w_hydro = 1.0 + 0.4 * np.clip(advection / 0.3, -0.8, 1.0)

                w_edge = float(w_dist * w_hydro)
                A[i, j] = w_edge

                edges.append({
                    "source": nodes[i]["id"],
                    "target": nodes[j]["id"],
                    "source_idx": i,
                    "target_idx": j,
                    "weight": round(w_edge, 3),
                    "dist_deg": round(float(dist), 2),
                    "dist_km": round(float(dist * 111.0), 1),
                    "current_alignment": round(float(advection), 3)
                })

    # Degree normalization (Symmetric Laplacian: D^{-1/2} A D^{-1/2})
    deg = np.sum(A, axis=1)
    deg_inv_sqrt = np.power(deg, -0.5, where=deg > 0)
    deg_inv_sqrt[deg <= 0] = 0.0
    D_inv = np.diag(deg_inv_sqrt)
    A_norm = D_inv @ A @ D_inv

    return A_norm, edges
