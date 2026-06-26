import { esc } from './helpers.js';

// ── export diagram ──────────────────────────────────────
function showExportToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface2);color:var(--text-body);padding:10px 20px;border-radius:6px;font-size:13px;font-family:var(--font);z-index:99999;border:1px solid var(--border);';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function resolveDataKeyExact(cls, classesData) {
  if (classesData[cls]?.diagram) return cls;
  return null;
}

function addTitleToSvg(svg, cls) {
  const project = (typeof window.__projectName === 'string' && window.__projectName) || 'omm';
  const shortName = cls.includes('/') ? cls.split('/').pop() : cls;
  const title = `${esc(project)} — ${esc(shortName)}`;

  const vbMatch = svg.match(/viewBox="([^"]+)"/);
  let vx = 0, vy = 0, vw = 800, vh = 600;
  if (vbMatch) {
    const p = vbMatch[1].split(/\s+/);
    if (p.length === 4) { vx = +p[0]; vy = +p[1]; vw = +p[2]; vh = +p[3]; }
  }

  const headerH = 44;
  const newVb = `${vx} ${vy} ${vw} ${vh + headerH}`;
  const _bg = getComputedStyle(document.documentElement).getPropertyValue('--surface2').trim() || '#111';
  const _pageBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#000';
  const _text = getComputedStyle(document.documentElement).getPropertyValue('--text-body').trim() || '#ccc';
  const _line = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#333';
  const titleBlock = `\n    <rect x="${vx}" y="${vy}" width="${vw}" height="${vh + headerH}" fill="${_pageBg}"/>\n    <rect x="${vx}" y="${vy}" width="${vw}" height="${headerH}" fill="${_bg}"/>\n    <text x="${vx + 16}" y="${vy + 28}" font-family="Inter,system-ui,sans-serif" font-size="16" font-weight="600" fill="${_text}">${title}</text>\n    <line x1="${vx}" y1="${vy + headerH}" x2="${vx + vw}" y2="${vy + headerH}" stroke="${_line}" stroke-width="1"/>\n  `;

  let out = svg.replace(/viewBox="[^"]*"/, `viewBox="${newVb}"`);
  const svgOpenEnd = out.indexOf('>') + 1;
  const svgClose = out.lastIndexOf('</svg>');
  if (svgClose >= 0) {
    out = out.slice(0, svgOpenEnd) + titleBlock + `<g transform="translate(0,${headerH})">`
      + out.slice(svgOpenEnd, svgClose) + '</g>' + out.slice(svgClose);
  } else {
    out = out.slice(0, svgOpenEnd) + titleBlock + `<g transform="translate(0,${headerH})">` + out.slice(svgOpenEnd) + '</g>';
  }
  return out;
}

