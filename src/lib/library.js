export const categories = [
  { id: 'all', label: '全部配置', icon: 'grid' },
  { id: 'identity', label: '设备身份', icon: 'identity' },
  { id: 'object', label: '对象字典', icon: 'object' },
  { id: 'pdo', label: 'PDO 与映射', icon: 'pdo' },
  { id: 'sync', label: '同步与时序', icon: 'sync' },
  { id: 'mailbox', label: 'Mailbox 邮箱', icon: 'mailbox' },
  { id: 'hardware', label: '硬件与存储', icon: 'hardware' },
  { id: 'state', label: '状态与诊断', icon: 'state' },
  { id: 'esi', label: 'ESI 设备描述', icon: 'esi' },
]

export const sourceLabels = { SSC: 'SSC Tool', XLSX: '应用定义', ESI: 'ESI', CoE: 'CoE', ESC: 'ESC' }
export const calculatorLabels = { mapping: 'PDO 映射编解码', layout: 'PDO 位布局', memory: 'SM 内存规划', watchdog: '看门狗时间', control: 'SM 控制字节' }

export function normalize(value) {
  return String(value).toLowerCase().replace(/#x/g, '0x').replace(/[\s_\-:：/]/g, '')
}

export function createSearchIndex(entries) {
  return entries.map(entry => ({
    entry,
    name: normalize(entry.name),
    titles: normalize(`${entry.name} ${entry.title} ${(entry.aliases || []).join(' ')}`),
    text: normalize([entry.name, entry.title, entry.summary, ...(entry.aliases || []), ...(entry.details || []), ...(entry.rules || []), ...(entry.sources || []).map(s => s.path), ...(entry.facts || []).map(f => `${f.label} ${f.value}`)].join(' ')),
  }))
}

export function isEntryInScope(entry, { collection = 'all', group = '' } = {}) {
  return (collection === 'all' || entry.collection === collection) &&
    (!group || entry.group === group || entry.group?.startsWith(`${group}/`))
}

export function searchEntries(index, { query = '', category = 'all', source = 'all', collection = 'all', group = '', ids = null } = {}) {
  const terms = query.trim().split(/\s+/).filter(Boolean).map(normalize)
  const full = normalize(query)
  return index.filter(({ entry, text }) =>
    isEntryInScope(entry, { collection, group }) &&
    (category === 'all' || entry.category === category) &&
    (source === 'all' || entry.sources.some(s => s.kind === source)) &&
    (!ids || ids.includes(entry.id)) && terms.every(t => text.includes(t)),
  ).map(item => ({ ...item, score: !full ? 0 : item.name === full ? 100 : item.name.startsWith(full) ? 70 : item.titles.includes(full) ? 50 : 10 }))
    .sort((a, b) => b.score - a.score).map(item => item.entry)
}

export function getRelations(entry, entries) {
  const byId = new Map(entries.map(e => [e.id, e]))
  const outgoing = (entry.relations || []).filter(r => byId.has(r.target)).map(r => ({ ...r, entry: byId.get(r.target), incoming: false }))
  const outgoingIds = new Set(outgoing.map(r => r.target))
  const inverse = { '引用': '被引用', '依赖': '被依赖', '影响': '影响来源', '约束': '约束来源', '对应': '对应', '关联': '关联', '配套': '配套', '区别于': '区别于', '区分': '区分', '协同': '协同', '实现': '实现来源', '初始化': '初始值来源' }
  const incoming = entries.flatMap(other => (other.relations || []).filter(r => r.target === entry.id && !outgoingIds.has(other.id))
    .map(r => ({ target: other.id, type: r.type.startsWith('被') ? r.type.slice(1) : inverse[r.type] || '反向关联', description: r.description, entry: other, incoming: true })))
  return [...outgoing, ...incoming]
}

export function readStoredList(key, storage) {
  try { const value = JSON.parse((storage || globalThis.localStorage).getItem(key)); return Array.isArray(value) ? [...new Set(value.filter(v => typeof v === 'string'))] : [] } catch { return [] }
}

export function writeStoredList(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}

export function parseRoute(hash) {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const [view, rawId] = path.split('/')
  let id
  try { id = decodeURIComponent(rawId || '') } catch { id = '' }
  const params = new URLSearchParams(query)
  const supported = ['entry', 'search', 'calculators', 'saved', 'recent', 'about']
  const category = params.get('category') || 'all'
  const source = params.get('source') || 'all'
  const resolvedView = supported.includes(view) ? view : 'entry'
  const collection = params.get('collection') || (resolvedView === 'entry' ? (id ? '' : 'SSC') : 'all')
  const knownCollection = collections.find(item => item.id === collection)
  const group = params.get('group') || ''
  const pane = params.get('pane')
  return {
    view: resolvedView,
    id: id || (resolvedView === 'calculators' ? 'mapping' : resolvedView === 'entry' ? 'ssc-overview' : ''),
    query: params.get('q') || '',
    pane: pane === 'list' || pane === 'detail' ? pane : (id || resolvedView === 'entry' ? 'detail' : 'list'),
    collection: knownCollection ? collection : collection === 'all' ? 'all' : '',
    group: knownCollection && getCollectionGroups(knownCollection.id).some(item => item.id === group) ? group : '',
    category: categories.some(c => c.id === category) ? category : 'all',
    source: Object.hasOwn(sourceLabels, source) ? source : 'all',
    ...Object.fromEntries(['workbook', 'sheet', 'row', 'field', 'appPane', 'esi', 'device', 'esiNode', 'esiAttr', 'esiPane'].filter(key => params.has(key)).map(key => [key, params.get(key)])),
  }
}

export function getCollectionGroups(collectionId) {
  const groups = collections.find(item => item.id === collectionId)?.groups || []
  return groups.flatMap(group => [group, ...(group.children || [])])
}

export function getEntryScope(entry) {
  return { collection: entry?.collection || 'concepts', group: entry?.group || '' }
}

/** Resolve legacy links and prevent a related article retaining the wrong folder. */
export function resolveRoute(route, byId) {
  if (route.view === 'entry' && route.query) return { ...route, view: 'search', collection: 'all', group: '', category: 'all', source: 'all' }
  if (route.view !== 'entry') return { ...route, collection: 'all', group: '', category: 'all', source: 'all' }
  const entry = byId.get(route.id)
  if (!entry) return { ...route, collection: route.collection || 'SSC', group: route.group || '' }
  const scope = route.collection && route.collection !== 'all' && isEntryInScope(entry, route) ? { collection: route.collection, group: route.group || '' } : getEntryScope(entry)
  return { ...route, ...scope, category: 'all', source: 'all' }
}

export function routeHash(route) {
  const params = new URLSearchParams()
  if (route.query) params.set('q', route.query)
  if (route.view === 'entry' && route.collection && route.collection !== 'all') params.set('collection', route.collection)
  if (route.view === 'entry' && route.group) params.set('group', route.group)
  if (['entry', 'search', 'saved', 'recent'].includes(route.view)) params.set('pane', route.pane === 'list' ? 'list' : 'detail')
  if (['entry', 'search'].includes(route.view)) for (const key of ['workbook', 'sheet', 'row', 'field', 'appPane', 'esi', 'device', 'esiNode', 'esiAttr', 'esiPane']) if (route[key]) params.set(key, route[key])
  const query = params.size ? `?${params}` : ''
  return `#/${route.view}${route.id ? `/${encodeURIComponent(route.id)}` : ''}${query}`
}

export function entryHash(id, scope = {}) { return routeHash({ view: 'entry', id, ...scope }) }

export function canReturnToList(previous, current) {
  return previous.pane === 'list' && previous.view === current.view &&
    previous.collection === current.collection && previous.group === current.group && previous.query === current.query
}

export function initialRecentList(stored, route, byId) {
  const valid = [...new Set(stored)].filter(id => byId.has(id))
  const reading = ['entry', 'search', 'saved', 'recent'].includes(route.view) && route.pane === 'detail' && byId.has(route.id)
  return (reading ? [route.id, ...valid.filter(id => id !== route.id)] : valid).slice(0, 20)
}
import { collections } from '../data/navigation.js'
