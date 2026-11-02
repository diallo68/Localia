# Localia, défi modèle compact, étape 3.6 : juge ouvert non-Qwen, Mistral Small 3.2 24B Instruct (Apache 2.0),
# même GGUF et même révision que pour l'évaluation des comparateurs (bartowski, Q4_K_M). Kaggle, 2 × T4, llama.cpp
# CUDA (binaires du jeu localia-llama-bin-cuda), modèle réparti sur les deux cartes, 4 requêtes en parallèle.
# Température 0, sortie contrainte par un schéma JSON (justification, note 0 / 0,5 / 1, affirmation non étayée).
# Entrée : a_juger.jsonl (preparer_juge.py), dont l'empreinte est vérifiée avant tout appel ; le juge ne voit jamais
# le nom des modèles. Sorties : verdicts.jsonl, manifeste.json. LIMITE : nombre de tâches pour une répétition.
import concurrent.futures as cf
import glob
import hashlib
import json
import os
import shutil
import subprocess
import time
import urllib.error
import urllib.request

JEU, EMPREINTE, LIMITE = "localia-juge-secret", "A_REMPLIR", None
DEPOT = "bartowski/mistralai_Mistral-Small-3.2-24B-Instruct-2506-GGUF"
FICHIER = "mistralai_Mistral-Small-3.2-24B-Instruct-2506-Q4_K_M.gguf"
REVISION = "b3592d09be469bedab6be51f577824b3b6b76ba1"  # celle de l'étape 3.5 (resultats/secret/finale/a-manifeste.jsonl)
PARALLELE, CONTEXTE = 4, 12288
TRAVAIL = "/kaggle/working"
TMP = "/kaggle/tmp" if os.path.isdir("/kaggle/tmp") else "/tmp"
SCHEMA = {"type": "object",
          "properties": {"ce_que_dit_la_reponse": {"type": "string"}, "justification": {"type": "string"}, "note": {"type": "number", "enum": [0, 0.5, 1]},
                         "affirmation_non_etayee": {"type": "boolean"}},
          "required": ["ce_que_dit_la_reponse", "justification", "note", "affirmation_non_etayee"], "additionalProperties": False}


def sh(cmd):
    print("$", cmd, flush=True)
    return subprocess.run(cmd, shell=True, check=True)


cartes = subprocess.run("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader", shell=True,
                        capture_output=True, text=True).stdout.strip().splitlines()
print(cartes, flush=True)
assert len(cartes) == 2 and all("T4" in c for c in cartes), "deux T4 attendues"

(chemin_taches,) = [c for c in glob.glob("/kaggle/input/**/a_juger.jsonl", recursive=True) if JEU in c]
empreinte = hashlib.sha256(open(chemin_taches, "rb").read()).hexdigest()
assert empreinte == EMPREINTE, f"empreinte de a_juger.jsonl inattendue : {empreinte}"
taches = [json.loads(l) for l in open(chemin_taches, encoding="utf-8")][:LIMITE]
assert len({t["id"] for t in taches}) == len(taches), "identifiants de tâches en double"
print(f"{len(taches)} tâches, empreinte vérifiée", flush=True)

(deja,) = [c for c in glob.glob("/kaggle/input/**/llama-server", recursive=True) if "localia-llama-bin-cuda" in c]
serveur = os.path.join(TMP, "llama-bin/llama-server")
shutil.copytree(os.path.dirname(deja), os.path.dirname(serveur), dirs_exist_ok=True)
sh(f"chmod +x {os.path.dirname(serveur)}/*")
os.environ["LD_LIBRARY_PATH"] = os.path.dirname(serveur) + ":" + os.environ.get("LD_LIBRARY_PATH", "")
version = subprocess.run(f"{serveur} --version", shell=True, capture_output=True, text=True)

from huggingface_hub import hf_hub_download  # noqa: E402  (préinstallé sur Kaggle)

t0 = time.time()
modele = hf_hub_download(DEPOT, FICHIER, revision=REVISION, cache_dir=os.path.join(TMP, "hf"))
h = hashlib.sha256()
with open(modele, "rb") as f:
    for bloc in iter(lambda: f.read(1 << 24), b""):
        h.update(bloc)
