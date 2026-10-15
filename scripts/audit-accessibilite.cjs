// Audit d'accessibilité automatique, dans l'application réelle (profil de démonstration vide) :
// - noms accessibles des commandes (boutons, champs, liens) ;
// - contraste des textes visibles (WCAG 2.2 : 4,5:1, ou 3:1 pour les grands textes) ;
// - clavier : chaque commande de la colonne atteinte par Tab, focus visible et non masqué ;
// - fenêtre étroite (900 px) et texte agrandi (« très grand », 130 %) : pas de défilement
//   horizontal de la page ;
// - cibles des commandes : 24 × 24 px au moins (WCAG 2.2, 2.5.8), espacement non vérifié.
// En thèmes clair et sombre, avec et sans contraste renforcé. Ce contrôle automatique ne remplace
// pas un essai avec un lecteur d'écran ni avec des personnes concernées.
//
// node scripts/audit-accessibilite.cjs [--json=fichier]
const { _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const VIEWS = [
  'home',
  'search',
  'projects',
  'chat',
  'routines',
  'compare',
  'models',
  'bibliography',
  'files',
  'skills',
  'performance',
  'settings',
  'security',
  'guide',
];
const option = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) || null;

// Contrôles exécutés dans la page.
function pageChecks() {
  const parse = (color) => {
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const c = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const blend = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
  });
  // Fond effectif : couleurs de fond des ancêtres superposées (images de fond ignorées).
  const background = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a === 1) break;
    }
    let color = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers.reverse()) color = blend(layer, color);
    return color;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      s.visibility !== 'hidden' &&
      s.display !== 'none' &&
      Number(s.opacity) > 0.1 &&
      !el.closest('[hidden], [aria-hidden="true"], details:not([open]) > :not(summary)')
    );
  };
  const describe = (el) =>
    `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} « ${(el.textContent || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 40)} »`;

  const contrast = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const el = node.parentElement;
    if (!node.nodeValue.trim() || !el || seen.has(el) || !visible(el)) continue;
    if (el.closest('svg, option, script, style')) continue;
    seen.add(el);
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    if (!fg) continue;
    const bg = background(el);
    const text = blend(fg, bg);
    const [l1, l2] = [lum(text), lum(bg)].sort((a, b) => b - a);
    const ratio = (l1 + 0.05) / (l2 + 0.05);
    const size = parseFloat(s.fontSize);
    const bold = Number(s.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    // Commandes désactivées : exemptées par WCAG (1.4.3).
    if (el.closest('button:disabled, input:disabled, select:disabled, [aria-disabled="true"]'))
      continue;
    if (ratio < (large ? 3 : 4.5))
      contrast.push({ element: describe(el), ratio: Math.round(ratio * 100) / 100 });
  }

  const names = [];
  const targets = [];
  for (const el of document.querySelectorAll('button, input, select, textarea, a[href], summary')) {
    if (!visible(el) || el.type === 'hidden') continue;
    const labelled =
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-labelledby') ||
      el.getAttribute('title') ||
      (el.labels && el.labels.length) ||
      (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SUMMARY'
        ? el.textContent.trim()
        : '') ||
      (el.tagName === 'INPUT' && ['button', 'submit'].includes(el.type) && el.value);
    if (!labelled) names.push(describe(el));
    const r = el.getBoundingClientRect();
    // Exception WCAG 2.5.8 : cible dans une phrase (lien ou bouton-lien en ligne).
    const inline = getComputedStyle(el).display === 'inline';
    if (!inline && (r.width < 24 || r.height < 24) && el.type !== 'checkbox' && el.type !== 'radio')
      targets.push(`${describe(el)} (${Math.round(r.width)} × ${Math.round(r.height)})`);
  }
  const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const pages = [...document.querySelectorAll('.page, #chat-view, #models-view')].filter(
    (p) => !p.hidden && p.scrollWidth > p.clientWidth + 1,
  );
  // Éléments qui dépassent à droite de la page qui défile horizontalement.
  const culprits = pages.flatMap((p) => {
    const limit = p.getBoundingClientRect().right;
    return [...p.querySelectorAll('*')]
      .filter((e) => e.offsetParent && e.getBoundingClientRect().right > limit + 1)
      .slice(0, 3)
      .map(describe);
  });
  return {
    contrast,
    names,
    targets,
    overflow: overflow || pages.length > 0,
    overflowing: [...pages.map((p) => p.id), ...culprits],
  };
}

