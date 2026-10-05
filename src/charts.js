// Graphiques SVG du banc d'essai : barres (avec écart-type), nuage qualité / vitesse,
// répartition des temps et carte de chaleur. Une seule teinte : l'identité des modèles est donnée
// par les étiquettes directes, jamais par la couleur.
const SVG_NS = 'http://www.w3.org/2000/svg';
const CHART_COLORS = {
  bar: '#2a78d6',
  // Couleurs catégorielles (correcteurs), dans un ordre fixe validé pour les daltonismes.
  series: ['#2a78d6', '#eb6834', '#1baf7a'],
  barHover: '#1c5cab',
  label: '#52514e',
  value: '#0b0b0b',
  axis: '#c9d3cd',
  grid: '#e6ece8',
  surface: '#fcfcfb',
  // Rampe séquentielle bleue (du plus clair au plus foncé) pour la carte de chaleur.
  ramp: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
};
// Styles recopiés dans les SVG exportés, pour qu'ils s'affichent hors de l'application.
const SVG_STYLE = `
text { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }
.bar-fill, .dot { fill: ${CHART_COLORS.bar}; }
.dot { stroke: ${CHART_COLORS.surface}; stroke-width: 2; }
.bar-label, .axis-label, .tick { font-size: 11px; fill: ${CHART_COLORS.label}; }
.bar-value, .point-label { font-size: 11px; fill: ${CHART_COLORS.value}; }
.baseline, .axis { stroke: ${CHART_COLORS.axis}; stroke-width: 1; }
.grid { stroke: ${CHART_COLORS.grid}; stroke-width: 1; }
.whisker, .median { stroke: ${CHART_COLORS.value}; stroke-width: 1.5; }
.chart-title { font-size: 13px; font-weight: 600; fill: ${CHART_COLORS.value}; }`;

function svgNode(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
const fr = (value, digits = 1) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const percent = (value) =>
  value === null || value === undefined ? '—' : fr(value * 100, 0) + ' %';

function figure(title, note, svg) {
  const box = document.createElement('figure');
  box.className = 'chart';
  const caption = document.createElement('figcaption');
  caption.textContent = title;
  box.append(caption, svg);
  if (note) {
    const small = document.createElement('small');
    small.className = 'muted';
    small.textContent = note;
    box.append(small);
  }
  box.dataset.title = title;
  return box;
}
function newSvg(width, height, label) {
  const svg = svgNode('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': label,
  });
  svg.dataset.width = width;
  svg.dataset.height = height;
  return svg;
}
// Arrondi au bout de la barre seulement, carré sur la ligne de base.
function barPath(x0, y, width, height) {
  const r = Math.min(4, width / 2, height / 2);
  const x = x0 + width;
  return `M${x0} ${y} H${x - r} Q${x} ${y} ${x} ${y + r} V${y + height - r} Q${x} ${y + height} ${x - r} ${y + height} H${x0} Z`;
}

// Barres horizontales, une par modèle. rows : { label, value, sd?, text }.
function barChart({ title, note, rows, max }) {
  const width = 360;
  const rowHeight = 42;
  const barHeight = 14;
  const valueSpace = 96;
  const top = Math.max(max || 0, ...rows.map((r) => (r.value ?? 0) + (r.sd ?? 0))) || 1;
  const scale = (v) => ((width - valueSpace) * v) / top;
  const svg = newSvg(
    width,
    rows.length * rowHeight + 4,
    title +
      ' : ' +
      rows.map((r) => `${r.label} ${r.value === null ? 'sans donnée' : r.text}`).join(', '),
  );
  rows.forEach((row, i) => {
    const y = i * rowHeight;
    const group = svgNode('g', { class: 'bar' });
    group.append(
      svgNode('title', {}, `${row.label} : ${row.value === null ? 'sans donnée' : row.text}`),
    );
    group.append(svgNode('text', { x: 0, y: y + 12, class: 'bar-label' }, row.label));
    const barY = y + 16;
    if (row.value === null || row.value === undefined) {
      group.append(svgNode('text', { x: 0, y: barY + 11, class: 'bar-value' }, '—'));
    } else {
      const w = Math.max(2, scale(row.value));
      group.append(svgNode('path', { class: 'bar-fill', d: barPath(0, barY, w, barHeight) }));
      let end = w;
      if (row.sd) {
        // Écart-type : moustache centrée sur le bout de la barre.
        const lo = Math.max(0, scale(row.value - row.sd));
        const hi = scale(row.value + row.sd);
        const mid = barY + barHeight / 2;
        group.append(svgNode('line', { class: 'whisker', x1: lo, x2: hi, y1: mid, y2: mid }));
        for (const x of [lo, hi])
          group.append(
            svgNode('line', { class: 'whisker', x1: x, x2: x, y1: mid - 4, y2: mid + 4 }),
          );
        end = Math.max(end, hi);
      }
      group.append(svgNode('text', { x: end + 6, y: barY + 11, class: 'bar-value' }, row.text));
    }
    svg.append(group);
  });
  svg.append(
    svgNode('line', { x1: 0.5, x2: 0.5, y1: 14, y2: rows.length * rowHeight, class: 'baseline' }),
  );
  return figure(title, note, svg);
}