manifeste = {"juge": DEPOT + "/" + FICHIER, "revision": REVISION, "sha256": h.hexdigest(),
             "octets": os.path.getsize(modele), "llama": (version.stdout + version.stderr).strip(),
             "llama_sha256": hashlib.sha256(open(serveur, "rb").read()).hexdigest(), "contexte_par_requete": CONTEXTE,
             "a_juger": empreinte, "taches": len(taches), "temperature": 0, "parallele": PARALLELE}
print(f"juge téléchargé et haché en {time.time() - t0:.0f} s", flush=True)

try:
    urllib.request.urlopen("http://127.0.0.1:8081/health", timeout=2)
    raise SystemExit("port 8081 déjà occupé")
except OSError:
    pass
log = open(os.path.join(TRAVAIL, "serveur-juge.log"), "w")
p = subprocess.Popen([serveur, "-m", modele, "-a", "juge", "-c", str(CONTEXTE * PARALLELE), "-np", str(PARALLELE),
                      "-ngl", "999", "--split-mode", "layer", "-fa", "on", "--jinja", "--host", "127.0.0.1",
                      "--port", "8081"], stdout=log, stderr=log)
for _ in range(450):
    assert p.poll() is None, "le serveur s'est arrêté"
    try:
        if b"ok" in urllib.request.urlopen("http://127.0.0.1:8081/health", timeout=5).read():
            break
    except Exception:
        pass
    time.sleep(2)
else:
    raise TimeoutError("serveur pas prêt après 15 min")
servi = json.loads(urllib.request.urlopen("http://127.0.0.1:8081/v1/models", timeout=10).read())
assert [m["id"] for m in servi["data"]] == ["juge"], f"modèle servi inattendu : {servi}"


def juger(t):
    corps = {"model": "juge", "messages": t["messages"], "temperature": 0, "max_tokens": 500,
             "response_format": {"type": "json_schema", "json_schema": {"name": "verdict", "schema": SCHEMA}}}
    req = urllib.request.Request("http://127.0.0.1:8081/v1/chat/completions", data=json.dumps(corps).encode(),
                                 headers={"Content-Type": "application/json"})
    err = None
    for essai in range(3):
        try:
            debut = time.time()
            with urllib.request.urlopen(req, timeout=1800) as r:
                rep = json.loads(r.read())
            c = rep["choices"][0]
            assert c.get("finish_reason") == "stop", f"fin : {c.get('finish_reason')}"
            v = json.loads(c["message"]["content"])
            assert set(v) == set(SCHEMA["properties"]), v
            assert type(v["note"]) in (int, float) and v["note"] in (0, 0.5, 1), v
            assert isinstance(v["affirmation_non_etayee"], bool) and isinstance(v["justification"], str) \
                and v["justification"].strip(), v
            return {"id": t["id"], "verdict": v, "fin": c.get("finish_reason"), "essais": essai + 1,
                    "jetons_entree": rep.get("usage", {}).get("prompt_tokens"), "duree_s": round(time.time() - debut, 1)}
        except urllib.error.HTTPError as e:
            err = f"HTTP {e.code} : {e.read()[:500]!r}"
            time.sleep(5)
        except Exception as e:
            err = repr(e)
            time.sleep(5)
    return {"id": t["id"], "verdict": None, "erreur": err}


t0 = time.time()
n_err, entree_max = 0, 0
with cf.ThreadPoolExecutor(PARALLELE) as ex, open(os.path.join(TRAVAIL, "verdicts.jsonl"), "w") as s:
    for i, res in enumerate(ex.map(juger, taches)):  # ordre des tâches gardé : un cas après l'autre
        n_err += res["verdict"] is None
        entree_max = max(entree_max, res.get("jetons_entree") or 0)
        s.write(json.dumps(res, ensure_ascii=False) + "\n")
        s.flush()
        if i % 100 == 0:
            print(f"{i + 1}/{len(taches)} en {time.time() - t0:.0f} s", flush=True)
assert p.poll() is None, "le serveur s'est arrêté pendant les appels"
p.terminate()
p.wait()
manifeste.update(minutes=round((time.time() - t0) / 60, 1), erreurs=n_err, jetons_entree_max=entree_max)
json.dump(manifeste, open(os.path.join(TRAVAIL, "manifeste.json"), "w"), ensure_ascii=False, indent=1)
print(f"{len(taches)} tâches jugées en {time.time() - t0:.0f} s, {n_err} en erreur", flush=True)
print("FIN", flush=True)
