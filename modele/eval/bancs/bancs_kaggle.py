# Localia, défi modèle compact, étape 3.4 : benchmarks publics français (preparer_bancs.py) pour la base Qwen3.5-2B
# Q4_K_M et le modèle retenu (lot 4 élagué, vocfr48k), sur Kaggle, 2 × T4, llama.cpp avec CUDA : un modèle par
# carte, sans réflexion, température 0. Les réponses sont notées ensuite sur le Mac (noter_bancs.py).
# Entrée : bancs.jsonl et les deux GGUF (jeu privé localia-bancs-publics). Sortie : reponses-<modele>.jsonl.
import concurrent.futures as cf
import glob
import json
import os
import shutil
import subprocess
import time
import urllib.request

TRAVAIL = "/kaggle/working"
TMP = "/kaggle/tmp" if os.path.isdir("/kaggle/tmp") else "/tmp"
PARALLELE = 8
MODELES = {"base": ("Qwen3.5-2B-Q4_K_M.gguf", 0, 8081),
           "lot4": ("qwen35-2b-lora-Q4_K_M-sansreflexion-vocfr48k.gguf", 1, 8082)}


def sh(cmd):
    print("$", cmd, flush=True)
    return subprocess.run(cmd, shell=True, check=True)


subprocess.run("nvidia-smi --query-gpu=name,memory.total --format=csv || echo PAS DE GPU", shell=True)

# llama.cpp avec CUDA, binaires du jeu localia-llama-bin-cuda (ceux du juge du lot 6).
deja = glob.glob("/kaggle/input/**/llama-server", recursive=True)
serveur = os.path.join(TMP, "llama-bin/llama-server")
shutil.copytree(os.path.dirname(deja[0]), os.path.dirname(serveur), dirs_exist_ok=True)
sh(f"chmod +x {os.path.dirname(serveur)}/*")
os.environ["LD_LIBRARY_PATH"] = os.path.dirname(serveur) + ":" + os.environ.get("LD_LIBRARY_PATH", "")

procs = []
for nom, (fichier, carte, port) in MODELES.items():
    chemin = glob.glob(f"/kaggle/input/**/{fichier}", recursive=True)[0]
    log = open(os.path.join(TRAVAIL, f"serveur-{nom}.log"), "w")
    env = dict(os.environ, CUDA_VISIBLE_DEVICES=str(carte))
    procs.append(subprocess.Popen([serveur, "-m", chemin, "-c", str(4096 * PARALLELE), "-np", str(PARALLELE),
                                   "-ngl", "999", "-fa", "on", "--jinja", "--host", "127.0.0.1", "--port", str(port)],
                                  stdout=log, stderr=log, env=env))
t0 = time.time()
for nom, (_, _, port) in MODELES.items():
    for _ in range(300):
        try:
            if b"ok" in urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=5).read():
                break
        except Exception:
            pass
        time.sleep(2)
    print(f"serveur {nom} prêt après {time.time() - t0:.0f} s", flush=True)


def appeler(port, q):
    corps = {"messages": q["messages"], "temperature": 0, "max_tokens": q["max_tokens"],
             "chat_template_kwargs": {"enable_thinking": False}}
    req = urllib.request.Request(f"http://127.0.0.1:{port}/v1/chat/completions", data=json.dumps(corps).encode(),
                                 headers={"Content-Type": "application/json"})
    for essai in range(3):
        try:
            with urllib.request.urlopen(req, timeout=1800) as r:
                rep = json.loads(r.read())
            c = rep["choices"][0]
            return {"id": q["id"], "texte": c["message"].get("content") or "", "fin": c.get("finish_reason"),
                    "usage": rep.get("usage", {})}
        except Exception as e:
            err = repr(e)
            time.sleep(5)
    return {"id": q["id"], "texte": "", "erreur": err}


questions = [json.loads(l) for chemin in glob.glob("/kaggle/input/**/bancs.jsonl", recursive=True) for l in open(chemin)]
print(f"{len(questions)} questions", flush=True)


def passer(nom):
    port = MODELES[nom][2]
    t = time.time()
    with cf.ThreadPoolExecutor(PARALLELE) as ex, open(os.path.join(TRAVAIL, f"reponses-{nom}.jsonl"), "w") as s:
        for i, r in enumerate(ex.map(lambda q: appeler(port, q), questions)):
            s.write(json.dumps(r, ensure_ascii=False) + "\n")
            if i % 500 == 0:
                print(f"{nom} {i}/{len(questions)} {time.time() - t:.0f} s", flush=True)
    print(f"{nom} terminé en {time.time() - t:.0f} s", flush=True)


with cf.ThreadPoolExecutor(len(MODELES)) as ex:
    list(ex.map(passer, MODELES))
for p in procs:
    p.terminate()
