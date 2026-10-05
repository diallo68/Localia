// Démarrage : réglages, historique et comparaisons, puis connexion à Ollama.
(async () => {
  settings = await window.localia.loadSettings().catch(() => settings);
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
  // Un fichier illisible pourrait référencer des documents : rien n'est effacé dans ce cas.
  if (historyReady && comparisonsReady)
    await window.localia
      .pruneDocuments(
        [...conversations, ...comparisons].flatMap((c) => [
          ...(c.document ? [c.document.id] : []),
          ...(c.files || []).map((f) => f.id),
        ]),
      )
      .catch(() => {});
  render();
  await refresh();
  // Données chiffrées sans clé : rien n'a été chargé ni ne sera enregistré ; on l'explique.
  const privacy = await window.localia.encryptionStatus().catch(() => null);
  if (privacy?.error) {
    notice(privacy.error);
    view('settings');
    await showPrivacy(privacy);
  }
})();
