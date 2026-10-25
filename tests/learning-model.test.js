import test from 'node:test'
import assert from 'node:assert/strict'
import { DOMParser } from '@xmldom/xmldom'
import { entries, entryMap } from '../src/data/index.js'
import { learningTopics, learningConcepts, learningBindings, legacyLearningTargets, alStates, errorIndicators } from '../src/data/learning.js'
import { bindingsForStep, conceptTokens, conceptsForEntry, fmmuLesson, learningContext, learningInputs, learningSearchContext, ledIsOn, pdoLesson, synchronizationLesson, watchdogLesson } from '../src/lib/learning-model.js'
import { createSearchIndex, parseRoute, resolveRoute, routeHash } from '../src/lib/library.js'
import { esiContext } from '../src/lib/esi-context.js'
import { applicationContext } from '../src/lib/application-model.js'

globalThis.DOMParser = DOMParser

test('learning scene references, prerequisites and existing configuration targets are complete', () => {
  const terms = new Map(learningConcepts.map(item => [item.id, item]))
  assert.equal(terms.size, learningConcepts.length)
  const bindingIds = new Set(learningBindings.map(item => item.id))
  for (const term of learningConcepts) {
    assert.ok(entryMap.has(term.entryId), term.id)
    for (const id of term.prerequisites) assert.ok(terms.has(id), `${term.id}: ${id}`)
    function visit(id, path = []) {
      assert.ok(!path.includes(id), `Prerequisite cycle: ${[...path, id]}`)
      for (const prerequisite of terms.get(id).prerequisites) visit(prerequisite, [...path, id])
    }
    visit(term.id)
    const context = learningContext({ learnScene: term.scene, learnStep: term.step }, term.entryId)
    assert.equal(context.topic.id, term.topic)
    assert.equal(context.scene.id, term.scene)
    assert.equal(context.step, term.step)
  }
  for (const topic of learningTopics) {
    assert.ok(entryMap.has(topic.entryId))
    assert.ok(topic.scenes.length && topic.evidence.length)
    for (const term of topic.terms) assert.ok(terms.has(term), term)
    for (const scene of topic.scenes) for (const step of scene.steps) for (const id of step.bindings) assert.ok(bindingIds.has(id), id)
  }
  for (const binding of learningBindings) assert.ok(entryMap.has(binding.entryId), binding.id)
})

test('configuration bindings resolve to actual teaching XML and application fields', () => {
  for (const binding of learningBindings) {
    if (binding.route.esiNode) {
      const context = esiContext(binding.route, binding.entryId)
      assert.equal(context.node.id, binding.route.esiNode, binding.id)
      if (binding.route.esiAttr) assert.equal(context.attribute, binding.route.esiAttr, binding.id)
    }
    if (binding.route.field) {
      const context = applicationContext(binding.route, binding.entryId)
      assert.equal(context.workbook.id, binding.route.workbook, binding.id)
      assert.equal(context.field, binding.route.field, binding.id)
      assert.ok(context.row, binding.id)
    }
  }
})

test('all 18 old concept links retain their identity and open a valid learning scene', () => {
  assert.equal(Object.keys(legacyLearningTargets).length, 18)
  for (const id of Object.keys(legacyLearningTargets)) {
    const route = resolveRoute(parseRoute(`#/entry/${id}`), entryMap)
    const context = learningContext(route, route.id)
    assert.equal(route.id, id)
    assert.equal(route.collection, 'concepts')
    assert.equal(route.group, context.topic.id)
    assert.ok(context.current.explanation)
  }
})

test('learning deep links preserve step zero, direction, scene and clamp invalid input', () => {
  const expected = { view: 'entry', id: 'learn-process', collection: 'concepts', group: 'process', learnScene: 'pdo', learnStep: 0, learnDir: 'tx' }
  const parsed = parseRoute(routeHash(expected))
  const context = learningContext(parsed, parsed.id)
  assert.equal(context.step, 0)
  assert.equal(context.direction, 'tx')
  assert.equal(learningContext({ learnStep: '999' }, 'learn-process').step, 3)
  assert.equal(learningContext({ learnStep: '-1' }, 'learn-process').step, 0)
  assert.equal(learningContext({ learnStep: 'NaN', learnScene: 'unknown' }, 'learn-process').scene.id, 'pdo')
  assert.equal(learningContext({}, 'txpdo').direction, 'tx')
  assert.equal(learningContext({}, 'sdo').channel, 0)
  assert.ok(bindingsForStep(learningContext({ learnStep: '3', learnDir: 'tx' }, 'learn-process')).some(item => item.id === 'input-capacity'))
})

