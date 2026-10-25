import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationFieldSpecs, applicationAccessOptions, applicationDataTypes } from '../src/data/application-field-specs.js'
import { applicationColumns } from '../src/lib/application-model.js'

test('every workbook column has supported input forms, scope, blank semantics and evidence', () => {
  for (const column of applicationColumns) {
    const spec = applicationFieldSpecs[column.key]
    assert.ok(spec?.scope && spec.blank && spec.section, column.key)
    assert.ok(spec.options.length && spec.examples.length, column.name)
    assert.equal(new Set(spec.options.map(option => option.syntax)).size, spec.options.length)
  }
})

test('access lists basic and all ten documented state-related permissions', () => {
  const tokens = applicationAccessOptions.map(option => option.syntax)
  assert.equal(tokens.length, 13)
  for (const state of ['preop','safeop','op','preop_safeop','safeop_op']) {
    assert.ok(tokens.includes(`rd_${state}`))
    assert.ok(tokens.includes(`wr_${state}`))
  }
  assert.ok(applicationFieldSpecs.L.examples.includes('ro,wr_preop'))
})

test('types cover scalar, bit, string, array, padding and enum grammars with exact 64bit ranges', () => {
  for (const token of ['BOOL / BIT','UINT / UINT16','REAL','STRING(n)','ARRAY [0..n] OF BYTE','pad_x','DTxxxxENyy']) assert.ok(applicationDataTypes.some(option => option.syntax === token), token)
  for (let i=1; i<=8; i++) assert.ok(applicationDataTypes.some(option => option.syntax === `BIT${i}` && option.bits === String(i)))
  assert.ok(applicationDataTypes.find(option => option.syntax === 'ULINT / UINT64').meaning.includes('18446744073709551615'))
  assert.ok(applicationDataTypes.find(option => option.syntax === 'LINT / INT64').meaning.includes('-9223372036854775808'))
  assert.ok(applicationFieldSpecs.D.examples.includes('1..15'))
  assert.deepEqual(applicationFieldSpecs.C.options.map(option => option.syntax), ['VARIABLE','ARRAY','RECORD'])
})
