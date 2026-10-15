// Onglet « Fichiers » : le modèle propose un plan d'actions sur un dossier autorisé, Localia le
// vérifie, l'utilisateur coche les actions à appliquer ; journal et annulation.
let fileFolders = [],
  folderEntries = [],
  plan = null, // { summary, rows: [{ raw, selected }] , model, instruction }
  planning = false;

const selectedFolder = () => fileFolders.find((f) => f.id === $('files-folder').value) || null;

async function loadFileFolders() {
  fileFolders = await window.localia.filesFolders();
  const box = $('files-folders');
  box.replaceChildren();
  if (!fileFolders.length)
    box.append(element('p', 'muted', 'Aucun dossier autorisé. Localia ne touche à aucun fichier.'));
  for (const folder of fileFolders) {
    const row = element('div', 'folder-row');
    row.append(element('strong', '', folder.name), element('small', 'muted', folder.path));
    const open = element('button', '', localText('Ouvrir dans le Finder'));
    open.type = 'button';
    open.onclick = guard(() => window.localia.filesReveal(folder.id));
    const remove = element('button', '', 'Retirer l’autorisation');
    remove.type = 'button';
    remove.onclick = guard(async () => {
      await window.localia.filesRemoveFolder(folder.id);
      discardPlan();
      await loadFileFolders();
    });
    row.append(open, remove);
    box.append(row);
  }
  const select = $('files-folder');
  const previous = select.value;
  select.replaceChildren(...fileFolders.map((f) => new Option(f.name, f.id)));
  if (fileFolders.some((f) => f.id === previous)) select.value = previous;
  $('files-form').hidden = !fileFolders.length;
  if (fileFolders.length) await loadFolderListing();
}

async function loadFolderListing() {
  const folder = selectedFolder();
  if (!folder) return;
  const { entries, truncated } = await window.localia.filesList(folder.id);
  folderEntries = entries;
  const fileCount = entries.filter((e) => e.type === 'file').length;
  $('files-listing').querySelector('summary').textContent =
    `${fileCount} fichier(s), ${entries.length - fileCount} dossier(s)${truncated ? ' (dossier très grand : contenu incomplet)' : ''} — liste transmise au modèle`;
  $('files-listing').querySelector('pre').textContent = entries.length
    ? formatListing(entries)
    : '(dossier vide)';
}

function fillFileModels() {
  const select = $('files-model');
  const previous = select.value;
  select.replaceChildren(...models.map((m) => new Option(m.name, m.name)));
  const advice = taskAdvice('fichiers');
  const best = advice?.best?.model;
  if (models.some((m) => m.name === previous)) select.value = previous;
  else if (best && installed(best)) select.value = best;
  else if (installed(settings.lastModel)) select.value = settings.lastModel;
  const box = $('files-advice');
  box.hidden = false;
  box.textContent = advice?.best
    ? `Conseillé par votre Benchmark : ${advice.best.model} (${percentText(advice.best.correct)} de plans corrects, ${advice.best.n} réponses notées${advice.reliable ? '' : ', conseil indicatif'}).`
    : 'Votre Benchmark ne contient pas encore de série « Actions sur fichiers » notée : la fiabilité des modèles pour cette tâche n’est pas mesurée (fichier benchmark/serie-actions.txt).';
}
modelListeners.push(fillFileModels);

$('files-tab').onclick = guard(async () => {
  view('files');
  fillFileModels();
  await Promise.all([loadFileFolders(), renderJournal()]);
});
$('files-add').onclick = guard(async () => {
  const folder = await window.localia.filesAddFolder();
  if (!folder) return;
  await loadFileFolders();
  $('files-folder').value = folder.id;
  await loadFolderListing();
});
$('files-folder').onchange = guard(async () => {
  discardPlan();
  await loadFolderListing();
});

function setPlanning(value) {
  planning = value;
  $('files-propose').disabled = value;
  $('files-stop').hidden = !value;
}
$('files-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  const folder = selectedFolder();
  const instruction = $('files-instruction').value.trim();
  if (!folder || !instruction || planning) return;
  if (!$('files-model').value) throw new Error('Aucun modèle installé.');
  discardPlan();
  await loadFolderListing();
  setPlanning(true);
  $('files-status').textContent = 'Le modèle prépare un plan…';
  let result;
  await yieldRoutine();
  try {
    result = await window.localia.run('files', {
      model: $('files-model').value,
      folderId: folder.id,
      instruction,
    });
  } finally {
    setPlanning(false);
    pumpRoutines();
  }
  if (result.cancelled) {
    $('files-status').textContent = 'Arrêté.';
    return;
  }
  $('files-status').textContent = '';
  let parsed = null;
  try {
    parsed = parsePlan(result.text);
  } catch (error) {
    $('files-status').textContent = error.message;
  }
  plan = {
    model: $('files-model').value,
    instruction,
    text: result.text,
    summary: parsed?.summary || '',
    rows: (parsed?.actions || []).map((raw) => ({ raw, selected: true })),
    readable: Boolean(parsed),
  };
  renderPlan();
});
$('files-stop').onclick = guard(() => window.localia.cancel('files'));
window.localia.onProgress(({ kind, data }) => {
  if (kind === 'files' && planning && data.message?.content)
    $('files-status').textContent = 'Le modèle rédige le plan…';
});