test('PDO teaching model separates assignment, member target, continuous bit length and physical storage', () => {
  const initial = pdoLesson()
  assert.equal(initial.assignment, '0x1C12')
  assert.equal(initial.rows[0].mapping.hex, '0x70000110')
  assert.equal(initial.rows[1].mapping.hex, '0x70000220')
  assert.equal(initial.layout.totalBits, 48)
  assert.equal(initial.layout.totalBytes, 6)
  assert.equal(initial.memory.allocated, 18)
  const word32 = pdoLesson({ internalWidth: 32 })
  assert.equal(word32.layout.totalBytes, 6)
  assert.equal(word32.memory.bufferSpan, 8)
  assert.equal(word32.memory.allocated, 24)
  const tx = pdoLesson({ direction: 'tx', buffers: 1, capacity: 5 })
  assert.equal(tx.rows[0].mapping.hex, '0x60000110')
  assert.equal(tx.assignment, '0x1C13')
  assert.equal(tx.pdo, 'TxPDO')
  assert.equal(tx.memory.allocated, 6)
  assert.equal(tx.fits, false)
})

test('PDO member selection covers bit packing, one-byte exception and no active process data', () => {
  const single = pdoLesson({ members: [{ type: 'BOOL', mapped: true }, { type: 'UINT32', mapped: false }] })
  assert.equal(single.layout.totalBits, 1)
  assert.equal(single.layout.totalBytes, 1)
  assert.equal(single.memory.effectiveBuffers, 1)
  const packed = pdoLesson({ members: [{ type: 'BOOL', mapped: true }, { type: 'UINT16', mapped: true }] })
  assert.equal(packed.layout.rows[1].bitOffset, 1)
  assert.equal(packed.layout.totalBytes, 3)
  const none = pdoLesson({ members: [{ type: 'UINT16', mapped: false }, { type: 'UINT32', mapped: false }] })
  assert.equal(none.layout.totalBytes, 0)
  assert.equal(none.memory.effectiveBuffers, 0)
  assert.equal(none.memory.allocated, 0)
  assert.throws(() => pdoLesson({ capacity: '' }))
  assert.throws(() => pdoLesson({ members: [{ type: 'wrong', mapped: true }, { type: 'BOOL', mapped: true }] }))
})

test('LATCH captures edge time independently from delayed application reads and validates input', () => {
  const initial = synchronizationLesson()
  assert.equal(initial.captured, 650)
  assert.equal(initial.readAt, 750)
  const delayed = synchronizationLesson({ latency: 900 })
  assert.equal(delayed.captured, 650)
  assert.equal(delayed.readAt, 1550)
  assert.deepEqual(synchronizationLesson({ phase: 0 }).sync1, [0, 1000, 2000])
  assert.ok(synchronizationLesson({ latch: 2000, latency: 1000 }).sync0.includes(3000))
  for (const input of [{ period: '' }, { period: 0 }, { period: '0x400' }, { phase: 1000 }, { latch: 3000 }, { latency: -1 }]) assert.throws(() => synchronizationLesson(input))
})

test('LED teaching patterns have deterministic timing boundaries and repeat without ambiguity', () => {
  assert.equal(ledIsOn('blink', 199), true)
  assert.equal(ledIsOn('blink', 200), false)
  assert.equal(ledIsOn('blink', 400), true)
  assert.equal(ledIsOn('single', 1199), false)
  assert.equal(ledIsOn('single', 1200), true)
  assert.equal(ledIsOn('double', 400), true)
  assert.equal(ledIsOn('double', 600), false)
  assert.equal(ledIsOn('off', 0), false)
  assert.equal(ledIsOn('on', 100000), true)
  assert.equal(ledIsOn('unknown', 0), false)
  assert.deepEqual(alStates.map(item => item.run), ['off', 'blink', 'single', 'on'])
  assert.ok(errorIndicators.every(item => item.explanation))
})

test('term recognition preserves exact text, prefers full phrases and respects code identifiers', () => {
  const text = 'PDO Mapping 由Index/SubIndex编码，ESC通过PDI访问；CoERead、MAX_PD_OUTPUT_SIZE不拆。'
  const tokens = conceptTokens(text)
  assert.equal(tokens.map(item => item.text).join(''), text)
  assert.equal(tokens[0].conceptId, 'mapping')
  assert.ok(tokens.some(item => item.conceptId === 'index'))
  assert.ok(tokens.some(item => item.conceptId === 'pdi'))
  assert.ok(!conceptTokens('CoERead ESC_16BIT_ACCESS SM2 wordBits').some(item => item.conceptId))
  assert.ok(conceptsForEntry(entryMap.get('esi-entry')).length)
  assert.ok(!conceptsForEntry(entryMap.get('esi-control-byte')).some(item => item.id === 'rxpdo' || item.id === 'txpdo'))
  assert.deepEqual(conceptsForEntry(entryMap.get('learn-process')), [])
  const index = createSearchIndex(entries)
  assert.ok(index.some(item => item.entry.id === 'learn-startup' && item.text.includes('eeprom')))
  assert.ok(index.some(item => item.entry.id === 'learn-roles' && item.text.includes('pdi')))
})

