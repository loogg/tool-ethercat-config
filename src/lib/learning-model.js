import { learningTopics, learningConcepts, learningBindings, legacyLearningTargets, ledPatterns } from '../data/learning.js'
import { calculateBitLayout, encodePdoMapping, formatHex, parseUnsigned, planSmMemory } from './calculations.js'
import { watchdogScenarios, watchdogTiming } from './watchdog-timing.js'

export const learningConceptMap = new Map(learningConcepts.map(item => [item.id, item]))
export const learningBindingMap = new Map(learningBindings.map(item => [item.id, item]))
export function learningTarget(entryId) {
  const topic = learningTopics.find(item => item.entryId === entryId)
  return topic ? { topic: topic.id, scene: topic.scenes[0].id, step: 0 } : legacyLearningTargets[entryId] || null
}
export function learningContext(route, entryId) {
  const target = learningTarget(entryId) || { topic: 'roles', step: 0 }
  const topic = learningTopics.find(item => item.id === target.topic)
  const scene = topic.scenes.find(item => item.id === route.learnScene) || topic.scenes.find(item => item.id === target.scene) || topic.scenes[0]
  const raw = route.learnStep === undefined || route.learnStep === '' ? target.step || 0 : Number(route.learnStep)
  const step = Number.isInteger(raw) ? Math.max(0, Math.min(raw, scene.steps.length - 1)) : 0
  const direction = route.learnDir === 'tx' || (!route.learnDir && target.direction === 'tx') ? 'tx' : 'rx'
  return { topic, scene, step, current: scene.steps[step], direction, channel: target.channel ?? (direction === 'tx' ? 3 : 2) }
}

export function learningSearchContext(entryId, query) {
  const target = learningTarget(entryId)
  if (!target || !query) return {}
  const normalizeTerm = text => String(text).trim().toLowerCase().replace(/\s+/g, '')
  const term = learningConcepts.find(item => item.topic === target.topic && item.aliases.some(alias => normalizeTerm(alias) === normalizeTerm(query)))
  if (!term) return {}
  return { learnScene: term.scene, learnStep: String(term.step), ...(term.id === 'txpdo' ? { learnDir: 'tx' } : term.id === 'rxpdo' ? { learnDir: 'rx' } : {}), ...(['sdo', 'coe'].includes(term.id) ? { learnData: '{"channel":"0"}' } : {}) }
}

export function bindingsForStep(context) {
  const selectedChannel = Number(context.inputs?.channel ?? context.channel)
  const channel = context.scene.id === 'channels' && [0, 1, 2, 3].includes(selectedChannel) ? selectedChannel : context.direction === 'tx' ? 3 : 2
  const tx = channel === 3, mailbox = channel < 2
  const ids = context.current.bindings.map(id => ['output-capacity', 'input-capacity'].includes(id) ? mailbox ? 'mailbox-size' : tx ? 'input-capacity' : 'output-capacity' : ['output-copy', 'input-copy'].includes(id) ? tx ? 'input-copy' : 'output-copy' : id)
  return [...new Set(ids)].map(id => learningBindingMap.get(id)).filter(Boolean).map(binding => {
    if (binding.id === 'esi-sm' || binding.id === 'esi-sm-control') {
      const name = ['MBoxOut', 'MBoxIn', 'Outputs', 'Inputs'][channel]
      return { ...binding, title: binding.id === 'esi-sm' ? `Sm[${name}]` : binding.title, path: binding.path.replace('Sm[Outputs]', `Sm[${name}]`), route: { ...binding.route, esiNode: binding.route.esiNode.replace('/Sm[3]', `/Sm[${channel + 1}]`) } }
    }
    if (binding.id === 'esi-rxpdo' && tx) return { ...binding, title: 'TxPdo', entryId: 'esi-txpdo', path: binding.path.replace('RxPdo', 'TxPdo'), route: { ...binding.route, esiNode: binding.route.esiNode.replace('RxPdo', 'TxPdo') } }
    if (binding.id === 'esi-entry' && tx) return { ...binding, path: binding.path.replace('RxPdo', 'TxPdo'), route: { ...binding.route, esiNode: binding.route.esiNode.replace('RxPdo', 'TxPdo') } }
    if (binding.id === 'rx-tx') return { ...binding, route: { ...binding.route, row: tx ? '13' : '18' } }
    return binding
  })
}