function downloadSvg(svgString, filename) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportElementSvg(cls, classesData, renderFlatSVG) {
  const dataKey = resolveDataKeyExact(cls, classesData);
  const data = dataKey ? classesData[dataKey] : null;
  if (!data?.diagram) { showExportToast('No diagram for this element'); return; }
  let svg = renderFlatSVG(data.diagram);
  if (!svg) { showExportToast('Could not render diagram'); return; }
  svg = addTitleToSvg(svg, cls);
  const full = `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
  const proj = (typeof window.__projectName === 'string' && window.__projectName) || 'omm';
  downloadSvg(full, `${proj}_${cls.replace(/\//g, '_')}.svg`);
}

function exportElementPng(cls, classesData, renderFlatSVG) {
  const dataKey = resolveDataKeyExact(cls, classesData);
  const data = dataKey ? classesData[dataKey] : null;
  if (!data?.diagram) { showExportToast('No diagram for this element'); return; }
  let svg = renderFlatSVG(data.diagram);
  if (!svg) { showExportToast('Could not render diagram'); return; }
  svg = addTitleToSvg(svg, cls);

  const vbMatch = svg.match(/viewBox="([^"]+)"/);
  let svgW = 800, svgH = 600;
  if (vbMatch) {
    const parts = vbMatch[1].split(/\s+/);
    if (parts.length === 4) { svgW = parseFloat(parts[2]) || 800; svgH = parseFloat(parts[3]) || 600; }
  }

  let sizedSvg = svg;
  if (!/width="\d/.test(svg)) {
    sizedSvg = sizedSvg.replace(/<svg/, `<svg width="${svgW}" height="${svgH}"`);
  }

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = svgW * scale;
  canvas.height = svgH * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#000';
  ctx.fillRect(0, 0, svgW, svgH);

  const img = new Image();
  const blob = new Blob([sizedSvg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  img.onload = () => {
    ctx.drawImage(img, 0, 0, svgW, svgH);
    canvas.toBlob((pngBlob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pngBlob);
      const proj = (typeof window.__projectName === 'string' && window.__projectName) || 'omm';
      a.download = `${proj}_${cls.replace(/\//g, '_')}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    const proj = (typeof window.__projectName === 'string' && window.__projectName) || 'omm';
    downloadSvg(sizedSvg, `${proj}_${cls.replace(/\//g, '_')}.svg`);
  };
  img.src = url;
}

async function exportElementHtml(cls) {
  showExportToast('Generating HTML…');
  try {
    const res = await fetch(`/api/class/${encodeURIComponent(cls)}/export/html`);
    if (!res.ok) { showExportToast('Export failed'); return; }
    const html = await res.text();
    const project = (typeof window.__projectName === 'string' && window.__projectName) || 'omm';
    const shortName = cls.includes('/') ? cls.split('/').pop() : cls;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project}_${shortName}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    showExportToast('Export failed: ' + e.message);
  }
}

/** Setup export button — call after DOM is ready */
export function setupExport(getSelectedCls, classesDataRef, renderFlatSVGRef) {
  window.exportDiagram = function() {
    const cls = getSelectedCls();
    if (!cls) {
      const svgEl = document.querySelector('#canvas svg');
      if (svgEl) {
        let svgStr = new XMLSerializer().serializeToString(svgEl);
        // Inject background rect after opening <svg> tag
        const _bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#000';
        const vbMatch = svgStr.match(/viewBox="([^"]+)"/);
        if (vbMatch) {
          const p = vbMatch[1].split(/\s+/);
          if (p.length === 4) {
            const bgRect = `<rect x="${p[0]}" y="${p[1]}" width="${p[2]}" height="${p[3]}" fill="${_bg}"/>`;
            svgStr = svgStr.replace(/^(<svg[^>]*>)/, '$1' + bgRect);
          }
        }
        downloadSvg(svgStr, 'diagram.svg');
      }
      return;
    }
    const existing = document.getElementById('export-menu');
    if (existing) { existing.remove(); return; }

    const menu = document.createElement('div');
    menu.id = 'export-menu';
    const btn = document.getElementById('export-btn');
    const rect = btn.getBoundingClientRect();
    const _menuBg = getComputedStyle(document.documentElement).getPropertyValue('--surface2').trim() || '#111';
    const _menuBorder = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#333';
    menu.style.cssText = `position:fixed;top:${rect.bottom + 4}px;right:${window.innerWidth - rect.right}px;background:${_menuBg};border:1px solid ${_menuBorder};border-radius:6px;padding:4px 0;z-index:9999;min-width:120px;`;
    const items = [
      { label: 'SVG', action: () => exportElementSvg(cls, classesDataRef(), renderFlatSVGRef) },
      { label: 'PNG', action: () => exportElementPng(cls, classesDataRef(), renderFlatSVGRef) },
      { label: 'HTML', action: () => exportElementHtml(cls) },
    ];
    for (const {label, action} of items) {
      const item = document.createElement('button');
      item.textContent = label;
      const _itemText = getComputedStyle(document.documentElement).getPropertyValue('--text-body').trim() || '#ccc';
      const _itemHover = getComputedStyle(document.documentElement).getPropertyValue('--surface4').trim() || '#1a1a1a';
      item.style.cssText = `display:block;width:100%;padding:6px 14px;background:none;border:none;color:${_itemText};font-size:12px;cursor:pointer;text-align:left;font-family:var(--mono);`;
      item.onmouseover = () => item.style.background = _itemHover;
      item.onmouseout = () => item.style.background = 'none';
      item.onclick = (e) => { e.stopPropagation(); menu.remove(); action(); };
      menu.appendChild(item);
    }
    document.body.appendChild(menu);

    function closeMenu(e) {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        document.removeEventListener('mousedown', closeMenu);
      }
    }
    setTimeout(() => document.addEventListener('mousedown', closeMenu), 0);
  };
}
