import test from 'node:test'
import assert from 'node:assert/strict'
import { createSearchIndex, searchEntries, getRelations, parseRoute, resolveRoute, routeHash, entryHash, getEntryScope, isEntryInScope, getCollectionGroups, sourceLabels, canReturnToList, initialRecentList, readStoredList } from '../src/lib/library.js'
import { entries, entryMap } from '../src/data/index.js'
import { collections, getEntryNavigation } from '../src/data/navigation.js'
import { sscEntries } from '../src/data/ssc.js'
import { dictionaryEntries } from '../src/data/dictionary.js'
import { esiEntries } from '../src/data/esi.js'

const data = [
  { id: 'size', name: 'MAX_PD_OUTPUT_SIZE', title: '最大输出过程数据长度', category: 'pdo', collection: 'SSC', group: 'Application/ProcessData', summary: 'RxPDO 主站输出 从站接收', sources: [{ kind: 'SSC', path: 'Application ProcessData' }], facts: [{ label: '单位', value: 'Byte' }], relations: [{ target: 'map', type: '依赖', description: '映射长度' }] },
  { id: 'map', name: '0x1C12', title: 'SM2 PDO Assignment', category: 'pdo', collection: 'concepts', group: '', summary: '对象分配表', sources: [{ kind: 'CoE', path: '0x1C12:00' }, { kind: 'SSC', path: '相关 SSC 配置' }], aliases: ['pdo assignment'] },
  { id: 'identity', name: 'Vendor', title: '厂商标识', category: 'identity', collection: 'ESI', group: 'identity', summary: '设备身份', sources: [{ kind: 'ESI', path: 'Vendor/Id' }] },
]
const index = createSearchIndex(data)
test('search matches normalized macro and multiple language terms', () => {
  assert.deepEqual(searchEntries(index, { query: 'max pd output' }).map(e => e.id), ['size'])
  assert.equal(searchEntries(index, { query: '主站 输出' })[0].id, 'size')
  assert.equal(searchEntries(index, { query: '#x1c12' })[0].id, 'map')
  assert.equal(searchEntries(index, { query: '0x1c12:00' })[0].id, 'map')
})
test('filters compose and empty queries keep stable order', () => {
  assert.deepEqual(searchEntries(index, { category: 'pdo', source: 'CoE' }).map(e => e.id), ['map'])
  assert.equal(searchEntries(index, { query: 'vendor', category: 'pdo' }).length, 0)
  assert.deepEqual(searchEntries(index, { ids: ['identity'] }).map(e => e.id), ['identity'])
  assert.equal(searchEntries(index, { ids: [] }).length, 0)
})
test('relations expose both source and reverse dependency', () => {
  assert.equal(getRelations(data[0], data)[0].entry.id, 'map')
  const reverse = getRelations(data[1], data)[0]
  assert.equal(reverse.entry.id, 'size'); assert.equal(reverse.type, '被依赖'); assert.equal(reverse.incoming, true)
})
test('route handles invalid escapes and query filters', () => {
  assert.equal(parseRoute('').id, 'ssc-overview')
  assert.equal(parseRoute('').collection, 'SSC')
  assert.equal(parseRoute('#/calculators/memory').id, 'memory')
  assert.equal(parseRoute('#/entry/%ZZ').id, 'ssc-overview')
  assert.equal(parseRoute('#/entry/size?q=PDO&source=SSC').source, 'SSC')
})

test('entity scope uses article ownership rather than every cross-reference source', () => {
  assert.deepEqual(searchEntries(index, { collection: 'SSC' }).map(entry => entry.id), ['size'])
  assert.deepEqual(searchEntries(index, { collection: 'concepts' }).map(entry => entry.id), ['map'])
  assert.deepEqual(searchEntries(index, { collection: 'SSC', group: 'Application' }).map(entry => entry.id), ['size'])
  assert.deepEqual(searchEntries(index, { collection: 'SSC', group: 'Application/ProcessData' }).map(entry => entry.id), ['size'])
  assert.equal(searchEntries(index, { collection: 'SSC', group: 'Hardware' }).length, 0)
  assert.equal(searchEntries(index, { query: 'Vendor' })[0].collection, 'ESI')
})

test('every real entry has one correct entity home and an existing navigation group', () => {
  for (const entry of entries) {
    assert.ok(collections.some(collection => collection.id === entry.collection), entry.id)
    assert.ok(!entry.group || getCollectionGroups(entry.collection).some(group => group.id === entry.group), `${entry.id}: ${entry.group}`)
  }
  for (const entry of sscEntries) assert.equal(entryMap.get(entry.id).collection, 'SSC', entry.id)
  for (const entry of esiEntries) assert.equal(entryMap.get(entry.id).collection, 'ESI', entry.id)
  for (const entry of dictionaryEntries) assert.equal(entryMap.get(entry.id).collection, entry.sources[0].kind === 'XLSX' ? 'APP' : 'concepts', entry.id)
  assert.equal(entryMap.get('object-dictionary').collection, 'concepts')
  assert.equal(entryMap.get('rxpdo').collection, 'concepts')
  assert.equal(entryMap.get('xlsx-modular').group, 'device')
  assert.equal(entryMap.get('xlsx-index').group, 'fields')
  assert.equal(sourceLabels.XLSX, '应用定义')
})

