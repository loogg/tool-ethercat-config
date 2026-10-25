import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeSscObjectLayout } from '../src/lib/ssc-object-layout.js'
import { calculateBitLayout } from '../src/lib/calculations.js'
import { sscLayoutExamples } from '../src/data/ssc-layout-examples.js'
import { applicationWorkbooks } from '../src/data/application-workbooks.js'
import { applicationContext, applicationStructure, buildApplicationRelations, fieldOccurrence, metadataValue } from '../src/lib/application-model.js'
import { entries } from '../src/data/index.js'
import { applicationFieldSpecs } from '../src/data/application-field-specs.js'

const fields = bits => bits.map((bits,i) => ({ id: i, name: `Member${i}`, bits }))

test('ordinary template retains explicit zero increments without becoming modular', () => {
  const ordinary = applicationWorkbooks.find(book => book.id === 'direct-io')
  for (const key of ['IndexIncrement','PdoIndexIncrement']) {
    const header = metadataValue(ordinary.sheets[0], key)
    assert.equal(header.value, 0)
    const context = applicationContext({ workbook: ordinary.id, field: `header:${key}` })
    const occurrence = fieldOccurrence(context, entries)
    assert.equal(occurrence.display, '0')
    const graph = buildApplicationRelations(context, occurrence, entries)
    assert.ok(graph.nodes.some(node => node.id === 'direct-context'))
    assert.ok(!graph.nodes.some(node => node.id === 'slot'))
    assert.ok(applicationFieldSpecs[`header:${key}`].options.some(option => option.syntax === '0'))
  }
  assert.equal(metadataValue(ordinary.sheets[0], 'IndexIncrement').cell, 'C3')
  assert.equal(metadataValue(ordinary.sheets[0], 'PdoIndexIncrement').cell, 'C4')
  assert.equal(applicationStructure(ordinary).kind, 'direct')
  for (const book of applicationWorkbooks) for (const sheet of book.sheets) {
    assert.ok(metadataValue(sheet, 'IndexIncrement'), `${book.id}/${sheet.id}`)
    assert.ok(metadataValue(sheet, 'PdoIndexIncrement'), `${book.id}/${sheet.id}`)
  }
})

test('8bit itself cannot cross a byte, even when the enclosing 16bit block is full', () => {
  const result = analyzeSscObjectLayout(fields([4,8,4]))
  assert.equal(result.layout.totalBits, 16)
  assert.ok(result.issues.some(issue => issue.code === 'small-crosses-byte' && issue.rowIds[0] === 1))
  assert.equal(analyzeSscObjectLayout(fields([8,8])).valid, true)
})

test('larger fields need WORD-aligned starts, not DWORD alignment for every 32bit field', () => {
  assert.ok(analyzeSscObjectLayout(fields([8,16])).issues.some(issue => issue.code === 'large-not-word'))
  assert.equal(analyzeSscObjectLayout(fields([16,32])).valid, true)
})

test('small groups are checked in the middle as well as at the end', () => {
  const result = analyzeSscObjectLayout(fields([8,16,8]))
  assert.equal(result.groups.length, 2)
  assert.equal(result.issues.filter(issue => issue.code === 'small-group-incomplete').length, 2)
  assert.ok(result.issues.some(issue => issue.code === 'small-group-start'))
})

test('a 32bit total cannot hide a small group beginning halfway through a WORD', () => {
  const result = analyzeSscObjectLayout(fields([24,8]))
  assert.equal(result.layout.totalBits, 32)
  assert.ok(result.issues.some(issue => issue.code === 'small-group-start'))
  assert.equal(result.valid, false)
})

test('all corrected examples satisfy the rules while preserving payload and source sequences', () => {
  for (const example of sscLayoutExamples) {
    const original = structuredClone(example.raw)
    assert.equal(analyzeSscObjectLayout(example.raw).valid, false, example.id)
    const aligned = analyzeSscObjectLayout(example.aligned)
    assert.equal(aligned.valid, true, example.id)
    assert.equal(example.raw.reduce((n,f) => n+f.bits,0), example.aligned.filter(f=>!f.padding).reduce((n,f)=>n+f.bits,0))
    assert.ok(aligned.layout.rows.filter(row=>row.padding).every(row=>row.bitLength<=8 && !row.smallFieldCrossesByte))
    assert.deepEqual(example.raw, original)
  }
})

test('PDO offsets remain continuous; SSC analysis never inserts padding', () => {
  const input = fields([5,4,16])
  const pdo = calculateBitLayout(input)
  const ssc = analyzeSscObjectLayout(input)
  assert.deepEqual(pdo.rows.map(row=>row.bitOffset), [0,5,9])
  assert.deepEqual(ssc.layout.rows.map(row=>row.bitOffset), [0,5,9])
  assert.equal(pdo.totalBits, 25)
})

test('local-entry analysis does not reuse the 255bit mapping limit or report an empty sequence as passing', () => {
  assert.equal(analyzeSscObjectLayout(fields([1024])).valid, true)
  assert.throws(()=>calculateBitLayout(fields([1024])))
  assert.equal(analyzeSscObjectLayout([]).valid, false)
  assert.equal(analyzeSscObjectLayout([]).empty, true)
})
