import test from 'node:test'
import assert from 'node:assert/strict'
import { sdoTeachingObject, sdoRequestDefaults } from '../src/data/sdo-access.js'
import { deriveSdoAccess, sscStorageLayout, requestForSdoMember, requestForSdoMode } from '../src/lib/sdo-access-model.js'
import { learningContext, learningInputs, learningSearchContext } from '../src/lib/learning-model.js'
const plan = (patch = {}, code = 'RECORD') => deriveSdoAccess(sdoTeachingObject(code), { ...sdoRequestDefaults, ...patch })

test('selecting single members updates the requested SI and its actual 1/2/4 byte payload', () => {
  let request = { ...sdoRequestDefaults, mode: 'single' }
  for (const [si, bytes] of [[0, [2]], [1, [0x34, 0x12]], [2, [0x12, 0x34, 0x56, 0x78]]]) {
    request = requestForSdoMember(request, si)
    assert.equal(request.start, String(si))
    assert.deepEqual(deriveSdoAccess(sdoTeachingObject(), request).bytes, bytes)
  }
})
test('CA member focus preserves CA0/CA1 range instead of issuing an illegal CA2 request', () => {
  for (const [start, length] of [['0', 8], ['1', 6]]) {
    const request = { ...sdoRequestDefaults, start }
    for (const si of [0, 1, 2]) {
      const next = requestForSdoMember(request, si)
      assert.equal(next.start, start)
      assert.equal(deriveSdoAccess(sdoTeachingObject(), next).byteLength, length)
    }
  }
})
test('switching to single accesses the focused member while switching to CA does not hide an invalid start', () => {
  const single = requestForSdoMode(sdoRequestDefaults, 'single', 2)
  assert.equal(single.start, '2'); assert.equal(deriveSdoAccess(sdoTeachingObject(), single).byteLength, 4)
  const ca = requestForSdoMode(single, 'complete', 2)
  assert.equal(ca.start, '2'); assert.equal(deriveSdoAccess(sdoTeachingObject(), ca).abortCode, '0x06010000')
})

