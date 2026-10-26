import test from 'node:test'
import assert from 'node:assert/strict'
import { errorIndicators, ledPatterns } from '../src/data/learning.js'
import { ledTimeline, learningInputs } from '../src/lib/learning-model.js'

test('ERR scenarios cover six distinct patterns while keeping the four existing IDs', () => {
  assert.equal(errorIndicators.length, 6)
  assert.deepEqual(new Set(errorIndicators.map(item => item.pattern)), new Set(['off', 'flicker', 'blink', 'single', 'double', 'on']))
  for (const id of ['none', 'configuration', 'local', 'watchdog']) assert.ok(errorIndicators.some(item => item.id === id))
  assert.equal(learningInputs('state').values.error, 'none')
})

test('single-flash RUN and double-flash ERR keep the actual phase after 1600ms and at wrap', () => {
  const model = ledTimeline({ run: 'single', error: 'double', time: 1600 })
  assert.equal(model.windowMs, 4800)
  assert.equal(model.cursor, 1600)
  assert.deepEqual(model.tracks.map(track => track.on), [false, true])
  const wrapped = ledTimeline({ run: 'single', error: 'double', time: 4800 })
  assert.equal(wrapped.cursor, 0)
  assert.deepEqual(wrapped.tracks.map(track => track.on), [true, true])
})

test('wave bands, lamps and cursor agree for all pattern pairs over multiple loops', () => {
  for (const run of Object.keys(ledPatterns)) for (const error of Object.keys(ledPatterns)) {
    const first = ledTimeline({ run, error })
    assert.ok(first.windowMs >= 1600)
    for (let time = 0; time <= first.windowMs * 2 + 25; time += 25) {
      const model = ledTimeline({ run, error, time })
      assert.ok(model.cursor >= 0 && model.cursor < model.windowMs)
      for (const track of model.tracks) {
        const lit = track.intervals.some(([start, end]) => model.cursor >= start && model.cursor < end)
        assert.equal(track.on, lit, `${run}/${error} at ${time}: ${track.id}`)
        assert.ok(track.intervals.every(([a, b]) => a >= 0 && a < b && b <= model.windowMs))
      }
    }
  }
})

test('fast blink has 50ms transitions and a constant ERR does not acquire artificial off gaps', () => {
  for (const [time, on] of [[0, true], [49, true], [50, false], [99, false], [100, true]]) {
    assert.equal(ledTimeline({ error: 'flicker', time }).tracks[1].on, on)
  }
  for (const time of [0, 200, 1200, 1599, 1600, 100000]) {
    const { tracks, windowMs } = ledTimeline({ run: 'off', error: 'on', time })
    assert.equal(tracks[0].on, false)
    assert.deepEqual(tracks[0].intervals, [])
    assert.equal(tracks[1].on, true)
    assert.deepEqual(tracks[1].intervals, [[0, windowMs]])
  }
})

test('invalid patterns and time values cannot produce a nominal healthy waveform', () => {
  for (const input of [{ run: 'unknown' }, { error: 'future' }, { time: -1 }, { time: NaN }, { time: Infinity }, { time: '0' }]) assert.throws(() => ledTimeline(input))
})
