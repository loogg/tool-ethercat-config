import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationWorkbooks } from '../src/data/application-workbooks.js'
import { entries, entryMap } from '../src/data/index.js'
import { applicationColumns, applicationContext, applicationStructure, buildApplicationRelations, buildSheetModel, fieldOccurrence, filterApplicationObjects, generatedSubindex, getSlots, metadataValue, resolveModuleInstance } from '../src/lib/application-model.js'
import { parseRoute, resolveRoute, routeHash } from '../src/lib/library.js'

const mdp = applicationWorkbooks.find(book => book.id === 'mdp-io')
const syntaxFixture = { id: 'test-fixture', filename: '语法测试夹具', sheets: [{ id: 'Profile', name: 'Profile', role: 'application', metadata: [], rows: [
  { number: 18, kind: 'object', values: { B: '0x2000', C: 'VARIABLE', E: 'UINT16', F: 'SamplePeriod', G: 10 } },
  { number: 56, kind: 'object', values: { B: '0xF000', C: 'RECORD', F: 'Modular Device Profile' } },
  { number: 57, kind: 'member', values: { D: 1, E: 'UINT16', F: 'Index distance', G: '0x10' } },
  { number: 58, kind: 'member', values: { D: 2, E: 'UINT16', F: 'Maximum number of modules', G: null } },
] }] }

test('physical rows preserve object ownership and blank values without inventing members', () => {
  const model = buildSheetModel(syntaxFixture, syntaxFixture.sheets[0])
  assert.deepEqual(model.objects.map(object => object.index), [0x2000, 0xF000])
  assert.equal(model.objects[0].code, 'VARIABLE')
  assert.equal(model.objects[0].members.length, 0)
  assert.equal(model.objects[1].members[1].values.G, null)
  assert.equal(model.rows.find(row => row.number === 58).object.index, 0xF000)
  assert.deepEqual(getSlots(syntaxFixture), [])
})

test('header meaning follows its label and worksheet role rather than a hardcoded C3', () => {
  assert.equal(metadataValue(mdp.sheets[0], 'IndexIncrement').cell, 'C3')
  assert.equal(metadataValue(mdp.sheets[2], 'Module Ident').cell, 'C3')
  assert.equal(metadataValue(mdp.sheets[2], 'IndexIncrement').cell, 'C4')
  assert.equal(metadataValue(mdp.sheets[0], 'Module Ident'), undefined)
  const context = applicationContext({ sheet: 'Digital_Output', field: 'header:Module Ident' })
  assert.equal(fieldOccurrence(context, entries).address, '')
})

test('member filtering keeps the parent and original SI0 while narrowing the visible members', () => {
  const model = buildSheetModel(mdp, mdp.sheets[2])
  const filtered = filterApplicationObjects(model, 'LED1')
  assert.equal(filtered[0].index, 0x7000)
  assert.deepEqual(filtered[0].visibleMembers.map(row => row.number), [13])
  assert.equal(generatedSubindex(filtered[0]).values.G, 2)
  assert.equal(filterApplicationObjects(model, 'not-found').length, 0)
})

test('generated SI0 remains separate from source rows and VARIABLE values', () => {
  const model = buildSheetModel(syntaxFixture, syntaxFixture.sheets[0])
  assert.equal(generatedSubindex(model.objects[0]), null)
  const si0 = generatedSubindex(model.objects[1])
  assert.equal(si0.kind, 'generated')
  assert.equal(si0.values.D, 0)
  assert.equal(si0.values.G, 2)
  assert.equal(si0.values.E, 'UINT8')
  assert.equal(si0.protocol.logicalBits, 8)
  assert.equal(si0.protocol.type, 'UNSIGNED8')
  assert.equal(model.rows.length, 4)
  const occurrence = fieldOccurrence({ workbook: syntaxFixture, sheet: syntaxFixture.sheets[0], row: si0, field: 'G' }, entries)
  assert.equal(occurrence.source, '')
  assert.equal(occurrence.generated, true)
  assert.ok(occurrence.notes.some(note => note.includes('原文件中没有')))
})

