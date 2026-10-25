import test from 'node:test'
import assert from 'node:assert/strict'
import { entries } from '../src/data/index.js'
import { categories, calculatorLabels, createSearchIndex, searchEntries } from '../src/lib/library.js'

test('content has complete identifiers, source evidence and resolvable cross references', () => {
  assert.ok(entries.length >= 100, 'Expected coverage of all three configuration surfaces')
  const ids = new Set(entries.map(e => e.id))
  assert.equal(ids.size, entries.length, 'Duplicate article ID')
  const cat = new Set(categories.map(c => c.id))
  for (const e of entries) {
    assert.match(e.id, /^[a-z0-9-]+$/, e.id)
    assert.ok(e.name && e.title && e.summary, `${e.id}: missing identity or explanation`)
    assert.ok(cat.has(e.category), `${e.id}: unknown category ${e.category}`)
    assert.ok(e.sources?.length, `${e.id}: no location`)
    assert.ok(e.references?.length, `${e.id}: no evidence`)
    assert.ok(e.details?.length || e.rules?.length, `${e.id}: no useful content`)
    for (const ref of e.references) assert.match(ref.url, /^https:\/\//, `${e.id}: invalid reference`)
    for (const r of e.relations || []) assert.ok(ids.has(r.target), `${e.id} → missing ${r.target}`)
    if (e.calculator) assert.ok(Object.hasOwn(calculatorLabels, e.calculator), `${e.id}: unknown calculator`)
  }
})

test('published references omit private workspace note links while retaining public evidence', () => {
  for (const entry of entries) {
    assert.ok(entry.references.length > 0, entry.id)
    for (const reference of entry.references) assert.doesNotMatch(new URL(reference.url).hostname, /(^|\.)(notion\.com|notion\.so)$/, entry.id)
  }
})
test('all main categories and content sources are populated', () => {
  for (const c of categories.filter(c => c.id !== 'all')) assert.ok(entries.some(e => e.category === c.id), c.id)
  for (const kind of ['SSC', 'XLSX', 'ESI', 'CoE', 'ESC']) assert.ok(entries.some(e => e.sources.some(s => s.kind === kind)), kind)
})
test('real engineering queries reach expected articles', () => {
  const index = createSearchIndex(entries)
  assert.equal(searchEntries(index, { query: 'MAX_PD_OUTPUT_SIZE' })[0].id, 'max-pd-output-size')
  assert.ok(searchEntries(index, { query: '0x1C12' }).some(e => ['pdo-assignment', 'sm2'].includes(e.id)))
  assert.ok(searchEntries(index, { query: 'ControlByte' }).some(e => e.id === 'esi-sm'))
  assert.ok(searchEntries(index, { query: 'CoeRead' }).some(e => e.id === 'xlsx-coe-read'))
})
