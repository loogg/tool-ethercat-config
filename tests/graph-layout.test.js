import test from 'node:test'
import assert from 'node:assert/strict'
import { DOMParser } from '@xmldom/xmldom'
import { entries } from '../src/data/index.js'
import { applicationWorkbooks } from '../src/data/application-workbooks.js'
import { crossSourceContracts } from '../src/data/cross-source-contracts.js'
import { esiExamples } from '../src/data/esi-examples.js'
import { buildConfigGraph, configDiagram } from '../src/lib/config-graph.js'
import { applicationContext, applicationColumns, headerDefinitions, fieldOccurrence, buildApplicationRelations } from '../src/lib/application-model.js'
import { buildCrossSourceGraph } from '../src/lib/cross-source-model.js'
import { esiContext } from '../src/lib/esi-context.js'
import { esiFieldRows } from '../src/lib/esi-display-model.js'
import { buildEsiFieldGraph, esiFieldDiagram } from '../src/lib/esi-field-graph.js'
import { esiRelations } from '../src/lib/esi-model.js'
import { diagramKey, layoutDiagram } from '../src/lib/graph-layout.js'

globalThis.DOMParser = DOMParser
const epsilon = .01
const overlap = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > epsilon && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > epsilon
function hitsBox(a, b, box) {
  if (Math.abs(a.y - b.y) < epsilon) return a.y > box.y + epsilon && a.y < box.y + box.height - epsilon && Math.min(Math.max(a.x, b.x), box.x + box.width) - Math.max(Math.min(a.x, b.x), box.x) > epsilon
  return a.x > box.x + epsilon && a.x < box.x + box.width - epsilon && Math.min(Math.max(a.y, b.y), box.y + box.height) - Math.max(Math.min(a.y, b.y), box.y) > epsilon
}
function sharedSegment(a, b, c, d) {
  if (Math.abs(a.y - b.y) < epsilon && Math.abs(c.y - d.y) < epsilon && Math.abs(a.y - c.y) < epsilon) return Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) > epsilon
  if (Math.abs(a.x - b.x) < epsilon && Math.abs(c.x - d.x) < epsilon && Math.abs(a.x - c.x) < epsilon) return Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) > epsilon
  return false
}
function ancestors(node, byId) {
  const ids = new Set()
  while (node?.parentId) { ids.add(node.parentId); node = byId.get(node.parentId) }
  return ids
}
function anchor(node, port) {
  return { x: node.absoluteX + (port.side === 'right' ? node.width : port.side === 'left' ? 0 : node.width * port.offset), y: node.absoluteY + (port.side === 'bottom' ? node.height : port.side === 'top' ? 0 : node.height * port.offset) }
}
function inspect(model, layout) {
  const failures = [], byId = new Map(layout.nodes.map(n => [n.id, n]))
  const boxes = layout.nodes.map(n => ({ ...n, x: n.absoluteX, y: n.absoluteY }))
  assert.deepEqual(layout.nodes.map(n => n.id), model.nodes.map(n => n.id))
  assert.deepEqual(layout.edges.map(e => e.id).sort(), model.edges.map(e => e.id).sort())
  for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) {
    if (!ancestors(a, byId).has(b.id) && !ancestors(b, byId).has(a.id) && overlap(a, b)) failures.push(`nodes ${a.id} / ${b.id}`)
  }
  const labels = []
  for (const route of layout.edges) {
    const edge = model.edges.find(e => e.id === route.id), source = byId.get(edge.source), target = byId.get(edge.target)
    const start = anchor(source, source.ports.find(p => p.id === route.sourceHandle)), end = anchor(target, target.ports.find(p => p.id === route.targetHandle))
    assert.ok(Math.hypot(start.x - route.points[0].x, start.y - route.points[0].y) < epsilon)
    assert.ok(Math.hypot(end.x - route.points.at(-1).x, end.y - route.points.at(-1).y) < epsilon)
    const allowed = new Set([...ancestors(source, byId), ...ancestors(target, byId)])
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i]
      assert.ok([a.x, a.y, b.x, b.y].every(Number.isFinite))
      assert.ok(Math.abs(a.x - b.x) < epsilon || Math.abs(a.y - b.y) < epsilon, `non-orthogonal ${route.id}`)
      for (const box of boxes) if (!allowed.has(box.id) && hitsBox(a, b, box)) failures.push(`edge ${route.id} through ${box.id}`)
    }
    if (route.label) {
      for (const box of boxes) if (overlap(route.label, box)) failures.push(`label ${route.id} over ${box.id}`)
      for (const label of labels) if (overlap(route.label, label)) failures.push(`labels ${route.id} / ${label.id}`)
      labels.push({ ...route.label, id: route.id })
    }
  }
  for (const [index, a] of layout.edges.entries()) for (const b of layout.edges.slice(index + 1)) {
    for (let i = 1; i < a.points.length; i++) for (let j = 1; j < b.points.length; j++) if (sharedSegment(a.points[i - 1], a.points[i], b.points[j - 1], b.points[j])) failures.push(`shared route ${a.id} / ${b.id}`)
  }
  for (const route of layout.edges) for (const label of labels.filter(l => l.id !== route.id)) {
    for (let i = 1; i < route.points.length; i++) if (hitsBox(route.points[i - 1], route.points[i], label)) failures.push(`edge ${route.id} through label ${label.id}`)
  }
  return failures
}
const geometry = (model, width, height) => ({ nodes: model.nodes.map(n => ({ id: n.id, width, height })), edges: model.edges.map(e => ({ ...e, labelFontSize: 11 })) })

