// Exécute le code Python de dessin (matplotlib, schemdraw) écrit par le modèle, dans Pyodide, et
// renvoie les figures en PNG. Page chargée dans une fenêtre cachée sans accès au réseau ni aux
// fichiers de l'utilisateur (python-figures.cjs) ; le processus principal coupe tout calcul trop long.
import { loadPyodide } from './vendor/pyodide/pyodide.mjs';

const VENDOR = new URL('./vendor/pyodide/', import.meta.url).href;
let ready = null;

// Programme qui entoure le code du modèle : moteur Agg (pas d'écran), plt.show() sans effet, puis
// chaque dessin schemdraw et chaque figure matplotlib enregistrés en PNG.
const RUNNER = `
import base64, io, sys, traceback
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.show = lambda *a, **k: None
def _localia_run(code):
    plt.close("all")
    out = io.StringIO()
    old = sys.stdout
    sys.stdout = out
    images, error = [], None
    ns = {"__name__": "__main__"}
    # Réponse coupée en plein code (boucle arrêtée, longueur maximale) : les dernières lignes
    # inachevées sont retirées, jusqu'à 20, tant que le code ne se compile pas.
    lines = code.rstrip().split("\\n")
    compiled = None
    for _ in range(21):
        try:
            compiled = compile("\\n".join(lines), "reponse.py", "exec")
            break
        except SyntaxError:
            if len(lines) <= 1:
                break
            lines = lines[:-1]
    try:
        if compiled is None:
            compile(code, "reponse.py", "exec")
        exec(compiled, ns)
    except BaseException:
        lines = traceback.format_exc().strip().splitlines()
        error = "\\n".join(lines[-6:])
    finally:
        sys.stdout = old
    # Dessin schemdraw pas encore tracé (sans « with ») : tracé ici ; il devient une figure matplotlib.
    try:
        import schemdraw
        for value in list(ns.values()):
            if isinstance(value, schemdraw.Drawing) and getattr(value, "fig", None) is None:
                value.draw(show=False)
    except Exception:
        pass
    for number in plt.get_fignums()[:6]:
        buf = io.BytesIO()
        plt.figure(number).savefig(buf, format="png", dpi=130, bbox_inches="tight", facecolor="white")
        images.append(base64.b64encode(buf.getvalue()).decode())
    plt.close("all")
    return {"images": images[:6], "error": error, "stdout": out.getvalue()[-2000:]}
`;

async function setup() {
  const pyodide = await loadPyodide({ indexURL: VENDOR, stdout: () => {}, stderr: () => {} });
  await pyodide.loadPackage(['numpy', 'matplotlib']);
  // schemdraw (pur Python) : roue embarquée, décompressée dans le système de fichiers de Pyodide.
  const wheel = await fetch(VENDOR + 'schemdraw-0.23-py3-none-any.whl').then((r) =>
    r.arrayBuffer(),
  );
  const sitePackages = pyodide.runPython('import site; site.getsitepackages()[0]');
  pyodide.unpackArchive(wheel, 'wheel', { extractDir: sitePackages });
  pyodide.runPython(RUNNER);
  return pyodide;
}

window.figures.onJob(async ({ id, code }) => {
  try {
    const pyodide = await ready;
    const result = pyodide.globals
      .get('_localia_run')(code)
      .toJs({ dict_converter: Object.fromEntries });
    window.figures.done({ id, images: result.images, error: result.error, stdout: result.stdout });
  } catch (error) {
    window.figures.done({ id, images: [], error: String(error?.message || error).slice(0, 2000) });
  }
});
// Python et matplotlib chargés dès l'ouverture : la fenêtre ne se dit prête qu'ensuite.
ready = setup();
ready.then(
  () => window.figures.ready(),
  (error) => window.figures.failed(String(error?.message || error)),
);
