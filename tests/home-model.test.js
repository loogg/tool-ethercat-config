import test from 'node:test'
import assert from 'node:assert/strict'
import { entries, entryMap } from '../src/data/index.js'
import { homeModel } from '../src/lib/home-model.js'
import { parseRoute, resolveRoute } from '../src/lib/library.js'

test('home offers foundations first and three independent configuration entrypoints', () => {
  const home = homeModel(entries)
  assert.deepEqual(home.entrypoints.map(item => item.id), ['concepts', 'SSC', 'APP', 'ESI'])
  assert.deepEqual(home.entrypoints.map(item => item.target.id), ['learn-overview', 'ssc-overview', 'application-overview', 'esi-overview'])
  for (const item of [...home.entrypoints, ...home.topics]) {
    const route = resolveRoute(parseRoute(item.target.href), entryMap)
    assert.equal(route.id, item.target.id)
    assert.ok(entryMap.has(route.id))
  }
  assert.equal(home.topics.length, 6)
  assert.equal(home.calculators.length, 5)
  for (const item of home.calculators) {
    assert.equal(parseRoute(item.target.href).view, 'calculators')
    assert.equal(parseRoute(item.target.href).id, item.id)
  }
})

test('home recent items only project unique real reading records without filling an empty list', () => {
  assert.deepEqual(homeModel(entries).recent, [])
  const ids = ['unknown', 'sdo', 'sdo', 'esi-entry', 'learn-roles', 'xlsx-data-type', 'dc-supported']
  const recent = homeModel(entries, ids).recent
  assert.deepEqual(recent.map(item => item.id), ['sdo', 'esi-entry', 'learn-roles', 'xlsx-data-type'])
  assert.ok(recent.every(item => item.target.href && item.collection))
})

test('the empty route opens Home while every explicit entry deep link retains its meaning', () => {
  assert.equal(parseRoute('').view, 'home')
  assert.equal(parseRoute('').id, '')
  assert.equal(parseRoute('#/home').view, 'home')
  for (const id of ['ssc-overview', 'application-overview', 'esi-overview', 'learn-overview', 'pdo-mapping']) assert.equal(resolveRoute(parseRoute(`#/entry/${id}`), entryMap).id, id)
})