test('orthogonal routing separates reverse/parallel links, skipped layers, diamonds and group rows', async () => {
  const model = { nodes: ['a', 'b', 'c', 'd'].map(id => ({ id, width: 238, height: 148 })), edges: [
    { id: 'ab', source: 'a', target: 'b', label: '依赖' }, { id: 'ba', source: 'b', target: 'a', label: '反向约束' },
    { id: 'ab2', source: 'a', target: 'b', label: '并行关系' }, { id: 'ac', source: 'a', target: 'c', label: '分支' },
    { id: 'bd', source: 'b', target: 'd', label: '合流' }, { id: 'cd', source: 'c', target: 'd', label: '合流' }, { id: 'ad', source: 'a', target: 'd', label: '跨层引用' },
  ] }
  for (const preference of ['horizontal', 'vertical']) {
    const layout = await layoutDiagram(model, { preference })
    assert.deepEqual(inspect(model, layout), [])
    const sourcePorts = layout.nodes.find(n => n.id === 'a').ports.filter(p => p.type === 'source')
    assert.equal(new Set(sourcePorts.map(p => `${p.side}:${p.offset}`)).size, sourcePorts.length)
    assert.notDeepEqual(layout.edges.find(e => e.id === 'ab').points, layout.edges.find(e => e.id === 'ba').points.toReversed())
    assert.notDeepEqual(layout.edges.find(e => e.id === 'ab').points, layout.edges.find(e => e.id === 'ab2').points)
    assert.deepEqual(layout, await layoutDiagram(model, { preference }))
  }
})

test('five graph families retain endpoints and route around cards and labels in both directions', async t => {
  const corpus = new Map()
  const add = (name, model) => { const key = diagramKey(model); if (!corpus.has(key)) corpus.set(key, { name, model }) }
  for (const entry of entries.filter(e => !e.overview)) for (const expanded of [false, true]) add(`config:${entry.id}:${expanded}`, configDiagram(buildConfigGraph(entry, entries, { expanded })))
  for (const contract of crossSourceContracts) add(`cross:${contract.id}`, geometry(buildCrossSourceGraph(contract), 230, 136))
  for (const book of applicationWorkbooks) for (const sheet of book.sheets) {
    for (const field of Object.keys(headerDefinitions).map(key => `header:${key}`)) {
      const c = applicationContext({ workbook: book.id, sheet: sheet.id, field })
      add(`app:${book.id}:${sheet.id}:${field}`, geometry(buildApplicationRelations(c, fieldOccurrence(c, entries), entries), 238, 118))
    }
    for (const row of sheet.rows) for (const col of applicationColumns) {
      const c = applicationContext({ workbook: book.id, sheet: sheet.id, row: String(row.number), field: col.key })
      add(`app:${book.id}:${sheet.id}:${row.number}:${col.key}`, geometry(buildApplicationRelations(c, fieldOccurrence(c, entries), entries), 238, 118))
    }
  }
  for (const example of esiExamples) {
    const document = esiContext({ esi: example.id }).document
    for (const node of document.nodes) {
      const device = document.devices.find(d => node.id === d.id || node.id.startsWith(`${d.id}/`))
      const c = esiContext({ esi: example.id, esiNode: node.id, ...(device ? { device: device.id } : {}) })
      add(`xml:${example.id}:${node.id}`, geometry(esiRelations(c), 230, 128))
      for (const row of esiFieldRows(c)) add(`field:${example.id}:${row.key}`, esiFieldDiagram(buildEsiFieldGraph(row, c)))
    }
  }
  const failures = []
  for (const { name, model } of corpus.values()) for (const preference of ['horizontal', 'vertical']) {
    const issues = inspect(model, await layoutDiagram(model, { preference }))
    if (issues.length) failures.push(`${name}:${preference}: ${issues.join('; ')}`)
  }
  t.diagnostic(`${corpus.size} distinct models × 2 directions; configuration/expanded, application fields, ESI fields, XML references, cross-file contracts`)
  assert.equal(failures.length, 0, failures.slice(0, 20).join('\n'))
})

test('automatic direction responds to usable width without changing domain IDs', async () => {
  const model = { nodes: ['a', 'b', 'c'].map(id => ({ id, width: 238, height: 132 })), edges: [{ id: 'ab', source: 'a', target: 'b', label: '来源' }, { id: 'bc', source: 'b', target: 'c', label: '生成' }] }
  const wide = await layoutDiagram(model, { width: 1400, height: 600 }), narrow = await layoutDiagram(model, { width: 390, height: 800 })
  assert.equal(wide.direction, 'LR'); assert.equal(narrow.direction, 'TB')
  assert.deepEqual(wide.nodes.map(n => n.id), narrow.nodes.map(n => n.id))
  assert.deepEqual(wide.edges.map(e => e.id), narrow.edges.map(e => e.id))
})

test('invalid geometry fails explicitly instead of displaying a guessed straight line', async () => {
  await assert.rejects(layoutDiagram({ nodes: [{ id: 'a', width: 0, height: 100 }], edges: [] }), /尺寸/)
  await assert.rejects(layoutDiagram({ nodes: [{ id: 'a', width: 100, height: 100 }], edges: [{ id: 'bad', source: 'a', target: 'missing' }] }), /端点/)
})