// Pas « rond » (1, 2, 2,5 ou 5 × 10^n) pour environ `count` graduations jusqu'à `max`.
function niceStep(max, count = 4) {
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= raw) * power;
  return step;
}
function ticks(max, count = 4) {
  const step = niceStep(max, count);
  const result = [];
  for (let t = 0; t <= max + step * 1e-9; t += step) result.push(Math.round(t / step) * step);
  return result;
}
// Borne d'axe arrondie au pas supérieur.
const niceMax = (max, count = 4) => Math.ceil(max / niceStep(max, count)) * niceStep(max, count);

// Nuage de points : un point par modèle, étiqueté directement.
// Barres groupées : un groupe par modèle, une barre par série (par exemple un correcteur).
// series : [{ name, values: [nombre | null, …] }] (3 séries au plus), labels : noms des groupes.
function groupedBarChart({ title, note, labels, series, max, format }) {
  const shown = series.slice(0, CHART_COLORS.series.length);
  const width = 360;
  const barHeight = 10;
  const gap = 2;
  const groupHeight = 16 + shown.length * (barHeight + gap) + 10;
  const valueSpace = 56;
  const top = max || Math.max(...shown.flatMap((s) => s.values.map((v) => v ?? 0)), 0) || 1;
  const svg = newSvg(
    width,
    labels.length * groupHeight + 4,
    title +
      ' : ' +
      labels
        .map(
          (label, i) =>
            label +
            ' (' +
            shown
              .map((s) => `${s.name} ${s.values[i] == null ? '—' : format(s.values[i])}`)
              .join(', ') +
            ')',
        )
        .join(' ; '),
  );
  labels.forEach((label, i) => {
    const y = i * groupHeight;
    svg.append(svgNode('text', { x: 0, y: y + 12, class: 'bar-label' }, label));
    shown.forEach((serie, k) => {
      const value = serie.values[i];
      const barY = y + 16 + k * (barHeight + gap);
      const group = svgNode('g');
      group.append(
        svgNode(
          'title',
          {},
          `${label} · ${serie.name} : ${value == null ? 'sans donnée' : format(value)}`,
        ),
      );
      if (value == null) {
        group.append(svgNode('text', { x: 0, y: barY + 9, class: 'bar-value' }, '—'));
      } else {
        const w = Math.max(2, ((width - valueSpace) * value) / top);
        group.append(
          svgNode('path', {
            d: barPath(0, barY, w, barHeight),
            fill: CHART_COLORS.series[k],
            class: 'series-' + k,
          }),
        );
        group.append(svgNode('text', { x: w + 5, y: barY + 9, class: 'bar-value' }, format(value)));
      }
      svg.append(group);
    });
  });
  svg.append(
    svgNode('line', {
      x1: 0.5,
      x2: 0.5,
      y1: 14,
      y2: labels.length * groupHeight,
      class: 'baseline',
    }),
  );
  const box = figure(title, note, svg);
  // Légende : la couleur n'est jamais le seul repère (valeurs écrites au bout des barres).
  const legend = document.createElement('div');
  legend.className = 'legend';
  shown.forEach((serie, k) => {
    const item = document.createElement('span');
    const swatch = document.createElement('i');
    swatch.style.background = CHART_COLORS.series[k];
    item.append(swatch, serie.name);
    legend.append(item);
  });
  box.querySelector('figcaption').after(legend);
  box.dataset.legend = JSON.stringify(
    shown.map((serie, k) => [serie.name, CHART_COLORS.series[k]]),
  );
  return box;
}

