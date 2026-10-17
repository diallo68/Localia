# 13 — Fusion de modèles et adaptateurs fusionnés

**Statut** : différé (phase 3, après un premier adaptateur).

## Hypothèse
Fusionner (TIES, arXiv:2306.01708 ; DARE, arXiv:2311.03099) un adaptateur « documentaire » et un adaptateur « rédaction » permettrait de récupérer les compétences générales perdues pendant le SFT.

## Avocat du diable
Avec un seul périmètre et une seule base, la fusion apporte surtout un garde-fou contre l'oubli : interpolation entre la base et le modèle affiné (WiSE-FT, arXiv:2109.01903). Elle coûte presque rien (calcul CPU) mais le gain attendu est faible : 0 à +3 points.

## Expérience
Interpoler λ ∈ {0,3 ; 0,5 ; 0,7 ; 1} entre la base et le modèle affiné, puis mesurer documentaire et MMMLU-fr. On garde le meilleur compromis si la régression générale descend sous 1 point pour moins de 1 point documentaire perdu.

## Décision
Différé ; coût quasi nul en fin de phase 3.
