// Domain relations never change here. This module only computes display geometry.
let enginePromise
const cache = new Map()
export function getLayoutEngine() {
  if (!enginePromise) {
    if (typeof window === 'undefined') {
      const nodeModule = ['elkjs', 'lib', 'elk.bundled.js'].join('/')
      enginePromise = import(/* @vite-ignore */ nodeModule).then(module => new module.default())
    } else enginePromise = import('./elk-browser.js').then(module => module.createEngine())
    enginePromise = enginePromise.catch(error => { enginePromise = null; throw error })
  }
  return enginePromise
}

export const labelSize = (text, fontSize = 12) => ({
  width: Math.max(28, [...String(text || '')].reduce((width, char) => width + (char.codePointAt(0) > 127 ? fontSize : fontSize * .63), 0) + 18),
  height: 26,
})

export function diagramKey(model) {
  return JSON.stringify({
    nodes: model.nodes.map(n => ({ id: n.id, width: n.width, height: n.height, ...(n.parentId ? { parentId: n.parentId } : {}), x: n.x || 0, y: n.y || 0 })),
    edges: model.edges.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.label || '', labelFontSize: e.labelFontSize || 12 })),
  })
}

const round = value => Math.round(value * 1000) / 1000
export function polylinePath(points) {
  return points.map((p, index) => `${index ? 'L' : 'M'}${round(p.x)},${round(p.y)}`).join(' ')
}
function simplify(points) {
  const unique = points.filter((p, i) => !i || Math.abs(p.x - points[i - 1].x) > .001 || Math.abs(p.y - points[i - 1].y) > .001)
  return unique.filter((p, i) => !i || i === unique.length - 1 || !((Math.abs(unique[i - 1].x - p.x) < .001 && Math.abs(p.x - unique[i + 1].x) < .001) || (Math.abs(unique[i - 1].y - p.y) < .001 && Math.abs(p.y - unique[i + 1].y) < .001)))
}

function normalize(model) {
  const nodes = model.nodes.map(n => ({ ...n, x: n.x || 0, y: n.y || 0 }))
  const byId = new Map(nodes.map(n => [n.id, n]))
  if (byId.size !== nodes.length) throw new Error('布局节点ID重复。')
  for (const node of nodes) {
    if (!(node.width > 0 && node.height > 0)) throw new Error(`节点尺寸无效：${node.id}`)
    if (node.parentId && !byId.has(node.parentId)) throw new Error(`分组不存在：${node.parentId}`)
    const seen = new Set([node.id]); let parent = byId.get(node.parentId)
    while (parent) { if (seen.has(parent.id)) throw new Error('分组层级包含循环。'); seen.add(parent.id); parent = byId.get(parent.parentId) }
  }
  if (new Set(model.edges.map(e => e.id)).size !== model.edges.length) throw new Error('布局关系ID重复。')
  for (const edge of model.edges) if (!byId.has(edge.source) || !byId.has(edge.target)) throw new Error(`关系端点不存在：${edge.id}`)
  return { nodes, byId }
}

function nearestSide(port, node, direction) {
  const sides = direction === 'LR' ? ['left', 'right', 'top', 'bottom'] : ['top', 'bottom', 'left', 'right']
  const distance = { left: Math.abs(port.x), right: Math.abs(port.x - node.width), top: Math.abs(port.y), bottom: Math.abs(port.y - node.height) }
  return sides.reduce((best, side) => distance[side] < distance[best] - .001 ? side : best)
}