test('SSC tree preserves the requested tool order and Application child hierarchy', () => {
  const groups = collections.find(collection => collection.id === 'SSC').groups
  assert.deepEqual(groups.map(group => group.id), ['SlaveInformation', 'Generic', 'Hardware', 'EtherCAT State Machine', 'Synchronisation', 'Application', 'Mailbox', 'Compiler'])
  assert.deepEqual(groups[5].children, [{ id: 'Application/ProcessData', label: 'ProcessData' }])
  for (const group of groups) assert.ok(entries.some(entry => isEntryInScope(entry, { collection: 'SSC', group: group.id })), group.id)
  assert.equal(entryMap.get('ssc-compiler-overview').overview, true)
  assert.equal(entryMap.get('system-header-file').group, 'Generic')
  assert.equal(entryMap.get('max-pd-output-size').group, 'Application/ProcessData')
  assert.equal(getEntryNavigation({ sources: [{ kind: 'ESI', path: 'Device/Sm/@ControlByte' }] }, 'esi').group, 'communication')
})

test('entity routes survive serialization with parent and child groups intact', () => {
  for (const id of ['max-pd-output-size', 'check-sm-param-alignment', 'xlsx-index', 'esi-sm', 'rxpdo']) {
    const scope = getEntryScope(entryMap.get(id))
    const parsed = resolveRoute(parseRoute(entryHash(id, scope)), entryMap)
    assert.equal(parsed.id, id)
    assert.equal(parsed.collection, scope.collection)
    assert.equal(parsed.group, scope.group)
  }
  const application = resolveRoute(parseRoute('#/entry/max-pd-output-size?collection=SSC&group=Application'), entryMap)
  assert.equal(application.group, 'Application')
  assert.equal(resolveRoute(parseRoute(routeHash(application)), entryMap).group, 'Application')
})

test('related and legacy deep links resolve to the actual entity, not a stale filter', () => {
  const target = resolveRoute(parseRoute('#/entry/esi-sm?collection=SSC&group=Hardware'), entryMap)
  assert.equal(target.collection, 'ESI')
  assert.equal(target.group, 'communication')
  const legacy = resolveRoute(parseRoute('#/entry/xlsx-data-type'), entryMap)
  assert.equal(legacy.collection, 'APP')
  assert.equal(legacy.group, 'fields')
  const conceptual = resolveRoute(parseRoute('#/entry/rxpdo?collection=SSC&group=Application'), entryMap)
  assert.equal(conceptual.collection, 'concepts')
  assert.equal(conceptual.group, '')
})

test('global search preserves query and selection while clearing inherited entity scope', () => {
  const search = resolveRoute(parseRoute('#/search/esi-sm?q=ControlByte&collection=SSC&group=Generic'), entryMap)
  assert.equal(search.view, 'search')
  assert.equal(search.collection, 'all')
  assert.equal(search.group, '')
  assert.equal(search.id, 'esi-sm')
  assert.equal(search.query, 'ControlByte')
  assert.deepEqual(resolveRoute(parseRoute(routeHash(search)), entryMap), search)
  const legacySearch = resolveRoute(parseRoute('#/entry/esi-sm?q=ControlByte&source=SSC'), entryMap)
  assert.equal(legacySearch.view, 'search')
  assert.equal(legacySearch.source, 'all')
  assert.equal(parseRoute('#/saved').id, '')
  assert.equal(parseRoute('#/recent').id, '')
})
test('stored lists reject malformed data and recover storage failure', () => {
  assert.deepEqual(readStoredList('x', { getItem: () => '["a",2,"a","b"]' }), ['a', 'b'])
  assert.deepEqual(readStoredList('x', { getItem: () => 'bad json' }), [])
  assert.deepEqual(readStoredList('x', { getItem: () => { throw Error('denied') } }), [])
})

test('the first result has a distinct detail URL and restores the folder list on Back', () => {
  const list = resolveRoute(parseRoute('#/entry/hw-access-file?collection=SSC&group=Hardware&pane=list'), entryMap)
  const detail = { ...list, pane: 'detail' }
  assert.notEqual(routeHash(list), routeHash(detail))
  assert.equal(parseRoute(routeHash(list)).pane, 'list')
  assert.equal(parseRoute(routeHash(detail)).pane, 'detail')
  assert.equal(canReturnToList(list, detail), true)
  assert.equal(canReturnToList(list, { ...detail, id: 'esc-32bit-access' }), true)
  assert.equal(canReturnToList(list, { ...detail, collection: 'ESI', group: 'communication' }), false)
  assert.equal(canReturnToList({ ...list, pane: 'detail' }, detail), false)
  const searchList = resolveRoute(parseRoute('#/search?q=ControlByte&pane=list'), entryMap)
  assert.equal(canReturnToList(searchList, { ...searchList, id: 'esi-sm', pane: 'detail' }), true)
})

test('opening or refreshing a valid deep link enters recent reading immediately', () => {
  const deepLink = resolveRoute(parseRoute('#/entry/xlsx-access'), entryMap)
  assert.deepEqual(initialRecentList([], deepLink, entryMap), ['xlsx-access'])
  assert.deepEqual(initialRecentList(['esi-sm', 'xlsx-access', 'missing'], deepLink, entryMap), ['xlsx-access', 'esi-sm'])
  assert.deepEqual(initialRecentList([], { ...deepLink, pane: 'list' }, entryMap), [])
  assert.deepEqual(initialRecentList(['esi-sm'], resolveRoute(parseRoute('#/calculators/memory'), entryMap), entryMap), ['esi-sm'])
  assert.deepEqual(initialRecentList([], resolveRoute(parseRoute('#/entry/unknown'), entryMap), entryMap), [])
})