function scatterChart({ title, note, points, xLabel, yLabel, xFormat, yFormat, yMax = 1 }) {
  const width = 360;
  const height = 240;
  const m = { left: 44, right: 16, top: 12, bottom: 38 };
  const xMax = niceMax(Math.max(...points.map((p) => p.x ?? 0), 0) * 1.1 || 1);
  const x = (v) => m.left + ((width - m.left - m.right) * v) / xMax;
  const y = (v) => height - m.bottom - ((height - m.top - m.bottom) * v) / yMax;
  const svg = newSvg(
    width,
    height,
    title + ' : ' + points.map((p) => `${p.label} (${xFormat(p.x)}, ${yFormat(p.y)})`).join(', '),
  );
  for (const t of ticks(yMax)) {
    svg.append(
      svgNode('line', { class: 'grid', x1: m.left, x2: width - m.right, y1: y(t), y2: y(t) }),
    );
    svg.append(
      svgNode(
        'text',
        { class: 'tick', x: m.left - 6, y: y(t) + 4, 'text-anchor': 'end' },
        yFormat(t),
      ),
    );
  }
  for (const t of ticks(xMax))
    svg.append(
      svgNode(
        'text',
        { class: 'tick', x: x(t), y: height - m.bottom + 14, 'text-anchor': 'middle' },
        xFormat(t),
      ),
    );
  svg.append(
    svgNode('line', { class: 'axis', x1: m.left, x2: width - m.right, y1: y(0), y2: y(0) }),
  );
  svg.append(
    svgNode(
      'text',
      { class: 'axis-label', x: (width + m.left) / 2, y: height - 4, 'text-anchor': 'middle' },
      xLabel,
    ),
  );
  svg.append(
    svgNode(
      'text',
      {
        class: 'axis-label',
        x: 10,
        y: (height - m.bottom) / 2,
        transform: `rotate(-90 10 ${(height - m.bottom) / 2})`,
        'text-anchor': 'middle',
      },
      yLabel,
    ),
  );
  const placed = [];
  for (const p of points.filter((p) => p.x != null && p.y != null)) {
    const cx = x(p.x);
    const cy = y(p.y);
    const group = svgNode('g');
    group.append(svgNode('title', {}, `${p.label} : ${xFormat(p.x)}, ${yFormat(p.y)}`));
    group.append(svgNode('circle', { class: 'dot', cx, cy, r: 5 }));
    // Étiquette à droite du point, décalée si elle chevauche une étiquette déjà posée.
    let ly = cy + 4;
    while (placed.some((other) => Math.abs(other - ly) < 13)) ly += 13;
    placed.push(ly);
    const anchorEnd = cx > width * 0.6;
    group.append(
      svgNode(
        'text',
        {
          class: 'point-label',
          x: anchorEnd ? cx - 9 : cx + 9,
          y: ly,
          'text-anchor': anchorEnd ? 'end' : 'start',
        },
        p.label,
      ),
    );
    svg.append(group);
  }
  return figure(title, note, svg);
}

