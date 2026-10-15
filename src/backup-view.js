// Sauvegarde chiffrée par phrase de passe, vérification et restauration guidée
// (Confidentialité et sécurité).
function backupPassphrase(confirm) {
  const passphrase = $('backup-passphrase').value;
  if (passphrase.length < 10)
    throw new Error('Phrase de passe trop courte : 10 caractères au moins.');
  if (confirm && passphrase !== $('backup-confirm').value)
    throw new Error('La confirmation ne correspond pas à la phrase de passe.');
  return passphrase;
}
const backupContent = (r) =>
  `${r.files} fichier(s) de données et ${r.documents} document(s), sauvegarde du ${new Date(r.createdAt).toLocaleString('fr-FR')}`;
async function backupAction(button, run) {
  const status = $('backup-status');
  for (const b of $('backup-form').querySelectorAll('button')) b.disabled = true;
  status.classList.remove('warn');
  try {
    await run(status);
  } catch (error) {
    status.textContent = error.message;
    status.classList.add('warn');
  } finally {
    for (const b of $('backup-form').querySelectorAll('button')) b.disabled = false;
  }
}
$('backup-create').onclick = () =>
  backupAction($('backup-create'), async (status) => {
    const passphrase = backupPassphrase(true);
    status.textContent = 'Sauvegarde en cours…';
    const result = await window.localia.backupCreate(passphrase);
    if (!result) return (status.textContent = '');
    status.textContent = `Sauvegarde enregistrée et relue : ${result.name} — ${backupContent(result)}. Gardez la phrase de passe à part : elle ne peut pas être retrouvée.`;
    $('backup-form').reset();
  });
$('backup-verify').onclick = () =>
  backupAction($('backup-verify'), async (status) => {
    const passphrase = backupPassphrase(false);
    status.textContent = 'Vérification…';
    const result = await window.localia.backupVerify(passphrase);
    status.textContent = result
      ? `Sauvegarde intacte, phrase de passe correcte : ${backupContent(result)}.`
      : '';
  });
$('backup-restore').onclick = () =>
  backupAction($('backup-restore'), async (status) => {
    const passphrase = backupPassphrase(false);
    if (chatting || comparing || routineRunning)
      throw new Error('Attendez la fin du traitement en cours avant de restaurer.');
    if (
      !confirm(
        'Remplacer toutes les données actuelles par celles de la sauvegarde ? Elles seront d’abord copiées dans un dossier « avant-restauration ». Localia se rechargera.',
      )
    )
      return;
    status.textContent = 'Restauration…';
    const result = await window.localia.backupRestore(passphrase);
    status.textContent = result
      ? `Restauration terminée : ${backupContent(result)}. Données précédentes gardées dans « ${result.kept} ». Rechargement…`
      : '';
  });