// Tab depuis le début : commandes atteintes, focus visible (contour ou ombre) et non masqué.
async function keyboard(page) {
  await page.evaluate(() => document.activeElement?.blur());
  const reached = [];
  const problems = [];
  for (let i = 0; i < 160; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      const shadow = s.boxShadow && s.boxShadow !== 'none';
      const r = el.getBoundingClientRect();
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
      const top = document.elementFromPoint(cx, cy);
      const obscured = !(top && (el === top || el.contains(top) || top.contains(el)));
      return {
        id: el.id || el.textContent.trim().slice(0, 30),
        visibleFocus: outline || shadow,
        obscured,
        inView: r.bottom > 0 && r.top < innerHeight,
      };
    });
    if (!info) continue;
    reached.push(info.id);
    if (!info.visibleFocus) problems.push(`focus peu visible : ${info.id}`);
    if (info.obscured && info.inView) problems.push(`focus masqué : ${info.id}`);
  }
  // Entrées de la colonne de gauche jamais atteintes au clavier.
  const nav = await page.evaluate(() =>
    [...document.querySelectorAll('aside .nav-section:not(.history-section) .nav')]
      .filter((b) => b.offsetParent)
      .map((b) => b.id),
  );
  for (const id of nav) if (!reached.includes(id)) problems.push(`non atteinte au clavier : ${id}`);
  return { reached, problems: [...new Set(problems)] };
}

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-audit-'));
  const report = { date: new Date().toISOString(), runs: [] };
  let app;
  try {
    await fs.writeFile(
      path.join(profile, 'settings.json'),
      JSON.stringify({ guideDone: true, mode: 'avance', metier: 'recherche' }),
    );
    // Données de démonstration : un projet avec note et prochaine étape, une conversation liée,
    // une routine et un résultat à relire (pages remplies, pas seulement leur état vide).
    const at = new Date().toISOString();
    await fs.writeFile(
      path.join(profile, 'projects.json'),
      JSON.stringify([
        {
          id: 'p1',
          name: 'Bilan de la boulangerie',
          description: 'Exemple fictif',
          nextStep: 'Vérifier les ventes de septembre',
          createdAt: at,
          notes: [
            {
              id: 'n1',
              title: 'Chiffre d’affaires',
              text: 'Ventes de septembre : 12 400 €.',
              createdAt: at,
              source: { kind: 'reponse', conversationId: 'c1', conversationTitle: 'Ventes', at },
            },
          ],
          documents: [],
        },
      ]),
    );
    await fs.writeFile(
      path.join(profile, 'conversations.json'),
      JSON.stringify([
        {
          id: 'c1',
          title: 'Ventes',
          projectId: 'p1',
          updatedAt: at,
          messages: [
            { role: 'user', content: 'Quelles ventes en septembre ? On retient 12 400 €.' },
            { role: 'assistant', content: 'Les ventes de septembre sont de **12 400 €**.' },
          ],
        },
      ]),
    );
    await fs.writeFile(
      path.join(profile, 'routines.json'),
      JSON.stringify({
        routines: [{ id: 'r1', trigger: 'document-ajoute', projectId: 'p1', enabled: true }],
        runs: [
          {
            id: 'x1',
            routineId: 'r1',
            projectId: 'p1',
            docName: 'ventes.pdf',
            state: 'a-relire',
            text: '- Ventes : 12 400 € [ventes.pdf — page 1].',
            createdAt: at,
            endedAt: at,
          },
        ],
      }),
    );
    app = await electron.launch({
      args: [path.resolve('.')],
      env: { ...process.env, LOCALIA_TEST_DATA: profile },
    });
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    await page.waitForFunction(() => typeof openSearch === 'function' && projectsLoaded);
    const window = await app.browserWindow(page);
    const setSize = (width, height) =>
      window.evaluate((w, [x, y]) => w.setContentSize(x, y), [width, height]);
    const configurations = [
      { name: 'clair', theme: 'light', contrast: false, size: 1, width: 1280 },
      { name: 'sombre', theme: 'dark', contrast: false, size: 1, width: 1280 },
      { name: 'contraste renforcé', theme: 'light', contrast: true, size: 1, width: 1280 },
      // Zoom de la page à 200 % (WCAG 1.4.4) : 1280 px de fenêtre = 640 px de mise en page.
      { name: 'zoom 200 %', theme: 'light', contrast: false, size: 1, width: 1280, zoom: 2 },
      {
        name: 'texte très grand, fenêtre étroite',
        theme: 'light',
        contrast: false,
        size: 1.3,
        width: 900,
      },
    ];
    for (const config of configurations) {
      await page.emulateMedia({ colorScheme: config.theme });
      await setSize(config.width, 820);
      // Réglages d'affichage de Localia : taille du texte et contraste renforcé (boutons réels).
      await page.evaluate(
        ({ contrast, size }) => {
          document.querySelector(`.text-size [data-text-size="${size}"]`).click();
          const toggle = document.querySelector('#contrast-toggle');
          if ((toggle.getAttribute('aria-pressed') === 'true') !== contrast) toggle.click();
        },
        { contrast: config.contrast, size: config.size },
      );
      await page.waitForTimeout(300);
      // Zoom imposé après le réglage de taille du texte (qui est lui-même un zoom).
      if (config.zoom)
        await window.evaluate((w, zoom) => w.webContents.setZoomFactor(zoom), config.zoom);
      for (const name of VIEWS) {
        await page.evaluate((n) => {
          if (n === 'compare') document.querySelector('#bench-nav').click();
          else if (n === 'search') openSearch('ventes');
          else document.querySelector(`#${n}-tab`).click();
          // Pages remplies : projet ouvert, conversation ouverte, résultat de routine ouvert.
          if (n === 'projects') document.querySelector('.project-row')?.click();
          if (n === 'chat') openConversation(conversations[0]);
          if (n === 'routines') document.querySelector('.run-row')?.click();
        }, name);
        await page.waitForTimeout(700); // fin des transitions de couleur
        const checks = await page.evaluate(pageChecks);
        const layoutWidth = await page.evaluate(() => innerWidth);
        report.runs.push({ configuration: config.name, view: name, layoutWidth, ...checks });
      }
    }
    await page.emulateMedia({ colorScheme: 'light' });
    await setSize(1280, 820);
    await page.evaluate(() => document.querySelector('#home-tab').click());
    report.keyboard = await keyboard(page);
  } finally {
    await app?.close();
    await fs.rm(profile, { recursive: true, force: true });
  }

  // Résumé lisible.
  console.log('Audit d’accessibilité automatique\n');
  for (const config of [...new Set(report.runs.map((r) => r.configuration))]) {
    const runs = report.runs.filter((r) => r.configuration === config);
    const contrast = runs.flatMap((r) =>
      r.contrast.map((c) => `${r.view} : ${c.element} (${c.ratio}:1)`),
    );
    const overflow = runs
      .filter((r) => r.overflow)
      .map((r) => `${r.view} (${r.overflowing.join(', ') || 'page'})`);
    console.log(
      `${config} (mise en page de ${runs[0].layoutWidth} px) : ${contrast.length} texte(s) sous le contraste minimal ; défilement horizontal : ${overflow.length ? overflow.join(', ') : 'aucun'}`,
    );
    for (const c of [...new Set(contrast)].slice(0, 25)) console.log('   - ' + c);
  }
  const names = [...new Set(report.runs.flatMap((r) => r.names.map((n) => `${r.view} : ${n}`)))];
  console.log(`\nCommandes sans nom accessible : ${names.length}`);
  for (const n of names.slice(0, 30)) console.log('   - ' + n);
  const targets = [
    ...new Set(
      report.runs
        .filter((r) => r.configuration === 'clair')
        .flatMap((r) => r.targets.map((t) => `${r.view} : ${t}`)),
    ),
  ];
  console.log(`\nCibles de moins de 24 × 24 px (thème clair) : ${targets.length}`);
  for (const t of targets.slice(0, 30)) console.log('   - ' + t);
  console.log(
    `\nClavier : ${report.keyboard.reached.length} arrêts de Tab depuis l’accueil ; problèmes : ${report.keyboard.problems.length ? report.keyboard.problems.join(' ; ') : 'aucun'}`,
  );
  const output = option('json');
  if (output) await fs.writeFile(output, JSON.stringify(report, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