test('teaching links keep explicit zero and recover malformed or oversized parameter payloads', () => {
  assert.equal(learningInputs('sync', '{"latency":0,"latch":"0"}').values.latency, '0')
  assert.equal(learningInputs('sync', '{"period":""}').values.period, '')
  assert.equal(learningInputs('process', '{"members":[{"type":"BOOL","mapped":false},{"type":"UINT16","mapped":true}]}').values.members[0].mapped, false)
  assert.equal(learningInputs('sync', '{wrong').recovered, true)
  assert.equal(learningInputs('sync', 'x'.repeat(1700)).recovered, true)
  const parsed = learningInputs('roles', '{"__proto__":{"polluted":true},"script":"<script>"}').values
  assert.deepEqual(parsed, {})
  const route = parseRoute(routeHash({ view: 'entry', id: 'learn-sync', collection: 'concepts', learnStep: 2, learnData: '{"latency":"900"}' }))
  assert.equal(synchronizationLesson(learningInputs('sync', route.learnData).values).readAt, 1550)
})

test('FMMU example maps bit offsets across byte boundaries without using object indices', () => {
  assert.equal(fmmuLesson(0).physicalAddress, '0x1100')
  assert.equal(fmmuLesson(0).physicalBit, 3)
  assert.equal(fmmuLesson(5).physicalAddress, '0x1101')
  assert.equal(fmmuLesson(5).physicalBit, 0)
  assert.equal(fmmuLesson(15).logicalAddress, '0x00010001')
  assert.equal(fmmuLesson(15).logicalBit, 7)
  assert.equal(fmmuLesson(15).physicalAddress, '0x1102')
  assert.equal(fmmuLesson(15).physicalBit, 2)
  for (const value of ['', '-1', '16', '8x']) assert.throws(() => fmmuLesson(value))
})

test('related fields follow direction and selected SM without mixing mailbox and PDO capacity', () => {
  const rx = bindingsForStep(learningContext({ learnStep: '3' }, 'learn-process'))
  assert.ok(rx.some(item => item.id === 'output-capacity'))
  assert.ok(!rx.some(item => item.id === 'input-capacity'))
  const tx = bindingsForStep(learningContext({ learnStep: '3', learnDir: 'tx' }, 'learn-process'))
  assert.ok(!tx.some(item => item.id === 'output-capacity'))
  assert.ok(tx.find(item => item.id === 'esi-sm-control').route.esiNode.endsWith('/Sm[4]'))
  const channels = learningContext({ learnScene: 'channels', learnStep: 2 }, 'learn-process')
  for (let channel = 0; channel < 4; channel += 1) {
    const related = bindingsForStep({ ...channels, inputs: { channel: String(channel) } })
    const sm = related.find(item => item.id === 'esi-sm-control')
    const context = esiContext(sm.route, sm.entryId)
    assert.equal(context.node.id, sm.route.esiNode)
    assert.ok(sm.route.esiNode.endsWith(`/Sm[${channel + 1}]`))
    assert.ok(related.some(item => item.id === (channel < 2 ? 'mailbox-size' : channel === 3 ? 'input-capacity' : 'output-capacity')))
  }
})

test('watchdog explanation uses the existing independent monitoring model and a dedicated scene', () => {
  assert.equal(learningContext({ learnScene: 'watchdog' }, 'learn-state').scene.id, 'watchdog')
  const initial = watchdogLesson()
  assert.equal(initial.lanes[0].address, '0x0410')
  assert.equal(initial.lanes[0].state, 'expired')
  assert.equal(initial.lanes[1].state, 'waiting')
  const before = watchdogLesson({ watchTime: '150' })
  assert.equal(before.lanes[0].remaining, 10)
  assert.equal(before.lanes[0].state, 'waiting')
  const otherSide = watchdogLesson({ watchScenario: 'sm-stop' })
  assert.equal(otherSide.lanes[0].state, 'waiting')
  assert.equal(otherSide.lanes[1].state, 'expired')
  assert.equal(otherSide.lanes[1].address, '0x0420')
  assert.throws(() => watchdogLesson({ watchTime: '' }))
  assert.throws(() => watchdogLesson({ watchScenario: 'unknown' }))
})

test('exact concept searches focus the right scene while configuration searches keep their own meaning', () => {
  assert.equal(learningSearchContext('learn-roles', 'PDI').learnStep, '2')
  assert.equal(learningSearchContext('learn-startup', '5001').learnStep, '2')
  assert.equal(learningSearchContext('learn-sync', 'LATCH').learnStep, '2')
  assert.equal(learningSearchContext('learn-process', 'TxPDO').learnDir, 'tx')
  assert.equal(JSON.parse(learningSearchContext('learn-process', 'SDO').learnData).channel, '0')
  assert.deepEqual(learningSearchContext('max-pd-output-size', 'PDO'), {})
  assert.deepEqual(learningSearchContext('learn-process', 'unknown'), {})
})
