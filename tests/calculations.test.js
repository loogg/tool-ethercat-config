import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CalculationError, parseUnsigned, decodePdoMapping, encodePdoMapping,
  calculateBitLayout, planSmMemory, calculateWatchdogs, decodeSmControl,
} from '../src/lib/calculations.js'

test('integer parser accepts decimal, prefixed hex and ESI notation without partial parsing', () => {
  assert.equal(parseUnsigned(' 0x6040 '), 24640)
  assert.equal(parseUnsigned('#XFF'), 255)
  assert.equal(parseUnsigned('0016'), 16)
  assert.equal(parseUnsigned(0), 0)
  for (const input of ['', ' ', '1.5', '-1', '+1', '1e3', '12bits', '0b10', '0x', '#x', '6040h', '1_000', null, false, NaN, Infinity]) {
    assert.throws(() => parseUnsigned(input), CalculationError, String(input))
  }
  assert.throws(() => parseUnsigned('4294967296'), /范围/)
  assert.throws(() => parseUnsigned('9007199254740993'), /范围/)
})

test('PDO mapping uses 16/8/8 bits and round-trips unsigned high-bit values', () => {
  const decoded = decodePdoMapping('0x60400010')
  assert.equal(decoded.index, 0x6040)
  assert.equal(decoded.subIndex, 0)
  assert.equal(decoded.bitLength, 16)
  assert.equal(decoded.hex, '0x60400010')
  assert.equal(encodePdoMapping({ index: '#xFFFF', subIndex: '255', bitLength: '255' }).value, 0xffffffff)
  assert.equal(decodePdoMapping('4294967295').index, 65535)
  for (const [index, subIndex, bitLength] of [[0, 0, 1], [0x6041, 0, 16], [0x2000, 255, 8], [0xffff, 0xff, 0xff]]) {
    const encoded = encodePdoMapping({ index, subIndex, bitLength })
    assert.deepEqual(decodePdoMapping(encoded.value), encoded)
  }
})

test('PDO mapping rejects zero length and overflow, while identifying padding', () => {
  assert.throws(() => decodePdoMapping('0x60400000'), /不能为 0/)
  assert.throws(() => encodePdoMapping({ index: '65536', subIndex: 0, bitLength: 8 }), /Index/)
  assert.throws(() => encodePdoMapping({ index: 1, subIndex: 256, bitLength: 8 }), /SubIndex/)
  assert.throws(() => encodePdoMapping({ index: 1, subIndex: 0, bitLength: 256 }), /位长/)
  assert.equal(decodePdoMapping('#x00000008').padding, true)
})

test('bit layout accumulates exact bit offsets without adding alignment', () => {
  const layout = calculateBitLayout([{ bits: 5 }, { bits: 4 }, { bits: 16 }])
  assert.deepEqual(layout.rows.map(row => row.bitOffset), [0, 5, 9])
  assert.deepEqual(layout.rows.map(row => [row.byteOffset, row.bitInByte]), [[0, 0], [0, 5], [1, 1]])
  assert.equal(layout.totalBits, 25)
  assert.equal(layout.totalBytes, 4)
  assert.equal(layout.unusedBits, 7)
  assert.equal(layout.byteAligned, false)
  assert.equal(layout.rows[1].smallFieldCrossesByte, true)
  assert.equal(layout.rows[2].smallFieldCrossesByte, false)
  assert.equal(layout.rows[2].largeFieldUnalignedWord, true)
  assert.equal(calculateBitLayout([{ bits: 8 }, { bits: 16 }]).rows[1].largeFieldUnalignedWord, true)
  assert.equal(calculateBitLayout([{ bits: 16 }, { bits: 32 }]).rows[1].largeFieldUnalignedWord, false)
  assert.equal(calculateBitLayout([{ bits: 8 }, { bits: 16 }]).byteAligned, true)
  assert.equal(calculateBitLayout([]).totalBytes, 0)
  assert.throws(() => calculateBitLayout([{ bits: 0 }]), /范围/)
  assert.throws(() => calculateBitLayout([{ bits: '8abc' }]), /整数/)
})

const defaultMemory = () => ({
  ramStart: '0x1000', ramEnd: '0x3000', alignment: '4',
  channels: [
    { name: 'SM0', start: '0x1000', length: '128', buffers: '1' },
    { name: 'SM1', start: '0x1080', length: '128', buffers: '1' },
    { name: 'SM2', start: '0x1100', length: '12', buffers: '3' },
    { name: 'SM3', start: '0x1124', length: '12', buffers: '3' },
  ],
})