// Répartition des temps de réponse : un point par réponse, trait vertical à la médiane.
function stripChart({ title, note, rows, format }) {
  const width = 360;
  const rowHeight = 40;
  const top = 10;
  const max = niceMax(Math.max(...rows.flatMap((r) => r.values), 0) * 1.02 || 1);
  const x = (v) => (width - 20) * (v / max) + 4;
  const height = rows.length * rowHeight + top + 22;
  const svg = newSvg(
    width,
    height,
    title +
      ' : ' +
      rows.map((r) => `${r.label} médiane ${r.median == null ? '—' : format(r.median)}`).join(', '),
  );
  for (const t of ticks(max)) {
    svg.append(svgNode('line', { class: 'grid', x1: x(t), x2: x(t), y1: top, y2: height - 22 }));
    svg.append(
      svgNode(
        'text',
        { class: 'tick', x: x(t), y: height - 8, 'text-anchor': 'middle' },
        format(t),
      ),
    );
  }
  rows.forEach((row, i) => {
    const y = top + i * rowHeight;
    svg.append(svgNode('text', { class: 'bar-label', x: 4, y: y + 10 }, row.label));
    const cy = y + 24;
    for (const value of row.values) {
      const dot = svgNode('circle', { class: 'dot', cx: x(value), cy, r: 4, 'fill-opacity': 0.7 });
      dot.append(svgNode('title', {}, `${row.label} : ${format(value)}`));
      svg.append(dot);
    }
    if (row.median != null)
      svg.append(
        svgNode('line', {
          class: 'median',
          x1: x(row.median),
          x2: x(row.median),
          y1: cy - 9,
          y2: cy + 9,
        }),
      );
  });
  return figure(title, note, svg);
}

// Carte de chaleur : catégories en lignes, modèles en colonnes, valeur entre 0 et 1.
function heatmapTable({ title, note, rows, columns, cell, format }) {
  const box = document.createElement('figure');
  box.className = 'chart heatmap';
  const caption = document.createElement('figcaption');
  caption.textContent = title;
  const table = document.createElement('table');
  table.className = 'compare-table';
  const head = table.createTHead().insertRow();
  for (const text of ['', ...columns]) {
    const th = document.createElement('th');
    th.textContent = text;
    head.append(th);
  }
  const body = table.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    const th = document.createElement('th');
    th.textContent = row;
    tr.append(th);
    for (const column of columns) {
      const td = tr.insertCell();
      const value = cell(row, column);
      if (!value || value.value === null || value.value === undefined) {
        td.textContent = '—';
        continue;
      }
      const step = Math.min(
        CHART_COLORS.ramp.length - 1,
        Math.floor(value.value * CHART_COLORS.ramp.length),
      );
      td.style.background = CHART_COLORS.ramp[step];
      td.style.color = step >= 3 ? '#ffffff' : CHART_COLORS.value;
      td.textContent = format(value.value) + (value.n ? ` (${value.n})` : '');
      td.title = `${row} · ${column} : ${format(value.value)} sur ${value.n} réponse(s)`;
    }
  }
  box.append(caption, table);
  if (note) {
    const small = document.createElement('small');
    small.className = 'muted';
    small.textContent = note;
    box.append(small);
  }
  box.dataset.title = title;
  return box;
}

// SVG autonome (styles et titre inclus) pour l'insérer dans un article.
function svgExport(chart) {
  const svg = chart.querySelector('svg').cloneNode(true);
  const width = Number(svg.dataset.width);
  const legend = chart.dataset.legend ? JSON.parse(chart.dataset.legend) : [];
  // Légende recopiée sous le graphique dans l'image exportée.
  let x = 0;
  for (const [name, color] of legend) {
    const y = Number(svg.dataset.height) + 14;
    svg.append(svgNode('rect', { x, y: y - 9, width: 10, height: 10, rx: 2, fill: color }));
    svg.append(svgNode('text', { x: x + 14, y, class: 'bar-label' }, name));
    x += 24 + name.length * 6.5;
  }
  const height = Number(svg.dataset.height) + (legend.length ? 22 : 0);
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', width * 2);
  svg.setAttribute('height', (height + 28) * 2);
  svg.setAttribute('viewBox', `0 -28 ${width} ${height + 28}`);
  svg.removeAttribute('data-width');
  svg.removeAttribute('data-height');
  const style = svgNode('style', {}, SVG_STYLE);
  const background = svgNode('rect', { x: 0, y: -28, width, height: height + 28, fill: '#ffffff' });
  const heading = svgNode('text', { class: 'chart-title', x: 0, y: -10 }, chart.dataset.title);
  svg.prepend(style, background, heading);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
}