const inputDefaults = {
  roles: {}, objects: { shape: 'RECORD', mode: 'complete', operation: 'read', start: '0', completeSupported: true, permission: 'rw', state: 'PREOP' },
  process: { members: [{ type: 'UINT16', mapped: true }, { type: 'UINT32', mapped: true }], buffers: '3', internalWidth: '8', capacity: '16', logicalBit: '0', channel: '2' },
  sync: { period: '1000', phase: '250', latch: '650', latency: '100' },
  state: { error: 'none', bootstrap: false, watchScenario: 'pdi-stop', watchTime: '180' }, startup: { emulation: false },
}
export function learningInputs(topic, raw) {
  const defaults = inputDefaults[topic] || {}
  if (!raw) return { values: structuredClone(defaults), recovered: false }
  try {
    if (raw.length > 1600) throw new Error('Too long')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid input')
    const values = structuredClone(defaults)
    for (const key of Object.keys(defaults)) {
      const value = parsed[key]
      if (key === 'members' && Array.isArray(value) && value.length === 2) values.members = value.map(member => ({ type: typeof member?.type === 'string' ? member.type.slice(0, 16) : 'UINT16', mapped: member?.mapped === true }))
      else if (typeof value === 'string' && value.length <= 40 && typeof defaults[key] === 'string') values[key] = topic === 'sync' ? value.trim() : value
      else if (typeof value === 'number' && Number.isFinite(value) && typeof defaults[key] === 'string') values[key] = String(value)
      else if (typeof value === 'boolean' && typeof defaults[key] === 'boolean') values[key] = value
    }
    return { values, recovered: false }
  } catch { return { values: structuredClone(defaults), recovered: true } }
}

const types = { BOOL: 1, UINT8: 8, UINT16: 16, UINT32: 32 }
export const learningTypes = Object.keys(types)
export function pdoLesson({ direction = 'rx', members = [{ type: 'UINT16', mapped: true }, { type: 'UINT32', mapped: true }], buffers = 3, internalWidth = 8, capacity = 16 } = {}) {
  if (!['rx', 'tx'].includes(direction)) throw new Error('请选择主站输出或主站输入方向。')
  const input = direction === 'tx', index = input ? 0x6000 : 0x7000
  if (!Array.isArray(members) || members.length !== 2) throw new Error('教学场景需要两个成员。')
  const rows = members.map((member, i) => {
    if (!Object.hasOwn(types, member.type)) throw new Error('请选择支持的协议类型。')
    return { id: `member-${i}`, name: input ? ['Status', 'Value'][i] : ['Command', 'Target'][i], type: member.type, bits: types[member.type], mapped: member.mapped === true, si: i + 1, mapping: encodePdoMapping({ index, subIndex: i + 1, bitLength: types[member.type] }) }
  })
  const active = rows.filter(row => row.mapped)
  const layout = calculateBitLayout(active)
  const memory = planSmMemory({ ramStart: '0x1000', ramEnd: '0x2000', alignment: 1, checkLengthAlignment: false, internalWidth, channels: [{ name: input ? 'SM3' : 'SM2', start: '0x1100', length: layout.totalBytes, buffers }] })
  const maximum = parseUnsigned(capacity, { name: '容量上限', min: 0, max: 65535 })
  return { direction, sm: input ? 3 : 2, pdo: input ? 'TxPDO' : 'RxPDO', master: input ? '主站输入' : '主站输出', slave: input ? '从站发送' : '从站接收', arrow: input ? '从站 → 主站' : '主站 → 从站', assignment: input ? '0x1C13' : '0x1C12', mappingIndex: input ? '0x1A00' : '0x1600', objectIndex: formatHex(index), rows, active, layout, memory: memory.rows[0], capacity: maximum, fits: layout.totalBytes <= maximum }
}

export function synchronizationLesson(input = {}) {
  const read = (key, initial, min, max) => {
    const value = input[key] ?? initial
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(String(value)) || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(`${({ period: '周期', phase: 'SYNC1偏移', latch: '外部边沿时刻', latency: '应用读取延迟' })[key]}：请输入${min}–${max} µs范围的数值。`)
    return Number(value)
  }
  const period = read('period', 1000, 100, 10000)
  const phase = read('phase', 250, 0, period - 1)
  const latch = read('latch', 650, 0, period * 2)
  const latency = read('latency', 100, 0, period)
  const readAt = latch + latency
  const end = Math.max(period * 2, readAt + period * .1)
  const pulses = offset => Array.from({ length: Math.floor((end - offset) / period) + 1 }, (_, i) => offset + i * period)
  return { period, phase, latch, latency, readAt, captured: latch, end, sync0: pulses(0), sync1: pulses(phase), scope: 'DC时间和边沿的教学示意；不表达真实设备的抖动、寄存器量化或中断延迟分布。' }
}

