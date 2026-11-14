"""Dial-bowe v2 : SFT LoRA sur Qwen3.5-2B, lancé par torchrun sur les cartes disponibles (deux T4 sur Kaggle).

Recette du plan §6, la même que la v1 : LoRA de rang 16, alpha 32, taux 1e-4, 1 époque, lot effectif de 8
exemples, perte sur la réponse seulement, régime sans réflexion. Ce qui change :
- longueur maximale 16 384 jetons (les tâches de la v2 reprennent le contexte de 16 384 jetons de Localia ;
  à 8 192, 34 % des exemples, dont 64 % des demandes globales, seraient écartés) ;
- plusieurs cartes : chacune traite une partie des 8 exemples d'un pas (répartis pour équilibrer les jetons),
  puis les gradients LoRA sont additionnés entre cartes (all_reduce). Le calcul est celui d'une seule carte qui
  ferait les 8 exemples, à l'ordre des additions près ;
- garde de durée : avant la limite de 12 h d'une session Kaggle, point de reprise et arrêt propre ; la session
  suivante reprend (point de reprise fourni en entrée).

Mode « essai » : mesure, sur chaque carte, la mémoire et le temps d'un pas avant + arrière à 8k, 10k, 12k, 14k et
16k jetons (exemples réels), puis 6 pas d'entraînement réels, un point de reprise et son rechargement. Écrit essai.json.

Usage : torchrun --standalone --nproc_per_node N sft_v2_entrainement.py --base <dossier> --exemples <jsonl>
        --sortie <dossier> [--mode essai|sft] [--cpu] [--longueur-max 16384] [--heures-max 11]
"""
import argparse
import gc
import glob
import json
import math
import os
import random
import time

import torch
import torch.distributed as dist
from peft import LoraConfig, get_peft_model, get_peft_model_state_dict, set_peft_model_state_dict
from transformers import AutoModelForImageTextToText, AutoTokenizer

LR, EPOQUES, LOT, RANG = 1e-4, 1, 8, 16
SAUVEGARDE = 20  # pas entre deux points de reprise
PALIER = 256  # longueurs complétées au multiple de 256 (borne le nombre de formes vues par DeltaNet, cf. v1)
CIBLES = r".*language_model.*\.(q_proj|k_proj|v_proj|o_proj|in_proj_qkv|in_proj_z|out_proj|gate_proj|up_proj|down_proj)$"

ap = argparse.ArgumentParser()
ap.add_argument("--base", required=True)
ap.add_argument("--exemples", required=True)
ap.add_argument("--sortie", required=True)
ap.add_argument("--mode", default="sft", choices=["sft", "essai"])
ap.add_argument("--cpu", action="store_true", help="essai local sur le Mac (gloo, float32)")
ap.add_argument("--longueur-max", type=int, default=16384)
ap.add_argument("--heures-max", type=float, default=11.0)
ap.add_argument("--reprise", default="", help="point de reprise d'une session précédente")
a = ap.parse_args()

dist.init_process_group("gloo" if a.cpu else "nccl")
RG, NB = dist.get_rank(), dist.get_world_size()
DEV = torch.device("cpu") if a.cpu else torch.device("cuda", RG)
if not a.cpu:
    torch.cuda.set_device(DEV)
DT = torch.float32 if a.cpu else torch.float16
T0 = time.time()


def dire(*x):
    if RG == 0:
        print(*x, flush=True)


def mem():
    return 0.0 if a.cpu else torch.cuda.max_memory_allocated(DEV) / 1e9


# Données (chaque carte tokenise tout : l'ordre et les écarts sont ainsi identiques partout).
tok = AutoTokenizer.from_pretrained(a.base)
donnees, ecartes = [], {"gabarit": 0, "longueur": 0}
for ligne in open(a.exemples, encoding="utf-8"):
    if not ligne.strip():
        continue
    m = json.loads(ligne)["messages"]
    prefixe = tok.apply_chat_template(m[:-1], tokenize=False, add_generation_prompt=True, enable_thinking=False)
    complet = tok.apply_chat_template(m, tokenize=False, enable_thinking=False)
    ids_p = tok(prefixe, add_special_tokens=False)["input_ids"]
    ids = tok(complet.rstrip("\n"), add_special_tokens=False)["input_ids"]
    if not complet.startswith(prefixe) or ids[:len(ids_p)] != ids_p:
        ecartes["gabarit"] += 1
    elif len(ids) > a.longueur_max:
        ecartes["longueur"] += 1
    else:
        donnees.append((ids, len(ids_p)))
jetons = sum(len(x[0]) for x in donnees)
dire(f"exemples : {len(donnees)} gardés ({jetons} jetons), écartés {ecartes} ; {NB} carte(s)")
PAD = tok.pad_token_id if tok.pad_token_id is not None else tok.eos_token_id

