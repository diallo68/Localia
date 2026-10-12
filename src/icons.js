// Icônes au trait, dessinées pour Localia (grille de 24, couleur du texte). Un élément
// <i data-icon="nom"></i> est remplacé par l'icône ; aucune ressource extérieure.
const ICONS = {
  message: '<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.1A8.5 8.5 0 1 1 21 12z"/>',
  compare: '<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/>',
  chart: '<path d="M5 20V11M10 20V4M15 20v-8M20 20v-5"/>',
  library:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9.5h18M3 15h18M9.5 3v18"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  monitor:
    '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4M6 13l3-3 3 2.5 2.5-3L18 13"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'file-plus':
    '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 11v6M9 14h6"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  paperclip:
    '<path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.6 8.6a2 2 0 0 1-2.8-2.8l7.9-7.9"/>',
  send: '<path d="M21 3 10 14M21 3l-6.5 18-4.5-7-7-4.5z"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  cube: '<path d="M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5zM3.5 7.25 12 12l8.5-4.75M12 12v9.5"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9.5 2.5v3.5M14.5 2.5v3.5M9.5 18v3.5M14.5 18v3.5M2.5 9.5H6M2.5 14.5H6M18 9.5h3.5M18 14.5h3.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
  camera:
    '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  graduation: '<path d="M2 8l10-5 10 5-10 5zM6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5M22 8v6"/>',
  health:
    '<path d="M12 21s-7-4.5-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 6C19 16.5 12 21 12 21zM8 12h2.5l1.5-3 2 6 1.5-3H17"/>',
  law: '<path d="M12 3v18M7 21h10M4 7h16M6 7l-3 6a3 3 0 0 0 6 0zM18 7l-3 6a3 3 0 0 0 6 0z"/>',
  card: '<rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="M2.5 10h19M6.5 15h4"/>',
  shop: '<path d="M4 9l1.5-5h13L20 9M4 9h16v2a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0A2.7 2.7 0 0 1 4 11zM5.5 13.5V20h13v-6.5M10 20v-4h4v4"/>',
  news: '<path d="M4 5h13a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2zM19 9h1.5a1 1 0 0 1 1 1v8a1 1 0 0 1-2 0M8 9h7M8 13h7M8 16h4"/>',
  question:
    '<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.1A8.5 8.5 0 1 1 21 12z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 16.5h.01"/>',
};

function iconSvg(name) {
  return (
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    (ICONS[name] || '') +
    '</svg>'
  );
}

function placeIcons(root = document) {
  for (const element of root.querySelectorAll('i[data-icon]')) {
    const holder = document.createElement('span');
    holder.innerHTML = iconSvg(element.dataset.icon);
    element.replaceWith(holder.firstChild);
  }
}
placeIcons();
