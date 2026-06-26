import { esc, r1, tw, fmtLabel } from './helpers.js';

// ── isDark — read from html class (avoids circular import with theme.js) ──
function isDark() { return !document.documentElement.classList.contains('light'); }

// ── flowchart parser ──────────────────────────────────────
export function parseFlowchart(raw) {
  const lines = raw.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('%%'));
  let rankdir = 'LR';
  const nodesMap = new Map(), edges = [], classOf = {};

  function cleanLabel(s) { return s.replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n'); }
  function refFromLabel(label) {
    const m = label.match(/^@([\w-]+)/);
    return m ? m[1] : null;
  }
  function tok(t) {
    t = t.trim();
    let m;
    m = t.match(/^(@?[\w-]+)\["([^"]+)"\]$/); if (m) { const lbl=cleanLabel(m[2]),r=refFromLabel(lbl),idR=m[1].startsWith('@'); return {id:m[1].replace(/^@/,''),label:lbl,shape:'rect',isRef:idR||!!r,refTarget:r||(idR?m[1].replace(/^@/,''):null)}; }
    m = t.match(/^(@?[\w-]+)\[([^\]]+)\]$/);  if (m) { const lbl=cleanLabel(m[2]),r=refFromLabel(lbl),idR=m[1].startsWith('@'); return {id:m[1].replace(/^@/,''),label:lbl,shape:'rect',isRef:idR||!!r,refTarget:r||(idR?m[1].replace(/^@/,''):null)}; }
    m = t.match(/^(@?[\w-]+)\(\(([^)]+)\)\)$/); if (m) { const lbl=cleanLabel(m[2]),r=refFromLabel(lbl),idR=m[1].startsWith('@'); return {id:m[1].replace(/^@/,''),label:lbl,shape:'stadium',isRef:idR||!!r,refTarget:r||(idR?m[1].replace(/^@/,''):null)}; }
    m = t.match(/^(@?[\w-]+)\(([^)]+)\)$/);   if (m) { const lbl=cleanLabel(m[2]),r=refFromLabel(lbl),idR=m[1].startsWith('@'); return {id:m[1].replace(/^@/,''),label:lbl,shape:'round',isRef:idR||!!r,refTarget:r||(idR?m[1].replace(/^@/,''):null)}; }
    m = t.match(/^(@?[\w-]+)\{([^}]+)\}$/);   if (m) { const lbl=cleanLabel(m[2]),r=refFromLabel(lbl),idR=m[1].startsWith('@'); return {id:m[1].replace(/^@/,''),label:lbl,shape:'diamond',isRef:idR||!!r,refTarget:r||(idR?m[1].replace(/^@/,''):null)}; }
    if (/^@?[\w-]+$/.test(t)) { const id=t.replace(/^@/,''); return {id,label:id,shape:'rect',isRef:t.startsWith('@')}; }
    return null;
  }

  const edgeLineRe = /^(.+?)\s+--\s+"([^"]+)"\s+-->\s+(.+)$/;
  const arrowRe = /(-->(?:\|[^|]*\|)?|--o|--x|---|-.->|==>|~~>)/;
  for (const line of lines) {
    const dir = line.match(/^(?:graph|flowchart)\s+([A-Z]{2})/i);
    if (dir) { const d=dir[1].toUpperCase(); rankdir=(d==='TD'||d==='TB')?'TB':d; continue; }
    if (/^(classDef|click |style |linkStyle|subgraph|end$)/i.test(line)) continue;
    const ca = line.match(/^class\s+([\w\-,\s]+)\s+(\w+)$/);
    if (ca) { ca[1].split(',').map(s=>s.trim()).forEach(id=>classOf[id]=ca[2]); continue; }
    const labelEdge = line.match(edgeLineRe);
    if (labelEdge) {
      const src=tok(labelEdge[1]), dst=tok(labelEdge[3]);
      if (src&&dst) {
        if (!nodesMap.has(src.id)) nodesMap.set(src.id,src);
        if (!nodesMap.has(dst.id)) nodesMap.set(dst.id,dst);
        edges.push({from:src.id,to:dst.id,label:labelEdge[2].replace(/<br\s*\/?>/gi,' ')});
      }
      continue;
    }
    const parts = line.split(arrowRe);
    if (parts.length >= 3) {
      const src=tok(parts[0]), dst=tok(parts[2]);
      if (src&&dst) {
        if (!nodesMap.has(src.id)) nodesMap.set(src.id,src);
        if (!nodesMap.has(dst.id)) nodesMap.set(dst.id,dst);
        const lm=parts[1].match(/\|([^|]+)\|/);
        edges.push({from:src.id,to:dst.id,label:lm?lm[1].replace(/<br\s*\/?>/gi,' '):''});
      }
    } else {
      const n=tok(line); if (n&&!nodesMap.has(n.id)) nodesMap.set(n.id,n);
    }
  }
  for (const [id,cls] of Object.entries(classOf)) { const n=nodesMap.get(id); if (n) n.cls=cls; }
  return {rankdir, nodes:[...nodesMap.values()], edges};
}

// ── node style ────────────────────────────────────────────
function cv(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
export function nodeStyle(node) {
  const c = node.cls||'';
  if (c==='external') return {bg:cv('--node-external-bg'),border:cv('--node-external-border'),text:cv('--node-external-text'),dash:'6 3'};
  if (c==='concern')  return {bg:cv('--node-concern-bg'),border:cv('--node-concern-border'),text:cv('--node-concern-text')};
  if (c==='entry')    return {bg:cv('--node-entry-bg'),border:cv('--node-entry-border'),text:cv('--node-entry-text')};
  if (c==='store')    return {bg:cv('--node-store-bg'),border:cv('--node-store-border'),text:cv('--node-store-text')};
  return {bg:cv('--node-default-bg'),border:cv('--node-default-border'),text:cv('--node-default-text')};
}

// ── smooth path through all Dagre waypoints ───────────────
export function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  if (pts.length === 2) { d += ` L${pts[1].x},${pts[1].y}`; return d; }
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
    const cx = (p0.x + p1.x) / 2, cy = (p0.y + p1.y) / 2;
    const cx2 = (p1.x + p2.x) / 2, cy2 = (p1.y + p2.y) / 2;
    if (i === 1) d += ` L${cx},${cy}`;
    d += ` Q${p1.x},${p1.y} ${cx2},${cy2}`;
  }
  d += ` L${pts[pts.length - 1].x},${pts[pts.length - 1].y}`;
  return d;
}
