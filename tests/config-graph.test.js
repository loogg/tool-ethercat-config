import test from 'node:test'
import assert from 'node:assert/strict'
import { entries, entryMap } from '../src/data/index.js'
import { buildConfigGraph, filterConfigGraph, cycleScenario, capacityScenario, bufferScenario, layoutConfigGraph, relationKinds, NODE_WIDTH, NODE_HEIGHT, GROUP_WIDTH, GROUP_HEIGHT, matchGraphNode } from '../src/lib/config-graph.js'
import { configModelProfiles, reviewedConfigurationIds } from '../src/data/config-models.js'

test('Complete Access graph separates declarations, protocol SI0, local allocation and request-dependent prefixes',()=>{
  const graph=buildConfigGraph(entryMap.get('complete-access-supported'),entries)
  assert.equal(graph.profile.kind,'sdo-access')
  assert.ok(graph.nodes.find(n=>n.id==='ca-si0').fields.some(f=>f.value==='8 bit'))
  assert.ok(graph.nodes.find(n=>n.id==='ca-local').fields.some(f=>f.value==='16 bit'))
  assert.equal(graph.nodes.find(n=>n.id==='ca-wire').fields.length,2)
  assert.ok(graph.nodes.find(n=>n.id==='ca-xml').position.parent.includes('CoE'))
  assert.ok(graph.nodes.find(n=>n.id===graph.rootId).fields.some(f=>f.value.includes('未知')))
  assert.ok(!graph.nodes.some(n=>n.addressParts||n.name.includes('0x2002')))
})