# Modèle et LoRA (couches de langage : attention, DeltaNet, MLP ; in_proj_a/b et conv1d figés, comme en v1).
modele = AutoModelForImageTextToText.from_pretrained(a.base, dtype=DT, device_map={"": DEV})
modele.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
modele.enable_input_require_grads()
torch.manual_seed(1234 + RG)  # dropout différent par carte ; poids LoRA initiaux recopiés de la carte 0 ci-dessous
modele = get_peft_model(modele, LoraConfig(r=RANG, lora_alpha=2 * RANG, lora_dropout=0.05, target_modules=CIBLES,
                                           task_type="CAUSAL_LM"))
params = [p for p in modele.parameters() if p.requires_grad]
for p in params:
    p.data = p.data.float()
    dist.broadcast(p.data, 0)
if RG == 0:
    modele.print_trainable_parameters()
opt = torch.optim.AdamW(params, lr=LR, weight_decay=0.0)
pas_total = math.ceil(len(donnees) * EPOQUES / LOT)
sched = torch.optim.lr_scheduler.LambdaLR(
    opt, lambda s: min(1.0, (s + 1) / 5) * 0.5 * (1 + math.cos(math.pi * min(s, pas_total) / pas_total)))
scaler = torch.amp.GradScaler("cuda", enabled=not a.cpu)


