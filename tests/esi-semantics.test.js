import test from 'node:test'
import assert from 'node:assert/strict'
import { DOMParser } from '@xmldom/xmldom'
import { esiExamples } from '../src/data/esi-examples.js'
import { applicationWorkbooks } from '../src/data/application-workbooks.js'
import { checkEsiField, esiFieldRule } from '../src/data/esi-field-rules.js'
import { attr, child, children, esiBool, esiNumber, esiScope, moduleInstance, parseEsiXml, text } from '../src/lib/esi-model.js'
import { esiFieldRows } from '../src/lib/esi-display-model.js'
import { buildEsiFieldGraph } from '../src/lib/esi-field-graph.js'

const parse = xml => parseEsiXml(xml, DOMParser)
const example = id => esiExamples.find(item => item.id === id)

test('MDP F000 describes its subindices and agrees with slots and the application example', () => {
  const document = parse(example('modules').xml), scope = esiScope(document)
  const object = scope.objects.find(item => item.index === 0xF000)
  assert.ok(object.datatype, 'F000 must reference a composite type')
  assert.deepEqual(object.members.map(member => [member.subIndex, member.type, member.bits]), [[0, 'USINT', 8], [1, 'UINT', 16], [2, 'UINT', 16]])
  const info = children(child(object.node, 'Info'), 'SubItem')
  const data = si => text(child(info.find(item => text(item, 'Name') === `SubIndex ${String(si).padStart(3, '0')}`), 'Info'), 'DefaultData')
  assert.equal(Buffer.from(data(0), 'hex').readUInt8(), 2)
  const distance = Buffer.from(data(1), 'hex').readUInt16LE()
  const maximum = Buffer.from(data(2), 'hex').readUInt16LE()
  assert.equal(distance, esiNumber(attr(scope.slotsNode, 'SlotIndexIncrement')))
  assert.equal(maximum, scope.slots.reduce((sum, slot) => sum + esiNumber(slot.max), 0))
  const rows = applicationWorkbooks.find(book => book.id === 'mdp-io').sheets.find(sheet => sheet.role === 'base').rows
  const head = rows.findIndex(row => row.values.B === '0xF000')
  assert.equal(rows[head].values.C, 'RECORD')
  assert.equal(esiNumber(rows[head + 1].values.G), distance)
  assert.equal(esiNumber(rows[head + 2].values.G), maximum)
})

function assertDefaultSm(scope, bitsByDirection, label) {
  for (const [direction, purpose] of [['Rx', 'Outputs'], ['Tx', 'Inputs']]) {
    const sm = scope.sms.find(item => item.value === purpose)
    const bytes = Math.ceil(bitsByDirection[direction] / 8)
    assert.equal(esiNumber(attr(sm, 'DefaultSize')), bytes, `${label}: ${purpose} default bytes`)
    assert.equal(esiBool(attr(sm, 'Enable')), bytes > 0, `${label}: ${purpose} default activation`)
    assert.ok(bytes <= esiNumber(attr(sm, 'MaxSize')), label)
  }
}

test('each fixed standalone revision has a consistent default PDO length and SM activation', () => {
  for (const sample of esiExamples.filter(item => item.id !== 'modules')) {
    const document = parse(sample.xml)
    for (const device of document.devices) {
      const scope = esiScope(document, device.id), bits = { Rx: 0, Tx: 0 }
      for (const pdo of scope.pdos) {
        assert.equal(esiBool(pdo.mandatory), true, 'these fixtures declare all PDOs mandatory')
        assert.equal(esiBool(pdo.fixed), true)
        bits[pdo.direction] += pdo.bits
      }
      assertDefaultSm(scope, bits, device.name)
    }
  }
})

test('default selected modules agree with the device default SM lengths', () => {
  const document = parse(example('modules').xml), scope = esiScope(document), bits = { Rx: 0, Tx: 0 }
  for (const slot of scope.slots) {
    const defaults = slot.allowed.filter(item => item.isDefault)
    assert.equal(defaults.length, 1)
    const instance = moduleInstance(document, slot, defaults[0].value)
    assert.equal(instance.valid, true)
    for (const pdo of instance.pdos) {
      bits[pdo.direction] += children(pdo.node, 'Entry').reduce((sum, entry) => sum + esiNumber(text(entry, 'BitLen')), 0)
    }
  }
  assertDefaultSm(scope, bits, 'default slots, not every candidate module')
})

function mappingRow(value) {
  const document = parse(example('io').xml.replace('<PdoMapping>R</PdoMapping>', `<PdoMapping>${value}</PdoMapping>`))
  const scope = esiScope(document), node = scope.objects.find(item => item.index === 0x7000).node
  const context = { document, scope, ownerScope: { ...scope, owner: scope.device, kind: 'device' }, node }
  return { context, row: esiFieldRows(context).find(item => item.node.name === 'PdoMapping') }
}

test('R/T and both RT/TR preserve every mapping direction in field associations and graphs', () => {
  for (const [value, contracts] of [['R', ['pdo-output']], ['T', ['pdo-input']], ['RT', ['pdo-output', 'pdo-input']], ['TR', ['pdo-output', 'pdo-input']]]) {
    const { context, row } = mappingRow(value)
    assert.equal(row.raw, value)
    assert.deepEqual(row.associations.map(item => item.contractId), contracts, value)
    assert.equal(new Set(row.associations.map(item => item.title)).size, contracts.length, 'directions must be distinguishable')
    const graph = buildEsiFieldGraph(row, context)
    assert.equal(graph.nodes.filter(node => node.targetRef).length, contracts.length)
    assert.equal(graph.edges.length, contracts.length)
    assert.ok(graph.edges.every(edge => edge.kind === 'describe'), 'capability correspondence does not claim a literal cross-file conversion')
  }
})

test('unknown, empty or malformed mapping flags stay unresolved without a guessed Rx association', () => {
  for (const value of ['', 'r', 'RX', 'RRT', 'future']) {
    const { row } = mappingRow(value)
    assert.equal(row.raw, value)
    assert.equal(checkEsiField(row.node).state, 'unparsed', value)
    assert.deepEqual(row.associations, [], value)
  }
})

test('mapping field reference lists both supported bidirectional spellings', () => {
  const { row } = mappingRow('RT'), rule = esiFieldRule(row.node)
  for (const value of ['R', 'T', 'RT', 'TR']) assert.ok(rule.examples.includes(value), value)
})