async function layoutOne(model, direction) {
  const { nodes, byId } = normalize(model)
  if (!nodes.length) return { nodes: [], edges: [], width: 0, height: 0, direction }
  const outerId = id => { let n = byId.get(id); while (n.parentId) n = byId.get(n.parentId); return n.id }
  const relative = id => { let n = byId.get(id), x = 0, y = 0; while (n.parentId) { x += n.x; y += n.y; n = byId.get(n.parentId) } return { x, y } }
  const top = nodes.filter(n => !n.parentId)
  const groupIds = new Set(nodes.filter(n => n.parentId).map(n => outerId(n.id)))
  const terminals = model.edges.flatMap(edge => [
    { edge: edge.id, node: edge.source, type: 'source', id: `out-${encodeURIComponent(edge.id)}` },
    { edge: edge.id, node: edge.target, type: 'target', id: `in-${encodeURIComponent(edge.id)}` },
  ])
  const portMeta = new Map()
  const elkNodes = top.map(node => {
    const ports = terminals.filter(p => outerId(p.node) === node.id).map(p => {
      const meta = { ...p, outer: node.id }
      if (groupIds.has(node.id)) {
        // Child entries leave horizontally through their own row, not through siblings.
        const local = byId.get(p.node), offset = relative(p.node)
        const peers = terminals.filter(q => q.node === p.node && q.type === p.type)
        const fraction = (peers.findIndex(q => q.id === p.id) + 1) / (peers.length + 1)
        meta.side = p.type === 'source' ? 'right' : 'left'
        meta.local = { x: meta.side === 'right' ? local.width : 0, y: local.height * fraction }
        const port = { id: p.id, width: 0, height: 0, x: meta.side === 'right' ? node.width : 0, y: offset.y + meta.local.y, layoutOptions: { 'elk.port.side': meta.side === 'right' ? 'EAST' : 'WEST' } }
        portMeta.set(p.id, meta)
        return port
      }
      portMeta.set(p.id, meta)
      return { id: p.id, width: 0, height: 0 }
    })
    return { id: node.id, width: node.width, height: node.height, ports, layoutOptions: { 'elk.portConstraints': groupIds.has(node.id) ? 'FIXED_POS' : 'FREE' } }
  })
  const engine = await getLayoutEngine()
  const result = await engine.layout({
    id: 'diagram-root',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': direction === 'LR' ? 'RIGHT' : 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL', 'elk.randomSeed': '1', 'elk.padding': '[top=28,left=28,bottom=28,right=28]',
      'elk.spacing.nodeNode': '48', 'elk.spacing.edgeEdge': '18', 'elk.spacing.edgeNode': '18',
      'elk.layered.spacing.nodeNodeBetweenLayers': '44', 'elk.layered.spacing.edgeNodeBetweenLayers': '18',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '18', 'elk.layered.mergeEdges': 'false',
      'elk.layered.mergeHierarchyEdges': 'false', 'elk.spacing.portPort': '18',
      'elk.layered.nodePlacement.favorStraightEdges': 'true',
    },
    children: elkNodes,
    edges: model.edges.map(edge => ({ id: edge.id, sources: [`out-${encodeURIComponent(edge.id)}`], targets: [`in-${encodeURIComponent(edge.id)}`], ...(edge.label ? { labels: [{ text: edge.label, ...labelSize(edge.label, edge.labelFontSize) }] } : {}) })),
  })
  const elkById = new Map(result.children.map(n => [n.id, n]))
  const geometry = nodes.map(node => {
    const outer = elkById.get(outerId(node.id)), offset = relative(node.id)
    return { id: node.id, parentId: node.parentId, x: node.parentId ? node.x : outer.x, y: node.parentId ? node.y : outer.y, absoluteX: outer.x + offset.x, absoluteY: outer.y + offset.y, width: node.width, height: node.height, ports: [] }
  })
  const geometryById = new Map(geometry.map(n => [n.id, n]))
  const anchors = new Map()
  for (const outer of result.children) for (const p of outer.ports || []) {
    const meta = portMeta.get(p.id), localNode = geometryById.get(meta.node)
    const local = meta.local || { x: p.x, y: p.y }, side = meta.side || nearestSide(p, outer, direction)
    const anchor = { x: localNode.absoluteX + local.x, y: localNode.absoluteY + local.y }
    anchors.set(p.id, anchor)
    localNode.ports.push({ id: p.id, type: meta.type, side, offset: side === 'left' || side === 'right' ? local.y / localNode.height : local.x / localNode.width })
  }
  const edges = result.edges.map(edge => {
    if (edge.sections?.length !== 1) throw new Error(`关系没有可用路径：${edge.id}`)
    const section = edge.sections[0]
    const sourceHandle = `out-${encodeURIComponent(edge.id)}`, targetHandle = `in-${encodeURIComponent(edge.id)}`
    const points = simplify([anchors.get(sourceHandle), section.startPoint, ...(section.bendPoints || []), section.endPoint, anchors.get(targetHandle)])
    const label = edge.labels?.[0]
    return { id: edge.id, sourceHandle, targetHandle, points, path: polylinePath(points), label: label ? { x: label.x, y: label.y, width: label.width, height: label.height, centerX: label.x + label.width / 2, centerY: label.y + label.height / 2 } : null }
  })
  return { direction, nodes: geometry, edges, width: result.width, height: result.height }
}

function cachedLayout(model, direction) {
  const key = `${direction}:${diagramKey(model)}`
  if (cache.has(key)) return cache.get(key)
  const pending = layoutOne(model, direction).catch(error => { cache.delete(key); throw error })
  cache.set(key, pending)
  while (cache.size > 96) cache.delete(cache.keys().next().value)
  return pending
}

export async function layoutDiagram(model, { preference = 'auto', width = 1000, height = 600 } = {}) {
  if (preference === 'horizontal') return cachedLayout(model, 'LR')
  if (preference === 'vertical') return cachedLayout(model, 'TB')
  const [horizontal, vertical] = await Promise.all([cachedLayout(model, 'LR'), cachedLayout(model, 'TB')])
  if (width < 650) return vertical
  const hScale = Math.min(width / Math.max(horizontal.width, 1), height / Math.max(horizontal.height, 1), 1)
  const vScale = Math.min(width / Math.max(vertical.width, 1), height / Math.max(vertical.height, 1), 1)
  return hScale >= .88 || hScale >= vScale ? horizontal : vertical
}