def perte_exemple(i):
    """Perte (moyenne sur les jetons de la réponse) d'un exemple ; renvoie aussi son nombre de jetons."""
    ids, n_p = donnees[i]
    L = -(-len(ids) // PALIER) * PALIER
    x = torch.tensor([ids + [PAD] * (L - len(ids))], device=DEV)
    cible = x[0, n_p:len(ids)]
    # Logits sur la réponse seulement (vocabulaire de 248k en fp32 : la sortie complète ne tient pas sur une T4).
    with torch.autocast(DEV.type, dtype=DT, enabled=not a.cpu):
        logits = modele(input_ids=x, logits_to_keep=L - n_p + 1).logits[0, :len(ids) - n_p].float()
    return torch.nn.functional.cross_entropy(logits, cible), len(ids)


def repartir(groupe):
    """Exemples d'un pas → cartes : le plus long d'abord, vers la carte la moins chargée en jetons."""
    charge, parts = [0] * NB, [[] for _ in range(NB)]
    for i in sorted(groupe, key=lambda i: -len(donnees[i][0])):
        r = charge.index(min(charge))
        parts[r].append(i)
        charge[r] += len(donnees[i][0])
    return parts[RG]


def pas_entrainement(groupe):
    """Un pas : chaque carte fait ses exemples, gradients additionnés entre cartes, puis mise à jour."""
    somme, n_jetons = 0.0, 0
    for i in repartir(groupe):
        perte, n = perte_exemple(i)
        scaler.scale(perte / len(groupe)).backward()
        somme += perte.item()
        n_jetons += n
    for p in params:
        if p.grad is None:
            p.grad = torch.zeros_like(p.data)
    if NB > 1:
        plats = torch.cat([p.grad.reshape(-1) for p in params])
        dist.all_reduce(plats)
        k = 0
        for p in params:
            p.grad.copy_(plats[k:k + p.numel()].view_as(p.grad))
            k += p.numel()
        del plats
    scaler.unscale_(opt)
    torch.nn.utils.clip_grad_norm_(params, 1.0)
    scaler.step(opt)
    scaler.update()
    opt.zero_grad(set_to_none=True)
    sched.step()
    t = torch.tensor([somme, float(len(repartir(groupe))), float(n_jetons)], device=DEV, dtype=torch.float64)
    if NB > 1:
        dist.all_reduce(t)
    return t[0].item() / max(t[1].item(), 1.0), int(t[2].item())


def sauver(chemin, k, pas):
    if RG == 0:
        torch.save({"lora": get_peft_model_state_dict(modele), "opt": opt.state_dict(), "sched": sched.state_dict(),
                    "scaler": scaler.state_dict(), "k": k, "pas": pas}, chemin + ".tmp")
        os.replace(chemin + ".tmp", chemin)
    dist.barrier()


def charger(chemin):
    etat = torch.load(chemin, map_location=DEV, weights_only=False)
    set_peft_model_state_dict(modele, etat["lora"])
    for p in params:
        p.data = p.data.float()
    opt.load_state_dict(etat["opt"])
    sched.load_state_dict(etat["sched"])
    scaler.load_state_dict(etat["scaler"])
    return etat["k"], etat["pas"]


ordre = list(range(len(donnees)))
random.Random(1).shuffle(ordre)
groupes = [ordre[k:k + LOT] for k in range(0, len(ordre), LOT)]
reprise = os.path.join(a.sortie, "reprise.pt")
modele.train()

if a.mode == "essai":
    res = {"cartes": NB, "exemples": len(donnees), "jetons": jetons, "pas_total": pas_total, "mesures": []}
    # 1. Mémoire et temps par longueur : pour chaque palier, l'exemple réel le plus long sous le palier.
    paliers = [2048, 4096] if a.cpu else [8192, 10240, 12288, 14336, 16384]
    for lim in paliers:
        cand = [i for i, (ids, _) in enumerate(donnees) if len(ids) <= lim]
        if not cand:
            continue
        i = max(cand, key=lambda i: len(donnees[i][0]))
        if not a.cpu:
            torch.cuda.reset_peak_memory_stats(DEV)
            torch.cuda.synchronize(DEV)
        t = time.time()
        try:
            perte, n = perte_exemple(i)
            scaler.scale(perte).backward()
            if not a.cpu:
                torch.cuda.synchronize(DEV)
            m = {"palier": lim, "jetons": n, "réponse": n - donnees[i][1], "secondes": round(time.time() - t, 1),
                 "mém_Go": round(mem(), 2), "perte": round(perte.item(), 4)}
        except torch.OutOfMemoryError:
            m = {"palier": lim, "jetons": len(donnees[i][0]), "erreur": "mémoire GPU insuffisante"}
        opt.zero_grad(set_to_none=True)
        gc.collect()
        if not a.cpu:
            torch.cuda.empty_cache()
        m["carte"] = RG
        tout = [None] * NB
        dist.all_gather_object(tout, m)
        res["mesures"] += tout
        dire(json.dumps(tout, ensure_ascii=False))
        if any("erreur" in x for x in tout):
            break
    # 2. Pas réels (avec all_reduce entre cartes), point de reprise, rechargement.
    if not any("erreur" in x for x in res["mesures"]):
        if not a.cpu:
            torch.cuda.reset_peak_memory_stats(DEV)
        t, total, pertes = time.time(), 0, []
        for g in groupes[:6]:
            perte, n = pas_entrainement(g)
            pertes.append(round(perte, 4))
            total += n
        duree = time.time() - t
        sauver(reprise, 6 * LOT, 6)
        avant = [p.detach().clone() for p in params[:3]]
        k, pas = charger(reprise)
        ok = all(torch.equal(x, p.detach()) for x, p in zip(avant, params[:3])) and (k, pas) == (6 * LOT, 6)
        mems = [None] * NB
        dist.all_gather_object(mems, round(mem(), 2))
        res["pas"] = {"pertes": pertes, "jetons": total, "secondes": round(duree), "jetons_par_s": round(total / duree),
                      "mém_Go_par_carte": mems, "reprise_relue": ok,
                      "heures_estimées_lot_entier": round(jetons / (total / duree) / 3600, 1)}
        dire(json.dumps(res["pas"], ensure_ascii=False))
    if RG == 0:
        json.dump(res, open(os.path.join(a.sortie, "essai.json"), "w"), ensure_ascii=False, indent=1)
    dist.destroy_process_group()
    raise SystemExit(0)

# Entraînement.
k_debut, pas = 0, 0
if a.reprise and os.path.exists(a.reprise):
    k_debut, pas = charger(a.reprise)
    dire(f"reprise au pas {pas} (exemple {k_debut})")
journal = open(os.path.join(a.sortie, "entrainement.log"), "a") if RG == 0 else None
t0 = time.time()
for g_num, g in enumerate(groupes):
    if (g_num + 1) * LOT <= k_debut:
        continue
    perte, n = pas_entrainement(g)
    pas += 1
    ligne = (f"pas {pas}/{pas_total} perte {perte:.4f} lr {sched.get_last_lr()[0]:.2e} jetons {n} "
             f"{time.time() - t0:.0f} s mém {mem():.1f} Go")
    dire(ligne)
    if journal:
        journal.write(ligne + "\n")
        journal.flush()
    if pas % 10 == 0:
        gc.collect()
        torch.cuda.empty_cache()
    fin_session = time.time() - T0 > a.heures_max * 3600
    if pas % SAUVEGARDE == 0 or fin_session or pas == pas_total:
        sauver(reprise, (g_num + 1) * LOT, pas)
    if fin_session and pas < pas_total:
        dire(f"INCOMPLET : arrêt avant la limite de session, au pas {pas}/{pas_total}")
        break
if pas == pas_total and RG == 0:
    modele.save_pretrained(os.path.join(a.sortie, "adaptateur"))
    json.dump({"pas": pas, "pas_total": pas_total, "exemples": len(donnees), "jetons": jetons, "écartés": ecartes},
              open(os.path.join(a.sortie, "fini.json"), "w"), ensure_ascii=False)
    dire("FIN de l'entraînement")
dist.destroy_process_group()