test('SM plan counts all physical buffers while preserving single-buffer register length', () => {
  const plan = planSmMemory(defaultMemory())
  assert.equal(plan.usedBytes, 328)
  assert.equal(plan.freeBytes, 8192 - 328)
  assert.equal(plan.rows[2].length, 12)
  assert.equal(plan.rows[2].allocated, 36)
  assert.equal(plan.rows[2].end, 0x1124)
  assert.equal(plan.rows[3].start, plan.rows[2].end)
})

test('SM plan detects overlap with the hidden second or third buffer', () => {
  const input = defaultMemory()
  input.channels[3].start = '0x110C'
  assert.throws(() => planSmMemory(input), /输入/)
  try { planSmMemory(input) } catch (error) {
    assert.ok(error.issues.some(issue => issue.message.includes('三缓冲')))
    assert.ok(error.issues.some(issue => issue.field === 'channels.3.start'))
  }
})

test('SM plan enforces address and optional template length alignment without rounding', () => {
  const input = defaultMemory()
  input.channels[0].start = '0x1001'
  assert.throws(() => planSmMemory(input), CalculationError)
  const oddLength = { ramStart: '0x1000', ramEnd: '0x1100', alignment: 4, channels: [{ start: '0x1000', length: 3, buffers: 3 }] }
  assert.throws(() => planSmMemory(oddLength), CalculationError)
  assert.equal(planSmMemory({ ...oddLength, checkLengthAlignment: false }).rows[0].allocated, 9)
  assert.throws(() => planSmMemory({ ...oddLength, alignment: 3 }), CalculationError)
  assert.throws(() => planSmMemory({ ...oddLength, channels: [{ start: '0x1000', length: 3, buffers: 2 }] }), CalculationError)
})

test('SM end is exclusive and 0x10000 is the largest address-space end', () => {
  const input = { ramStart: '0xFFF0', ramEnd: '0x10000', alignment: 1, channels: [{ start: '0xFFF0', length: 16, buffers: 1 }] }
  assert.equal(planSmMemory(input).freeBytes, 0)
  assert.equal(planSmMemory(input).rows[0].end, 65536)
  assert.throws(() => planSmMemory({ ...input, ramEnd: '0x10001' }), CalculationError)
  assert.throws(() => planSmMemory({ ...input, channels: [{ start: '0xFFF0', length: 17, buffers: 1 }] }), CalculationError)
  assert.throws(() => planSmMemory({ ...input, ramEnd: '0xFFF0' }), CalculationError)
  assert.throws(() => planSmMemory({ ...input, ramStart: '0x0FFF' }), CalculationError)
})

test('zero-length SM is disabled, consumes no RAM and cannot overlap', () => {
  const input = defaultMemory()
  input.channels[3] = { name: 'SM3', start: '0x0001', length: '0', buffers: '3' }
  const result = planSmMemory(input)
  assert.equal(result.rows[3].active, false)
  assert.equal(result.rows[3].allocated, 0)
  assert.equal(result.usedBytes, 292)
  assert.throws(() => planSmMemory({ ...input, channels: [{ start: 'oops', length: 0, buffers: 1 }] }), CalculationError)
})

test('32-bit internal processing expands buffer start and end before multiplying', () => {
  const input = { ramStart: '0x1000', ramEnd: '0x1300', alignment: 1, internalWidth: 32, channels: [{ start: '0x1003', length: '0xFA', buffers: 3 }] }
  const result = planSmMemory(input)
  const row = result.rows[0]
  assert.equal(row.start, 0x1003)
  assert.equal(row.visibleEnd, 0x10fd)
  assert.equal(row.length, 0xfa)
  assert.equal(row.physicalStart, 0x1000)
  assert.equal(row.bufferSpan, 0x100)
  assert.equal(row.allocated, 0x300)
  assert.equal(row.end, 0x1300)
  assert.equal(result.freeBytes, 0)
  assert.throws(() => planSmMemory({ ...input, ramStart: '0x1003' }), CalculationError)
  assert.throws(() => planSmMemory({ ...input, ramEnd: '0x12FF' }), CalculationError)
})

test('internal processing widths are separate from optional SSC alignment checks', () => {
  for (const [internalWidth, expectedSpan] of [[8, 3], [16, 4], [32, 8], [64, 8]]) {
    const input = { ramStart: '0x1000', ramEnd: '0x1100', alignment: 1, internalWidth, channels: [{ start: '0x1003', length: 3, buffers: 1 }] }
    assert.equal(planSmMemory(input).rows[0].bufferSpan, expectedSpan)
  }
  assert.throws(() => planSmMemory({ ...defaultMemory(), internalWidth: 24 }), CalculationError)
  const noVisibleOverlap = { ramStart: '0x1000', ramEnd: '0x1100', internalWidth: 32, channels: [{ start: '0x1000', length: 2, buffers: 1 }, { start: '0x1002', length: 2, buffers: 1 }] }
  assert.throws(() => planSmMemory(noVisibleOverlap), CalculationError)
})