export function ledIsOn(patternId, time) {
  const pattern = ledPatterns[patternId]
  if (!pattern || !Number.isFinite(time) || time < 0) return false
  const at = time % pattern.period
  return pattern.pulses.some(([start, end]) => at >= start && at < end)
}

/** A shared repeat window keeps the lamp, waveform and cursor in the same phase. */
export function ledTimeline({ run = 'off', error = 'off', time = 0 } = {}) {
  if (![run, error].every(id => Object.hasOwn(ledPatterns, id))) throw new Error('未识别的灯态模式。')
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0) throw new Error('灯效观察时间须为非负数值。')
  const patterns = [run, error].map(id => ledPatterns[id])
  const animated = patterns.filter(pattern => !pattern.steady)
  const gcd = (a, b) => b ? gcd(b, a % b) : a
  const cycle = animated.reduce((value, pattern) => value / gcd(value, pattern.period) * pattern.period, 1)
  const windowMs = animated.length ? Math.ceil(1600 / cycle) * cycle : 1600
  const cursor = time % windowMs
  const tracks = [run, error].map((patternId, index) => {
    const pattern = patterns[index], intervals = []
    if (pattern.steady) {
      if (ledIsOn(patternId, 0)) intervals.push([0, windowMs])
    } else {
      for (let at = 0; at < windowMs; at += pattern.period) {
        for (const [start, end] of pattern.pulses) intervals.push([at + start, Math.min(at + end, windowMs)])
      }
    }
    return { id: index === 0 ? 'run' : 'error', patternId, pattern, intervals, on: ledIsOn(patternId, cursor) }
  })
  return { windowMs, cursor, tracks }
}

export function fmmuLesson(input = 0) {
  const offset = parseUnsigned(input, { name: '逻辑位偏移', max: 15 })
  const physical = offset + 3
  return { offset, physicalOffset: physical, logicalAddress: formatHex(0x10000 + Math.floor(offset / 8), 8), logicalBit: offset % 8, physicalAddress: formatHex(0x1100 + Math.floor(physical / 8)), physicalBit: physical % 8 }
}

export function watchdogLesson({ watchScenario = 'pdi-stop', watchTime = '180' } = {}) {
  if (!watchdogScenarios.some(item => item.id === watchScenario)) throw new Error('请选择有效的看门狗触发场景。')
  const time = parseUnsigned(watchTime, { name: '观察时刻', max: 220 })
  const model = watchdogTiming({ scenario: watchScenario, time })
  return { ...model, lanes: model.lanes.map(lane => ({ ...lane, remaining: Math.max(0, lane.deadline - time), title: lane.id === 'pdi' ? 'PDI看门狗' : '过程数据看门狗', address: lane.id === 'pdi' ? '0x0410' : '0x0420' })) }
}

const aliasRows = learningConcepts.flatMap(concept => concept.aliases.map(alias => ({ alias, conceptId: concept.id }))).sort((a, b) => b.alias.length - a.alias.length)
const ascii = char => Boolean(char && /[A-Za-z0-9_]/.test(char))
/** Longest exact phrases; ASCII tokens do not match inside identifiers. */
export function conceptTokens(text) {
  const source = String(text ?? ''), lower = source.toLowerCase(), tokens = []
  let cursor = 0, plain = ''
  while (cursor < source.length) {
    const match = aliasRows.find(row => lower.startsWith(row.alias.toLowerCase(), cursor) && (!ascii(row.alias[0]) || !ascii(source[cursor - 1])) && (!ascii(row.alias.at(-1)) || !ascii(source[cursor + row.alias.length])))
    if (!match) { plain += source[cursor]; cursor += 1; continue }
    if (plain) { tokens.push({ text: plain }); plain = '' }
    tokens.push({ text: source.slice(cursor, cursor + match.alias.length), conceptId: match.conceptId })
    cursor += match.alias.length
  }
  if (plain) tokens.push({ text: plain })
  return tokens
}

export function conceptsForEntry(entry, limit = 4) {
  if (!entry || entry.collection === 'concepts') return []
  const direct = learningBindings.filter(binding => binding.entryId === entry.id).flatMap(binding => learningTopics.filter(topic => topic.scenes.some(scene => scene.steps.some(item => item.bindings.includes(binding.id)))).flatMap(topic => topic.terms)).filter(id => id !== 'rxpdo' && id !== 'txpdo')
  const detected = conceptTokens([entry.name, entry.title, entry.summary].join(' ')).filter(token => token.conceptId).map(token => token.conceptId)
  return [...new Set([...detected, ...direct])].map(id => learningConceptMap.get(id)).filter(Boolean).slice(0, limit)
}