test('shipped examples cover ordinary and modular applications without project data', () => {
  assert.deepEqual(applicationWorkbooks.map(book => book.id), ['direct-io', 'single-module', 'mdp-io'])
  assert.equal(applicationWorkbooks[0].sourceType, 'teaching')
  assert.ok(!/JKB|RunningImage|io-boot/.test(JSON.stringify(applicationWorkbooks)))
})

test('application organization is independent from worksheet and module instance counts', () => {
  const direct = applicationWorkbooks[0]
  assert.equal(applicationStructure(direct).kind, 'direct')
  assert.equal(applicationStructure({ ...direct, sheets: [...direct.sheets, { ...direct.sheets[0], id: 'Second' }] }).kind, 'direct')
  const oneSlot = structuredClone(mdp)
  oneSlot.sheets[0].rows = oneSlot.sheets[0].rows.filter(row => row.number !== 18)
  assert.equal(applicationStructure(oneSlot).slots.length, 1)
  assert.equal(applicationStructure(oneSlot).kind, 'modular')
  assert.equal(applicationStructure(mdp).slots.length, 2)
  const single = applicationWorkbooks.find(book => book.id === 'single-module')
  assert.equal(applicationStructure(single).kind, 'modular')
  assert.equal(applicationStructure(single).modules.length, 1)
  assert.equal(applicationStructure(single).slots.length, 1)
  assert.deepEqual(resolveModuleInstance(single, getSlots(single)[0]).objects.map(object => object.resolvedIndex), [0x6000,0x7000])
  const context = applicationContext({ workbook: 'direct-io', row: '12', field: 'B' })
  const graph = buildApplicationRelations(context, fieldOccurrence(context, entries), entries)
  assert.ok(graph.nodes.some(node => node.id === 'direct-address'))
  assert.ok(!graph.nodes.some(node => node.id === 'slot'))
})

test('F030 annotations resolve allowed and default modules by identity', () => {
  const slots = getSlots(mdp)
  assert.deepEqual(slots.map(slot => [slot.ordinal, slot.name, slot.allowed, slot.defaultIdent]), [[0, 'Input Slot', [0x4711], 0x4711], [1, 'Output Slot', [0x4712], 0x4712]])
  assert.deepEqual(slots.map(slot => resolveModuleInstance(mdp, slot).module.name), ['Digital_Input', 'Digital_Output'])
})

test('slot expansion uses the base increment and does not assert an unprovided PDO mapping', () => {
  const slots = getSlots(mdp)
  assert.equal(resolveModuleInstance(mdp, slots[0]).objects[0].resolvedIndex, 0x6000)
  const output = resolveModuleInstance(mdp, slots[1])
  assert.equal(output.objects[0].index, 0x7000)
  assert.equal(output.objects[0].resolvedIndex, 0x7010)
  assert.equal(output.pdoIndex, null)
  const copy = structuredClone(mdp)
  metadataValue(copy.sheets[2], 'IndexIncrement').value = '0x900'
  assert.equal(resolveModuleInstance(copy, getSlots(copy)[1]).objects[0].resolvedIndex, 0x7010)
  metadataValue(copy.sheets[2], 'IndexIncrement').value = '0'
  assert.equal(resolveModuleInstance(copy, getSlots(copy)[1]).objects[0].resolvedIndex, 0x7000)
})

test('missing step and overflowing expansion cannot produce a healthy instance', () => {
  const copy = structuredClone(mdp)
  metadataValue(copy.sheets[0], 'IndexIncrement').value = null
  let result = resolveModuleInstance(copy, getSlots(copy)[1])
  assert.equal(result.objects[0].resolvedIndex, null)
  assert.equal(result.valid, false)
  metadataValue(copy.sheets[0], 'IndexIncrement').value = '0xF000'
  result = resolveModuleInstance(copy, getSlots(copy)[1])
  assert.equal(result.valid, false)
})

test('unresolved or disallowed module references do not silently pick another sheet', () => {
  const copy = structuredClone(mdp)
  const row = copy.sheets[0].rows.find(row => row.number === 18)
  row.values.G = '0x9999'
  assert.equal(resolveModuleInstance(copy, getSlots(copy)[1]).module, null)
  row.values.G = '0x4711'
  assert.equal(resolveModuleInstance(copy, getSlots(copy)[1]).valid, false)
})

