// Démarrage : réglages, historique et comparaisons, puis connexion à Ollama.
(async () => {
  settings = await window.localia.loadSettings().catch(() => settings);
  // Chaque ouverture commence en mode simple, sur le domaine principal du profil, sinon
  // « Général » ; le mode avancé et les autres domaines restent à un clic. Premier lancement
  // (aucun domaine encore choisi) : inchangé.
  const startMetier = settings.profile?.domains?.[0] || 'general';
  if (settings.metier && (settings.metier !== startMetier || isAdvanced() || settings.profil)) {
    const { profil, ...rest } = settings;
    settings = await window.localia
      .saveSettings({ ...rest, metier: startMetier, mode: 'simple' })
      .catch(() => ({ ...rest, metier: startMetier, mode: 'simple' }));
  }
  textSizeButtons();
  applyContrast();
  scheduleUpdateCheck().catch(() => {});
  try {
    const saved = await window.localia.load();
    if (
      !Array.isArray(saved) ||
      saved.some(
        (c) =>
          typeof c.title !== 'string' ||
          !Array.isArray(c.messages) ||
          c.messages.some(
            (m) => !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string',
          ),
      )
    )
      throw new Error('Historique incompatible. Le fichier est conservé.');
    conversations = saved;
    historyReady = true;
  } catch (error) {
    notice(error.message);
  }
  const comparisonsReady = await loadComparisons();
  await loadProjects();
  await loadRoutines();
  // Un fichier illisible pourrait référencer des documents : rien n'est effacé dans ce cas.
  if (historyReady && comparisonsReady && projectsLoaded)
    await window.localia
      .pruneDocuments([
        ...projects.flatMap((p) => p.documents.map((d) => d.id)),
        ...[...conversations, ...comparisons].flatMap((c) => [
          ...(c.documents || (c.document ? [c.document] : [])).map((d) => d.id),
          ...(c.questions || []).flatMap((q) => (q.doc ? [q.doc.id] : [])),
          ...(c.files || []).map((f) => f.id),
          ...(c.messages || []).flatMap((m) => (m.images || []).map((i) => i.id)),
        ]),
      ])
      .catch(() => {});
  applyMetier();
  applyMode();
  applyLanguage();
  langButtons();
  await refresh();
  pumpRoutines();
  restoreScheduledSeries();
  if (isAdvanced() && settings.metier) openHome();
  // Données chiffrées sans clé : rien n'a été chargé ni ne sera enregistré ; on l'explique.
  const privacy = await window.localia.encryptionStatus().catch(() => null);
  if (privacy?.error) {
    notice(privacy.error);
    view('security');
    await showPrivacy(privacy);
  } else if (!settings.metier && !settings.guideDone) openMetierView('first');
  else if (!settings.guideDone && !models.length) await openGuide().catch(() => {});
  // Carte « Pour commencer » de la Bibliothèque : modèle adapté à cet ordinateur.
  else window.localia.setupStatus().then(showStarterCard, () => {});
})();
