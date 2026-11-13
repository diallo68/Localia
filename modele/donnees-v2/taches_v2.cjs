// Tâches de la phase B : pour chaque demande écrite par le professeur en phase A, les messages que le modèle
// recevra dans Localia. Le choix des pages (document entier ou extraits selon la question, contexte porté à
// 16 384 jetons) et leur présentation « [Page N, extrait k] » viennent du code de Localia (documentMessages de
// src/chat.cjs), pour que l'entraînement voie exactement ce que Localia envoie.
// Règle de provenance (provenance.md) : aucun texte écrit par Claude n'entre dans les exemples. Donc :
// - la consigne système est celle que le professeur a écrite en phase A (FR ou EN selon la demande), pas celle
//   de Localia ;
// - dans l'enveloppe du document, seules restent les étiquettes de structure (« SOURCE DOCUMENTAIRE — début »,
//   « Document : », « Couverture : extraits des pages … sur N », « [Page N, extrait k] ») ; les phrases de consigne
//   de Localia (« choisis selon la question… », « « Page N » = position… », repères de lecture) sont retirées.
// Calcul et incohérences (appliquer_calcul.py) : une demande peut avoir son propre document modifié
// (<pages_modif>/<fiche>#<i>.json) ; « pages_requises » doivent toutes être transmises par Localia.
// Usage : node taches_v2.cjs <phase_a.jsonl> <fiches.jsonl> <dossier_sources> <dossier_src_localia> <taches.jsonl> [pages_modif]
const fs = require('node:fs');
const path = require('node:path');

const [phaseA, fichesF, sources, src, sortie, pagesModif] = process.argv.slice(2);
const { documentMessages, contextSize, documentContextSize } = require(path.resolve(src, 'chat.cjs'));
const lire = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const fiches = Object.fromEntries(lire(fichesF).map((f) => [f.fiche, f]));

function nettoyer(texte) {
  return texte
    .replace(/, choisis selon la question ; le reste n’est pas transmis\. Réponds avec ces extraits et signale ce qui peut manquer/g, '')
    .replace(/^« Page N » = position[^\n]*\n/gm, '')
    .replace(/^Extraits choisis selon la question[^\n]*\n/gm, '')
    .replace(/^(REPÈRE DE LECTURE|READING NOTE)[^\n]*\n\n/gm, '')
    .replace(/ \n/g, '\n');
}

const lignes = [];
const bilan = { demandes: 0, taches: 0, rejets: {} };
const rejet = (k) => (bilan.rejets[k] = (bilan.rejets[k] || 0) + 1);
for (const a of lire(phaseA)) {
  const fiche = fiches[a.fiche];
  const r = a.resultat;
  if (!fiche || !r || !Array.isArray(r.demandes)) {
    rejet('phase A sans résultat');
    continue;
  }
  const original = JSON.parse(fs.readFileSync(path.join(sources, 'pages', a.fiche + '.json'), 'utf8'));
  r.demandes.forEach((d, i) => {
    const modif = pagesModif && path.join(pagesModif, `${a.fiche}#${i}.json`);
    const lu = modif && fs.existsSync(modif) ? JSON.parse(fs.readFileSync(modif, 'utf8')) : original;
    const doc = { name: original.name, pages: lu.pages, emptyPages: [], type: 'pdf' };
    const characters = doc.pages.reduce((n, p) => n + p.text.length, 0);
    const numCtx = documentContextSize(contextSize({}, null, true), undefined, characters);
    bilan.demandes++;
    const lang = d.langue === 'en' ? 'en' : 'fr';
    const systeme = lang === 'en' ? r.consigne_systeme_en : r.consigne_systeme_fr;
    if (typeof d.demande !== 'string' || d.demande.trim().length < 2) return rejet('demande vide');
    if (typeof systeme !== 'string' || systeme.length < 40 || /json/i.test(systeme)) return rejet('consigne système absente ou JSON');
    if (/json/i.test(d.demande)) return rejet('demande qui parle de JSON');
    const summary = /\b(r[ée]sum|synth[eè]s|summar)/i.test(d.demande);
    const m = documentMessages(doc, [{ role: 'user', content: d.demande.trim() }], '', { numCtx, lang, summary });
    const messages = m.messages.map((x, k) =>
      k === 0 ? { role: 'system', content: systeme.trim() } : x.content.startsWith('SOURCE DOCUMENTAIRE') ? { role: 'user', content: nettoyer(x.content) } : x,
    );
    const page = Number(String(d.page ?? '').replace(/[^0-9]/g, '') || NaN);
    const pageTransmise = Number.isFinite(page) && page > 0 ? m.pages.includes(page) : null;
    if (Array.isArray(d.pages_requises) && !d.pages_requises.every((p) => m.pages.includes(Number(p))))
      return rejet('page nécessaire non transmise');
    // 13 nov. : indication vue par le professeur seul en phase B (ajoutée à sa consigne système, jamais à l'exemple) :
    // pages des nombres et résultat attendu (calcul), emplacement de l'incohérence insérée (alteree). Tout est tiré
    // des données vérifiées par programme.
    const v = d;
    let indice = null;
    if (d.type === 'calcul' && Array.isArray(v.operandes)) {
      const ops = v.operandes.map((o) => `${o.texte} (p. ${o.page})`).join(', ');
      indice = lang === 'en'
        ? `Writing note (not to be mentioned): numbers to use: ${ops}. Expected final result: ${v.resultat} ${v.unite || ''}. Write each calculation in full on its own line, in the form "a + b = c", with the page of each number.`
        : `Indication de rédaction (à ne pas mentionner) : nombres à utiliser : ${ops}. Résultat final attendu : ${v.resultat} ${v.unite || ''}. Pose chaque calcul en entier sur sa ligne, sous la forme « a + b = c », avec la page de chaque nombre.`;
    } else if (d.type === 'alteree') {
      indice = lang === 'en'
        ? `Writing note (not to be mentioned): the document gives two different values for the same fact: ${v.valeur} on page ${v.page} and ${v.nouveau} on page ${v.page_insertion}. Point this out with both pages, without deciding which one is right unless the document allows it, then answer the request.`
        : `Indication de rédaction (à ne pas mentionner) : le document donne deux valeurs différentes pour le même fait : ${v.valeur} page ${v.page} et ${v.nouveau} page ${v.page_insertion}. Signale-le avec les deux pages, sans trancher sauf si le document le permet, puis réponds à la demande.`;
    }
    lignes.push(
      JSON.stringify({
        id: `${a.fiche}#${i}`,
        fiche: a.fiche,
        domaine: fiche.domaine,
        type: d.type,
        langue: lang,
        num_ctx: numCtx,
        partiel: m.partial,
        pages: m.pages,
        page_transmise: pageTransmise,
        verif: { ...Object.fromEntries(Object.entries(d).filter(([k]) => !['demande', 'type', 'langue'].includes(k))), ...(Number.isFinite(page) ? { page } : {}) },
        ...(indice ? { indice } : {}),
        reflexion: false, // essai du 12 nov. : sans réflexion, autant d’exemples gardés (21/40 contre 17/41) et 4 fois plus rapide
        messages,
      }),
    );
    bilan.taches++;
  });
}
fs.writeFileSync(sortie, lignes.join('\n') + '\n');
console.log(JSON.stringify(bilan));