test('record access and member access keep their independent scope', () => {
  const head = fieldOccurrence(applicationContext({ sheet: 'Digital_Output', field: 'L', row: '12' }), entries)
  const member = fieldOccurrence(applicationContext({ sheet: 'Digital_Output', field: 'L', row: '13' }), entries)
  assert.equal(head.value, 'ro')
  assert.equal(head.scope, '对象头')
  assert.ok(head.summary.includes(':00'))
  assert.equal(member.value, 'rw')
  assert.equal(member.address, '0x7000:01')
  assert.equal(member.scope, '对象成员')
})

test('an inherited object index points to the source head without filling a blank source cell', () => {
  const occurrence = fieldOccurrence(applicationContext({ sheet: 'Digital_Output', field: 'B', row: '13' }), entries)
  assert.equal(occurrence.value, null)
  assert.equal(occurrence.source, 'B13')
  assert.equal(occurrence.address, '0x7000:01')
  assert.ok(occurrence.notes[0].includes('B12'))
})

test('all old APP field links still select an explained field in the workbook view', () => {
  for (const entry of entries.filter(entry => entry.collection === 'APP' && !entry.overview)) {
    const context = applicationContext({}, entry.id)
    assert.equal(context.selection, true, entry.id)
    assert.equal(fieldOccurrence(context, entries).entry?.id, entry.id)
  }
})

test('local graphs have valid endpoints and only real cross-reference targets for every source field', () => {
  for (const book of applicationWorkbooks) for (const sheet of book.sheets) {
    for (const row of sheet.rows) for (const column of applicationColumns) {
      const context = applicationContext({ workbook: book.id, sheet: sheet.id, row: String(row.number), field: column.key })
      const graph = buildApplicationRelations(context, fieldOccurrence(context, entries))
      const ids = new Set(graph.nodes.map(node => node.id))
      assert.equal(ids.size, graph.nodes.length)
      for (const edge of graph.edges) assert.ok(ids.has(edge.source) && ids.has(edge.target))
      for (const node of graph.nodes) if (node.entryId) assert.ok(entryMap.has(node.entryId), node.entryId)
    }
  }
  const context = applicationContext({ sheet: 'Digital_Output', row: '13', field: 'M' })
  const graph = buildApplicationRelations(context, fieldOccurrence(context, entries))
  assert.ok(graph.nodes.some(node => node.title === 'RxPDO 可映射'))
  assert.equal(graph.nodes.find(node => node.id === 'mapping').value, '待核对')
  assert.ok(!graph.nodes.some(node => node.id === 'resolved'))
  const nameContext = applicationContext({ sheet: 'Digital_Output', row: '13', field: 'F' })
  const nameGraph = buildApplicationRelations(nameContext, fieldOccurrence(nameContext, entries), entries)
  assert.ok(!nameGraph.nodes.some(node => /^xlsx-/.test(node.title)))
  for (const field of ['header:IndexIncrement', 'header:PdoIndexIncrement']) {
    const context = applicationContext({ sheet: 'Base_Device', field })
    const graph = buildApplicationRelations(context, fieldOccurrence(context, entries))
    assert.ok(graph.nodes.some(node => node.id === 'slot-1-result'))
    assert.ok(graph.nodes.some(node => node.id === 'slot-2-result'))
    if (field === 'header:IndexIncrement') assert.equal(graph.nodes.find(node => node.id === 'slot-2-result').value, '0x7010')
    else assert.equal(graph.nodes.find(node => node.id === 'slot-2-result').value, '待核对生成结果')
  }
})

test('workbook, worksheet and cell deep links round-trip and tolerate stale context', () => {
  const route = resolveRoute(parseRoute('#/entry/xlsx-access?workbook=mdp-io&sheet=Digital_Output&row=13&field=L&appPane=table'), entryMap)
  assert.deepEqual(resolveRoute(parseRoute(routeHash(route)), entryMap), route)
  assert.equal(applicationContext(route).row.number, 13)
  const fallback = applicationContext({ workbook: 'missing', sheet: 'missing', row: '999', field: 'Z', appPane: 'bad' })
  assert.equal(fallback.workbook.id, 'direct-io')
  assert.equal(fallback.sheet.id, 'Profile')
  assert.equal(fallback.field, 'B')
  assert.equal(fallback.mode, 'table')
})