test('SI0 has an eight-bit logical type, a separate sixteen-bit SSC allocation and request-dependent transfer size', () => {
  const object = sdoTeachingObject('RECORD'), before = structuredClone(object)
  assert.equal(object.entries[0].type, 'UNSIGNED8'); assert.equal(object.entries[0].logicalBits, 8)
  assert.equal(sscStorageLayout(object).rows[0].allocatedBits, 16)
  const single = plan({ mode: 'single' }), ca = plan()
  assert.deepEqual(single.bytes, [2]); assert.equal(single.byteLength, 1)
  assert.deepEqual(ca.bytes, [2, 0, 0x34, 0x12, 0x12, 0x34, 0x56, 0x78])
  assert.equal(ca.segments[1].role, 'ca-padding'); assert.equal(ca.segments[1].subIndex, null)
  assert.equal(ca.segments.find(s => s.subIndex === 1).byteOffset, 2)
  assert.deepEqual(object, before)
})
test('CA from SI1 omits both SI0 and padding while local offsets remain unchanged', () => {
  const zero = plan(), one = plan({ start: '1' })
  assert.deepEqual(one.bytes, [0x34, 0x12, 0x12, 0x34, 0x56, 0x78])
  assert.ok(one.segments.every(s => s.role === 'entry' && s.subIndex > 0))
  assert.equal(one.segments[0].byteOffset, 0)
  assert.equal(one.storage.rows.find(r => r.subIndex === 1).bitOffset, 16)
  assert.deepEqual(zero.storage, one.storage)
})
test('CA SI2 and SI255 abort, but an existing single SI2 is valid and a missing single SI3 is different', () => {
  for (const start of ['2', '255', '0xFF']) { const p = plan({ start }); assert.equal(p.abortCode, '0x06010000'); assert.deepEqual(p.bytes, []) }
  assert.deepEqual(plan({ mode: 'single', start: '2' }).bytes, [0x12, 0x34, 0x56, 0x78])
  assert.equal(plan({ mode: 'single', start: '3' }).abortCode, '0x06090011')
  assert.equal(plan({ start: '0x01' }).valid, true)
})
test('invalid syntax or out-of-range SI is an input error rather than a fabricated protocol Abort', () => {
  for (const start of ['', '-1', '1.5', '256', '2x', 'NaN']) { const p = plan({ start }); assert.equal(p.kind, 'input'); assert.equal(p.abortCode, null); assert.equal(p.bytes.length, 0) }
})
test('VARIABLE SI0 is the actual value with no synthetic count header or CA padding', () => {
  const p = plan({ mode: 'single' }, 'VARIABLE')
  assert.deepEqual(p.bytes, [0x34, 0x12]); assert.equal(p.object.entries[0].logicalBits, 16)
  assert.equal(p.storage.rows[0].cName, 'value0'); assert.equal(p.storage.totalBits, 16)
  assert.equal(plan({}, 'VARIABLE').abortCode, '0x06010000')
})
test('ARRAY uses the same SI0 rules and serializes exactly the declared teaching values in little endian', () => {
  assert.deepEqual(plan({}, 'ARRAY').bytes, [2, 0, 0x34, 0x12, 0x78, 0x56])
  assert.deepEqual(plan({ start: '1' }, 'ARRAY').bytes, [0x34, 0x12, 0x78, 0x56])
})
test('read/write, CA support, uniform permissions and state constraints are independent checks', () => {
  assert.equal(plan({ completeSupported: false }).kind, 'precondition')
  assert.equal(plan({ completeSupported: false }).abortCode, null)
  assert.equal(plan({ mode: 'single', start: '2', completeSupported: false }).valid, true)
  assert.equal(plan({ permission: 'ro', operation: 'write' }).abortCode, '0x06010002')
  assert.equal(plan({ permission: 'wo', operation: 'read' }).abortCode, '0x06010001')
  assert.equal(plan({ permission: 'rw_preop', operation: 'write', state: 'OP' }).abortCode, '0x08000022')
  assert.equal(plan({ permission: 'rw_preop', operation: 'read', state: 'OP' }).valid, true)
  assert.equal(plan({ permission: 'rw_preop', operation: 'write', state: 'PREOP' }).valid, true)
})
test('the lesson deep link retains CA inputs, false capability and invalid-start demonstrations', () => {
  const context = learningContext({ learnScene: 'sdo-access', learnStep: '0' }, 'learn-objects')
  assert.equal(context.scene.id, 'sdo-access')
  const { values, recovered } = learningInputs('objects', JSON.stringify({ shape: 'ARRAY', start: '2', mode: 'complete', operation: 'write', completeSupported: false }))
  assert.equal(recovered, false); assert.equal(values.completeSupported, false); assert.equal(values.shape, 'ARRAY')
  assert.equal(deriveSdoAccess(sdoTeachingObject(values.shape), values).abortCode, '0x06010000')
  assert.equal(learningSearchContext('learn-objects', 'Complete Access').learnScene, 'sdo-access')
  assert.equal(learningSearchContext('learn-objects', 'SI0').learnScene, 'sdo-access')
})
test('unsigned high-bit values retain all four bytes without signed integer truncation', () => {
  const object = sdoTeachingObject('RECORD'); object.entries[2].value = 0xFFFFFFFF
  assert.deepEqual(deriveSdoAccess(object, { ...sdoRequestDefaults, mode: 'single', start: '2' }).bytes, [255, 255, 255, 255])
})
test('CA range is explicit; undeclared holes or unsupported layouts never become guessed bytes', () => {
  const object = sdoTeachingObject('ARRAY'); object.accessUpperSubIndex = 1; object.entries[0].value = 1
  assert.deepEqual(deriveSdoAccess(object, sdoRequestDefaults).bytes, [1, 0, 0x34, 0x12])
  const hole = sdoTeachingObject('RECORD'); hole.entries = hole.entries.filter(e => e.subIndex !== 1)
  assert.equal(deriveSdoAccess(hole, sdoRequestDefaults).kind, 'unmodeled')
  const bits = sdoTeachingObject('RECORD'); bits.entries[1].logicalBits = 1
  assert.equal(deriveSdoAccess(bits, sdoRequestDefaults).kind, 'unmodeled')
})
