// Onglet « Performances de votre ordinateur » : matériel, verdict par modèle, vitesse mesurée.
const gb = (n) => (n == null ? '—' : `${String(Math.round(n * 10) / 10).replace('.', ',')} Go`);
let pcInfo = null;

function infoCard(title, lines) {
  const card = element('article', 'pc-card');
  card.append(element('strong', '', title));
  for (const line of lines.filter(Boolean)) card.append(element('p', '', line));
  return card;
}

async function renderPerformance() {
  $('pc-status').textContent = 'Analyse de l’ordinateur…';
  pcInfo = await window.localia.pcScan();
  const hw = pcInfo;
  const accel = acceleration(hw);
  $('pc-status').textContent = '';

  const cards = $('pc-cards');
  cards.replaceChildren(
    infoCard('Processeur', [
      hw.cpu,
      `${hw.physicalCores ?? '?'} cœurs physiques, ${hw.logicalCores} logiques · ${hw.arch === 'arm64' ? 'ARM (Apple Silicon)' : hw.arch}`,
    ]),
    infoCard('Mémoire vive', [
      `${hw.memoryGB} Go au total`,
      `${gb(hw.freeMemoryGB)} libres en ce moment`,
    ]),
    infoCard(
      'Carte(s) graphique(s)',
      hw.gpus.length
        ? hw.gpus.map(
            (g) =>
              `${g.name}${g.vramGB ? ` · ${gb(g.vramGB)}${g.shared ? ' partagés' : ''}` : ''}${g.cores ? ` · ${g.cores} cœurs` : ''}`,
          )
        : ['Non détectée'],
    ),
    infoCard('Accélération des modèles', [accel.label]),
    infoCard('Disque', [`${gb(hw.freeDiskGB)} libres`]),
    infoCard('Système et Ollama', [
      hw.os,
      hw.ollama
        ? `Ollama actif · ${hw.models.length} modèle(s)`
        : 'Ollama arrêté ou absent (voir le Guide de démarrage)',
      hw.loaded.length
        ? `En mémoire maintenant : ${hw.loaded.map((m) => m.name).join(', ')}`
        : null,
    ]),
  );

  // Conseil général : modèle de départ et vitesse à attendre.
  const { best } = recommendStarter(hw.memoryGB);
  const speeds = benchmarkSpeeds(typeof comparisons === 'undefined' ? [] : comparisons);
  const measured = { ...speeds };
  for (const [name, m] of Object.entries(hw.measured || {}))
    if (m.tokensPerSecond) measured[name] = { tokensPerSecond: m.tokensPerSecond, test: true };
  $('pc-advice').textContent = localText(
    `Pour ce Mac (${hw.memoryGB} Go, ${accel.kind === 'cpu' ? 'calcul sur le processeur' : 'accélération graphique'}), le modèle idéal pour commencer est ${best.label} (${gb(best.sizeGB)}). ` +
      (accel.kind === 'cpu'
        ? 'Sans accélération graphique, un modèle plus petit répond plus vite mais se trompe plus souvent ; le Benchmark vous dira lequel est le meilleur compromis pour vos tâches.'
        : 'Les modèles qui tiennent dans la mémoire graphique répondent nettement plus vite.'),
  );

  // Modèles installés : verdict et vitesse (test rapide, sinon médiane du Benchmark).
  const rows = hw.models.map((m) => {
    const verdict = assessModel(m.size, hw);
    const speed = measured[m.name];
    const measureButton = element(
      'button',
      '',
      speed?.test ? 'Mesurer à nouveau' : 'Mesurer (1 min)',
    );
    measureButton.type = 'button';
    measureButton.disabled = !hw.ollama;
    measureButton.onclick = guard(async () => {
      measureButton.disabled = true;
      measureButton.textContent = 'Mesure…';
      try {
        await window.localia.pcMeasure(m.name);
      } finally {
        await renderPerformance();
      }
    });
    return [
      m.name,
      gb(m.size / 1e9),
      { text: verdict.label, className: `verdict-${verdict.level}`, title: verdict.detail },
      speed
        ? `${speedLabel(speed.tokensPerSecond)}${speed.test ? ' (test rapide)' : ` (Benchmark, ${speed.answers} réponses)`}`
        : 'non mesurée',
      measureButton,
    ];
  });
  $('pc-models').replaceChildren(
    rows.length
      ? scrollable(table(['Modèle installé', 'Taille', 'Verdict', 'Vitesse de réponse', ''], rows))
      : element('p', 'muted', 'Aucun modèle installé.'),
  );

  // Modèles conseillés pas encore installés.
  const installedNames = new Set(hw.models.map((m) => m.name));
  const suggestions = STARTER_MODELS.filter((m) => !installedNames.has(m.name)).map((m) => {
    const verdict = assessModel(m.sizeGB * 1e9, hw);
    const button = element('button', m.name === best.name ? 'primary' : '', 'Télécharger');
    button.type = 'button';
    button.disabled = !hw.ollama || verdict.level === 'trop-gros' || !enoughDisk(m, hw.freeDiskGB);
    button.onclick = guard(async () => {
      view('models');
      await download(m.name);
    });
    return [
      `${m.label}${m.name === best.name ? ' — conseillé' : ''}`,
      gb(m.sizeGB),
      { text: verdict.label, className: `verdict-${verdict.level}`, title: verdict.detail },
      m.note,
      button,
    ];
  });
  $('pc-suggestions').replaceChildren(
    suggestions.length
      ? scrollable(table(['Modèle', 'Taille', 'Verdict', 'Pourquoi', ''], suggestions))
      : element('p', 'muted', 'Les modèles conseillés sont déjà installés.'),
  );
}

$('performance-tab').onclick = guard(async () => {
  view('performance');
  await renderPerformance();
});
$('pc-rescan').onclick = guard(renderPerformance);
