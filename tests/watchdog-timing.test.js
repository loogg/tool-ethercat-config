import test from 'node:test'
import assert from 'node:assert/strict'
import { watchdogTiming } from '../src/lib/watchdog-timing.js'
import { entries, entryMap } from '../src/data/index.js'
import { buildConfigGraph } from '../src/lib/config-graph.js'

test('watchdog graph separates shared divider and two independent 16bit counters', () => {
  const graph = buildConfigGraph(entryMap.get('esc-sm-wd-supported'), entries)
  const divider = graph.nodes.find(n=>n.name.startsWith('0x0400'))
  const pdi = graph.nodes.find(n=>n.name.startsWith('0x0410'))
  const sm = graph.nodes.find(n=>n.name.startsWith('0x0420'))
  assert.ok(divider && pdi && sm)
  assert.equal(graph.timing, 'watchdog')
  for (const target of ['rule-watchdog-time','rule-pdi-watchdog-time']) assert.ok(graph.edges.some(e=>e.source===divider.id && e.target===target && e.kind==='derives'))
  assert.ok(graph.edges.some(e=>e.source===pdi.id && e.target==='rule-pdi-watchdog-time'))
  assert.ok(!graph.edges.some(e=>e.source===pdi.id && e.target==='rule-watchdog-time'))
  assert.ok(!graph.edges.some(e=>e.source===graph.rootId && [pdi.id,'rule-pdi-watchdog-time'].includes(e.target)))
  assert.equal(graph.edges.filter(e=>e.kind==='selects').length, 2)
})

test('continuous accesses keep both nominal watchdogs refreshed independently', () => {
  const model = watchdogTiming({ scenario:'continuous', time:180 })
  assert.equal(model.parameters.tick, .1)
  for (const lane of model.lanes) { assert.equal(lane.timeout,100); assert.equal(lane.lastTrigger,180); assert.equal(lane.deadline,280); assert.equal(lane.state,'waiting') }
})

test('last trigger at 60ms expires nominally at 160ms, not at the moment activity stops', () => {
  const before = watchdogTiming({ scenario:'sm-stop', time:150 })
  assert.equal(before.lanes[1].lastTrigger,60)
  assert.equal(before.lanes[1].state,'waiting')
  const at = watchdogTiming({ scenario:'sm-stop', time:160 })
  assert.equal(at.lanes[1].deadline,160)
  assert.equal(at.lanes[1].state,'expired')
  assert.equal(at.lanes[0].state,'waiting')
})

test('PDI loss does not imply lost process-data writes and vice versa', () => {
  const pdi = watchdogTiming({ scenario:'pdi-stop', time:180 })
  assert.deepEqual(pdi.lanes.map(l=>l.state), ['expired','waiting'])
  const sm = watchdogTiming({ scenario:'sm-stop', time:180 })
  assert.deepEqual(sm.lanes.map(l=>l.state), ['waiting','expired'])
  assert.deepEqual(watchdogTiming({ scenario:'both-stop',time:180 }).lanes.map(l=>l.state), ['expired','expired'])
})

test('zero count disables only its own watchdog and has no deadline', () => {
  const model = watchdogTiming({ scenario:'both-stop', time:180, pdiDisabled:true })
  assert.equal(model.lanes[0].count,0)
  assert.equal(model.lanes[0].deadline,null)
  assert.equal(model.lanes[0].state,'disabled')
  assert.equal(model.lanes[1].state,'expired')
  assert.deepEqual(watchdogTiming({ scenario:'both-stop',time:220,smDisabled:true,pdiDisabled:true }).lanes.map(l=>l.state), ['disabled','disabled'])
})