test('single-byte SM bypasses extra buffers but reserves its internal processing word', () => {
  for (const [internalWidth, buffers, expected] of [[8, 3, 1], [16, 3, 2], [32, 3, 4], [64, 1, 8]]) {
    const result = planSmMemory({ ramStart: '0x1000', ramEnd: '0x1100', alignment: 1, internalWidth, channels: [{ start: '0x1003', length: 1, buffers }] })
    assert.equal(result.rows[0].singleByteMode, true)
    assert.equal(result.rows[0].effectiveBuffers, 1)
    assert.equal(result.usedBytes, expected)
  }
  const disabled = planSmMemory({ ramStart: '0x1000', ramEnd: '0x1100', internalWidth: 64, channels: [{ start: '0x1003', length: 0, buffers: 3 }] })
  assert.equal(disabled.usedBytes, 0)
})

test('watchdog shares divider but calculates independent SM and PDI counts', () => {
  const result = calculateWatchdogs({ divider: 2498, smCount: 1000, pdiCount: 500, unit: 'ms' })
  assert.equal(result.tickNs, 100000)
  assert.equal(result.sm.value, 100)
  assert.equal(result.pdi.value, 50)
  assert.equal(calculateWatchdogs({ divider: 0, smCount: 1, pdiCount: 1, unit: 'ns' }).sm.value, 80)
  assert.equal(calculateWatchdogs({ divider: 0, smCount: 1, pdiCount: 1, unit: 'us' }).sm.value, 0.08)
  assert.equal(calculateWatchdogs({ divider: 2498, smCount: 10000, pdiCount: 1, unit: 's' }).sm.value, 1)
})

test('watchdog handles disabled counts and exact unsigned 16-bit maximum', () => {
  const result = calculateWatchdogs({ divider: 65535, smCount: 65535, pdiCount: 0, unit: 'ns' })
  assert.equal(result.sm.timeoutNs, 171798691800)
  assert.equal(result.pdi.enabled, false)
  assert.equal(result.pdi.value, 0)
  assert.throws(() => calculateWatchdogs({ divider: 65536, smCount: 1, pdiCount: 1 }), /Divider/)
  assert.throws(() => calculateWatchdogs({ divider: 1, smCount: 65536, pdiCount: 1 }), /SM Count/)
  assert.throws(() => calculateWatchdogs({ divider: 1, smCount: 1, pdiCount: -1 }), /PDI Count/)
})

test('SM control presets follow register bit fields, not a universal magic value', () => {
  for (const [value, buffers, direction, watchdogTrigger] of [[0x26, 1, 1, false], [0x22, 1, 0, false], [0x64, 3, 1, true], [0x20, 3, 0, false]]) {
    const control = decodeSmControl(value)
    assert.equal(control.buffers, buffers)
    assert.equal(control.direction, direction)
    assert.equal(control.watchdogTrigger, watchdogTrigger)
    assert.equal(control.alEvent, true)
    assert.equal(control.ecatEvent, false)
    assert.equal(control.warnings.length, 0)
  }
  assert.equal(decodeSmControl('#x10').ecatEvent, true)
})

test('SM control exposes reserved modes, directions and bit 7 independently', () => {
  assert.equal(decodeSmControl(1).modeValid, false)
  assert.equal(decodeSmControl(3).modeValid, false)
  assert.equal(decodeSmControl(8).directionValid, false)
  assert.equal(decodeSmControl(12).directionValid, false)
  assert.equal(decodeSmControl(0x80).reservedBit, true)
  assert.equal(decodeSmControl(0xff).warnings.length, 3)
  assert.equal(decodeSmControl(0xff).buffers, null)
  assert.deepEqual(decodeSmControl(0x26).bits.map(bit => bit.value), [0, 0, 1, 0, 0, 1, 1, 0])
  assert.throws(() => decodeSmControl('0x100'), /范围/)
})

test('SM control bit 7 is Sequential mode only for explicitly supported ESCs', () => {
  const legacy = decodeSmControl('0xE4')
  assert.equal(legacy.reservedBit, true)
  assert.equal(legacy.sequentialMode, false)
  assert.equal(legacy.warnings.length, 1)
  const supported = decodeSmControl('0xE4', { sequentialSupported: true })
  assert.equal(supported.bit7, true)
  assert.equal(supported.reservedBit, false)
  assert.equal(supported.sequentialMode, true)
  assert.equal(supported.warnings.length, 0)
  assert.equal(supported.buffers, 3)
  assert.equal(decodeSmControl('0x64', { sequentialSupported: true }).sequentialMode, false)
})
