// Repères de lecture ajoutés à la consigne quand les extraits envoyés au modèle en ont besoin.
// « % BR » des contrats santé : le 9 novembre 2026, avec une notice de mutuelle, qwen3:8b a lu
// « Analyses + 100 % BR » comme 100 % du prix d'une analyse hors nomenclature (76 € remboursés
// au lieu de 0 €). Le repère n'est ajouté que si les extraits contiennent une garantie en % BR.
const BR_RE = /\d\s*%\s*(?:de\s+la\s+)?BR\b/;

const BR_NOTE = {
  fr:
    'REPÈRE DE LECTURE (contrat santé), ajouté par Localia : ce n’est pas un extrait des documents, ne le cite pas comme source. « X % BR » signifie X % de la base de remboursement (BR), ' +
    'c’est-à-dire du tarif de la Sécurité sociale, et non X % du prix payé. Un acte non remboursé ' +
    'par la Sécurité sociale (hors nomenclature, HN) n’a pas de base de remboursement : une garantie ' +
    'en % BR ne verse rien pour lui ; seul un forfait en euros prévu pour cet acte peut le couvrir. ' +
    'Vérifie aussi les exclusions du contrat.',
  en:
    'READING NOTE (French health insurance contract), added by Localia: it is not an extract of the documents, do not cite it as a source. “X % BR” means X % of the reimbursement base ' +
    '(BR), the French Social Security tariff, not X % of the price paid. A procedure not reimbursed ' +
    'by Social Security (hors nomenclature, HN) has no reimbursement base: a guarantee in % BR pays ' +
    'nothing for it; only a fixed amount in euros provided for that procedure can cover it. Also ' +
    'check the exclusions of the contract.',
};

// Repères pour ce texte d'extraits (chaîne vide s'il n'en faut aucun), suivis d'une ligne vide.
function documentNotes(text, lang = 'fr') {
  if (!BR_RE.test(String(text || ''))) return '';
  return (lang === 'en' ? BR_NOTE.en : BR_NOTE.fr) + '\n\n';
}

if (typeof module !== 'undefined') module.exports = { documentNotes };