// Le plan est revérifié à chaque case cochée : une action peut dépendre d'une action décochée.
function renderPlan() {
  $('files-plan').hidden = !plan;
  if (!plan) return;
  const summary = $('files-summary');
  if (!plan.readable) {
    summary.replaceChildren(
      element('strong', '', 'Aucun plan lisible dans la réponse du modèle. Sa réponse : '),
    );
    const body = element('div', 'markdown');
    showMarkdown(body, plan.text);
    summary.append(body);
  } else
    summary.textContent =
      plan.summary || (plan.rows.length ? '' : 'Le modèle ne propose aucune action.');
  const selected = plan.rows.filter((r) => r.selected);
  const checked = validatePlan(
    selected.map((r) => r.raw),
    folderEntries,
  );
  const status = new Map(selected.map((r, i) => [r, checked[i]]));
  // Une action décochée est tout de même vérifiée seule, pour afficher ce qu'elle ferait.
  const rows = plan.rows.map((row) => {
    const check = status.get(row) || validatePlan([row.raw], folderEntries)[0];
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = row.selected;
    box.setAttribute('aria-label', describeAction(check.action));
    box.onchange = () => {
      row.selected = box.checked;
      renderPlan();
    };
    return [
      box,
      describeAction(check.action),
      check.action.reason || '',
      !row.selected
        ? { text: 'non retenue', className: 'muted' }
        : check.ok
          ? { text: '✓ possible', className: 'verdict-ok' }
          : { text: `✗ ${check.error}`, className: 'verdict-warn' },
    ];
  });
  $('files-actions').replaceChildren(
    rows.length
      ? scrollable(table(['', 'Action', 'Raison donnée par le modèle', 'Vérification'], rows))
      : '',
  );
  const invalid = selected.filter((r) => !status.get(r).ok).length;
  const apply = $('files-apply');
  apply.disabled = !selected.length || invalid > 0;
  apply.textContent = invalid
    ? `Décochez les actions impossibles (${invalid})`
    : `Appliquer ${selected.length} action(s)`;
}
function discardPlan() {
  plan = null;
  renderPlan();
}
$('files-discard').onclick = discardPlan;
$('files-apply').onclick = guard(async () => {
  const folder = selectedFolder();
  if (!plan || !folder) return;
  const actions = plan.rows.filter((r) => r.selected).map((r) => r.raw);
  const trashed = validatePlan(actions, folderEntries).filter((c) => c.action.type === 'trash');
  if (
    trashed.length &&
    !confirm(
      localText(
        `${trashed.length} élément(s) iront à la Corbeille (récupérables depuis le Finder). Continuer ?`,
      ),
    )
  )
    return;
  $('files-apply').disabled = true;
  const batch = await window.localia.filesApply({
    folderId: folder.id,
    actions,
    instruction: plan.instruction,
    model: plan.model,
    proposed: plan.rows.length,
  });
  const done = batch.results.filter((r) => r.done).length;
  const failed = batch.results.find((r) => r.error);
  notice(
    failed
      ? `${done} action(s) faite(s) sur ${batch.results.length}. Arrêt : ${describeAction(failed)} — ${failed.error}.`
      : '',
  );
  $('files-status').textContent =
    `${done} action(s) appliquée(s). Vous pouvez les annuler depuis le journal.`;
  discardPlan();
  await Promise.all([loadFolderListing(), renderJournal()]);
});

async function renderJournal() {
  const journal = await window.localia.filesJournal();
  const box = $('files-journal');
  box.replaceChildren();
  if (!journal.length) box.append(element('p', 'muted', 'Aucune action appliquée pour le moment.'));
  for (const batch of journal.slice(0, 30)) {
    const done = batch.results.filter((r) => r.done).length;
    const undone = batch.results.filter((r) => r.undone).length;
    const card = element('details', 'journal-card');
    card.append(
      element(
        'summary',
        '',
        `${new Date(batch.at).toLocaleString('fr-FR')} · ${batch.folder} · ${done} action(s) faite(s)${undone ? `, ${undone} annulée(s)` : ''} · ${batch.model || ''}`,
      ),
    );
    card.append(element('p', '', `Demande : ${batch.instruction}`));
    const list = element('ul', '');
    for (const r of batch.results) {
      const state = r.undone ? '↶ annulée' : r.done ? '✓ faite' : `✗ ${r.error || 'non faite'}`;
      list.append(
        element(
          'li',
          '',
          `${describeAction(r)} — ${state}${r.undoError ? ` (annulation impossible : ${r.undoError})` : ''}`,
        ),
      );
    }
    card.append(list);
    const undoable = batch.results.some((r) => r.done && !r.undone && r.type !== 'trash');
    if (undoable) {
      const undo = element('button', '', 'Annuler cette opération');
      undo.type = 'button';
      undo.onclick = guard(async () => {
        const result = await window.localia.filesUndo(batch.id);
        const problems = result.results.filter((r) => r.undoError);
        notice(
          problems.length
            ? `Annulation partielle : ${problems.map((r) => `${describeAction(r)} (${r.undoError})`).join(' ; ')}.`
            : '',
        );
        await Promise.all([loadFolderListing(), renderJournal()]);
      });
      card.append(undo);
    }
    box.append(card);
  }
}