test('cycle fixed value initializes exact CoE subindices, not ESI cycle settings', () => {
  const graph = buildConfigGraph(entryMap.get('min-pd-cycle-time'), entries, { cycleValue: '100000' })
  assert.equal(graph.scenario.microseconds, 100)
  assert.deepEqual(graph.nodes.filter(n => n.kind === 'object').map(n => n.name), ['0x1C32', '0x1C33'])
  assert.deepEqual(graph.nodes.filter(n => n.kind === 'subentry').map(n => n.position.selector), ['0x1C32:05', '0x1C33:05'])
  assert.ok(graph.edges.every(e => e.kind === 'initializes' && e.condition.includes('固定值')))
  assert.ok(!graph.nodes.some(n => n.position.surface === 'ESI'))
  assert.equal(matchGraphNode(graph, '0x1c32:05'), 'object-1c32-05')
})
test('cycle zero selects a measurement branch rather than presenting zero elapsed time', () => {
  const graph = buildConfigGraph(entryMap.get('min-pd-cycle-time'), entries, { cycleValue: '0' })
  assert.equal(graph.scenario.measured, true)
  assert.ok(graph.nodes.some(n => n.kind === 'mode'))
  assert.equal(graph.edges.filter(e => e.label === '测量后更新').length, 2)
  assert.ok(graph.nodes.filter(n => n.kind === 'subentry').every(n => n.fields.some(f => f.value === '运行时测量')))
  assert.equal(cycleScenario('-1').valid, false)
  assert.equal(cycleScenario('4294967296').valid, false)
})
test('capacity derives active length with rounding and compares it to a separate upper limit', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(capacityScenario('16, 32', '16')).filter(([key]) => ['bytes', 'capacity', 'fits'].includes(key))), { bytes: 6, capacity: 16, fits: true })
  assert.equal(capacityScenario('1, 8', '2').bytes, 2)
  assert.equal(capacityScenario('16,32', '5').fits, false)
  assert.equal(capacityScenario('', '16').bytes, 0)
  assert.equal(capacityScenario('16, bad', '16').valid, false)
  const graph = buildConfigGraph(entryMap.get('max-pd-output-size'), entries, { expanded: true })
  assert.ok(graph.edges.some(e => e.kind === 'constrains' && e.label === 'L ≤ 容量'))
  assert.ok(graph.nodes.some(n => n.position.surface === '应用定义文件'))
  assert.ok(graph.nodes.some(n => n.position.surface === 'ESI' && n.name.includes('BitLen')))
  assert.ok(graph.edges.find(e => e.source === 'field-esi-output-default').description.includes('不画为恒等'))
})
test('CoE grouping separates a 16bit object index from its independent 8bit subindex', async () => {
  const graph = buildConfigGraph(entryMap.get('min-pd-cycle-time'), entries)
  const field = graph.nodes.find(node => node.id === 'object-1c32-05')
  assert.equal(field.parentId, 'object-1c32')
  assert.deepEqual(field.addressParts, { index: 0x1c32, subIndex: 5 })
  assert.equal(field.addressParts.index >> 8, 0x1c)
  assert.equal(field.addressParts.index & 255, 0x32)
  for (const preference of ['horizontal', 'vertical']) {
    const layout = await layoutConfigGraph(graph, preference)
    for (const child of layout.nodes.filter(node => node.parentId)) {
      assert.ok(child.x >= 0 && child.y >= 0)
      assert.ok(child.x + NODE_WIDTH <= GROUP_WIDTH)
      assert.ok(child.y + NODE_HEIGHT <= GROUP_HEIGHT)
    }
  }
})
test('filtering keeps ancestor object containers before visible subentries', () => {
  const graph = buildConfigGraph(entryMap.get('min-pd-cycle-time'), entries)
  for (const mode of ['all', 'directed', 'described']) {
    const filtered = filterConfigGraph(graph, mode)
    const order = filtered.nodes.map(node => node.id)
    for (const child of filtered.nodes.filter(n => n.parentId)) assert.ok(order.indexOf(child.parentId) >= 0 && order.indexOf(child.parentId) < order.indexOf(child.id))
  }
  assert.equal(filterConfigGraph(graph).nodes.length, 5)
  assert.equal(filterConfigGraph(graph, 'directed').nodes.length, 5)
  assert.equal(filterConfigGraph(graph, 'described').nodes.length, 1)
})
test('buffer model distinguishes actual length from maximum capacity reservation', () => {
  const model = bufferScenario(6, 16)
  assert.equal(model.actual.length, 6)
  assert.equal(model.actual.allocated, 18)
  assert.equal(model.reserved.allocated, 48)
  assert.equal(model.actual.effectiveBuffers, 3)
  assert.equal(bufferScenario(6, 16, { buffers: '1' }).actual.allocated, 6)
  const wide = bufferScenario(250, 250, { internalWidth: '32', start: '0x1003' })
  assert.equal(wide.actual.bufferSpan, 256)
  assert.equal(wide.actual.allocated, 768)
  assert.equal(wide.actual.physicalStart, 0x1000)
  assert.equal(wide.actual.end, 0x1300)
  assert.equal(bufferScenario(1, 1).actual.effectiveBuffers, 1)
  assert.equal(bufferScenario(0, 0).actual.allocated, 0)
  assert.equal(capacityScenario('', '0').fits, true)
})
test('every configuration has an explicit reviewed model decision', () => {
  assert.equal(new Set(reviewedConfigurationIds).size, reviewedConfigurationIds.length)
  for (const entry of entries.filter(e => e.nodeKind === 'config')) {
    assert.ok(configModelProfiles[entry.id], entry.id)
    assert.ok(configModelProfiles[entry.id].rationale.length > 10, entry.id)
    assert.equal(buildConfigGraph(entry, entries).profile.kind, configModelProfiles[entry.id].kind)
  }
  assert.notEqual(configModelProfiles['esi-control-byte'].kind, configModelProfiles['max-pd-output-size'].kind)
  assert.notEqual(configModelProfiles['xlsx-access'].kind, configModelProfiles['xlsx-rx-tx'].kind)
})
test('identity fields use actual labels and keep CoE addresses as graph endpoints', () => {
  for (const id of ['coe-device-name', 'coe-hardware-version', 'coe-software-version', 'coe-identity']) assert.ok(!entryMap.get(id).name.startsWith('0x'))
  const graph = buildConfigGraph(entryMap.get('coe-hardware-version'), entries)
  assert.ok(graph.nodes.some(n => n.kind === 'object' && n.name === '0x1009'))
  assert.ok(graph.nodes.some(n => n.kind === 'subentry' && n.identifier === '0x1009:00'))
})
test('one Identity object contains four related subitems without duplicating the parent', async () => {
  const graph = buildConfigGraph(entryMap.get('coe-identity'), entries)
  const parent = graph.nodes.find(n => n.name === '0x1018' && n.isGroup)
  assert.ok(parent)
  const children = graph.nodes.filter(n => n.parentId === parent.id)
  assert.equal(children.length, 4)
  const layout = await layoutConfigGraph(graph)
  for (const child of layout.nodes.filter(n => n.parentId === parent.id)) assert.ok(child.y + child.nodeHeight <= parent.groupHeight)
})
test('timing models select the correct subitem and treat delay zero as a fixed description', () => {
  const copying = buildConfigGraph(entryMap.get('pd-input-calc-and-copy-time'), entries, { cycleValue: '0' })
  assert.ok(copying.nodes.some(n => n.identifier === '0x1C33:06'))
  assert.equal(copying.scenario.measured, true)
  const delay = buildConfigGraph(entryMap.get('pd-input-delay-time'), entries, { cycleValue: '0' })
  assert.ok(delay.nodes.some(n => n.identifier === '0x1C33:09'))
  assert.equal(delay.scenario.measured, false)
  assert.equal(delay.scenario.display, '0 ns')
  assert.equal(delay.supportsMeasurement, false)
})
test('Mailbox and bitfield models do not inherit PDO length or 16bit address assumptions', () => {
  const mailbox = buildConfigGraph(entryMap.get('def-mbx-size'), entries)
  assert.ok(mailbox.nodes.find(n => n.id === 'rule-mailbox-memory').fields.some(f => f.value.includes('128 × 1')))
  const control = buildConfigGraph(entryMap.get('esi-control-byte'), entries)
  const decoded = control.nodes.find(n => n.id === 'register-sm-control').controlByte
  assert.equal(decoded.value, 0x64)
  assert.equal(decoded.buffers, 3)
  assert.equal(decoded.watchdogTrigger, true)
})
test('mapping model preserves the 16/8/8 format and the referenced object/subitem', () => {
  const graph = buildConfigGraph(entryMap.get('esi-entry'), entries)
  assert.deepEqual(graph.nodes.find(n => n.id === 'rule-mapping-word').mappingParts, { word: 0x70000110, index: 0x7000, subIndex: 1, bitLength: 16 })
  assert.ok(graph.edges.some(e => e.kind === 'references' && e.target === 'object-example-7000-01'))
  assert.ok(graph.nodes.find(n => n.id === 'object-example-7000-01').parentId)
})
test('input capacity keeps Tx direction, input SM and assignment distinct from outputs', () => {
  const graph = buildConfigGraph(entryMap.get('max-pd-input-size'), entries, { expanded: true })
  assert.ok(graph.nodes.some(n => n.name === '活动 TxPDO 映射' && n.position.parent.includes('0x1C13')))
  assert.ok(graph.nodes.find(n => n.id === 'field-esi-entry').position.parent.includes('TxPdo'))
  assert.ok(graph.nodes.find(n => n.id === 'field-esi-output-default').position.parent.includes('Inputs'))
})
test('watchdog branches and physical SM addresses retain their specific semantics', () => {
  const watchdog = buildConfigGraph(entryMap.get('esc-sm-wd-supported'), entries)
  assert.equal(watchdog.edges.filter(e => e.kind === 'selects').length, 2)
  assert.ok(watchdog.nodes.some(n => n.kind === 'register' && n.name.includes('0x0440')))
  const sm = buildConfigGraph(entryMap.get('def-pd-write-address'), entries)
  assert.ok(sm.nodes.some(n => n.kind === 'register' && n.fields.some(f => f.value === '0x0810–0x0811')))
  assert.ok(sm.edges.some(e => e.label === '主站配置实际值' && e.description.includes('不保证等于最终运行')))
})
test('all local graphs have unique nodes, resolvable edges, typed semantics and evidence', () => {
  for (const entry of entries.filter(e => !e.overview)) {
    const graph = buildConfigGraph(entry, entries)
    const ids = new Set(graph.nodes.map(n => n.id))
    assert.equal(ids.size, graph.nodes.length, entry.id)
    assert.ok(ids.has(graph.rootId))
    for (const link of graph.edges) {
      assert.ok(ids.has(link.source) && ids.has(link.target), link.id)
      assert.ok(relationKinds[link.kind], link.kind)
      assert.ok(link.references.length, link.id)
    }
    assert.ok(graph.nodes.every(n => n.position.surface && n.position.parent && n.name), entry.id)
  }
})
test('expanded graphs retain unique nodes and all parent/edge references', () => {
  for (const entry of entries.filter(e => !e.overview)) {
    const graph = buildConfigGraph(entry, entries, { expanded: true })
    const ids = new Set(graph.nodes.map(node => node.id))
    assert.equal(ids.size, graph.nodes.length, entry.id)
    for (const node of graph.nodes) if (node.parentId) assert.ok(ids.has(node.parentId), entry.id)
    for (const link of graph.edges) assert.ok(ids.has(link.source) && ids.has(link.target), link.id)
  }
  const timing = buildConfigGraph(entryMap.get('min-pd-cycle-time'), entries, { expanded: true })
  assert.ok(timing.nodes.some(n => n.id === 'max-pd-cycle-time'))
  assert.ok(timing.edges.some(e => e.label === 'MIN ≤ MAX'))
})
test('layout directions stay deterministic and node boxes do not overlap', async () => {
  const graph = buildConfigGraph(entryMap.get('max-pd-output-size'), entries, { expanded: true })
  for (const preference of ['horizontal', 'vertical']) {
    const layout = await layoutConfigGraph(graph, preference)
    assert.equal(layout.direction, preference === 'horizontal' ? 'LR' : 'TB')
    for (const [i, a] of layout.nodes.entries()) for (const b of layout.nodes.slice(i + 1)) assert.ok(a.x + NODE_WIDTH <= b.x || b.x + NODE_WIDTH <= a.x || a.y + NODE_HEIGHT <= b.y || b.y + NODE_HEIGHT <= a.y, `${a.id} overlaps ${b.id}`)
    assert.deepEqual(layout, await layoutConfigGraph(graph, preference))
  }
  assert.equal((await layoutConfigGraph(graph, 'auto', 390, 600)).direction, 'TB')
})
