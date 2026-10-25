/** Deterministic local calculations. Examples do not establish device defaults. */
export class CalculationError extends Error {
  constructor(message, field = '', issues) {
    super(message)
    this.name = 'CalculationError'
    this.field = field
    this.issues = issues ?? [{ field, message }]
  }
}

/** Decimal, 0xHEX and ESI #xHEX only; never partially parses a value. */
export function parseUnsigned(input, { name = '数值', field = '', min = 0, max = 0xffffffff } = {}) {
  if (typeof input !== 'string' && typeof input !== 'number') {
    throw new CalculationError(`${name}请输入整数。`, field)
  }
  const text = String(input).trim()
  if (!/^(?:\d+|(?:0x|#x)[0-9a-f]+)$/i.test(text)) {
    throw new CalculationError(`${name}须为十进制或以 0x / #x 开头的十六进制整数。`, field)
  }
  const value = Number(/^#x/i.test(text) ? `0x${text.slice(2)}` : text)
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new CalculationError(`${name}范围为 ${min}–${max}。`, field)
  }
  return value
}

export function formatHex(value, width = 4) {
  return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`
}

function mappingResult(index, subIndex, bitLength) {
  // Multiplication avoids JavaScript's signed 32-bit bitwise result.
  const value = index * 65536 + subIndex * 256 + bitLength
  return {
    value, hex: formatHex(value, 8), index, subIndex, bitLength,
    indexHex: formatHex(index, 4), subIndexHex: formatHex(subIndex, 2),
    lengthHex: formatHex(bitLength, 2), padding: index === 0,
  }
}

export function decodePdoMapping(input) {
  const value = parseUnsigned(input, { name: '映射值', field: 'word' })
  const bitLength = value % 256
  if (bitLength === 0) throw new CalculationError('映射位长不能为 0；有效长度为 1–255 bit。', 'word')
  return mappingResult(Math.floor(value / 65536), Math.floor(value / 256) % 256, bitLength)
}

export function encodePdoMapping({ index, subIndex, bitLength }) {
  return mappingResult(
    parseUnsigned(index, { name: 'Index', field: 'index', max: 65535 }),
    parseUnsigned(subIndex, { name: 'SubIndex', field: 'subIndex', max: 255 }),
    parseUnsigned(bitLength, { name: '位长', field: 'bitLength', min: 1, max: 255 }),
  )
}

/** Consecutive bit packing; no automatic field alignment or inserted padding. */
export function calculateBitLayout(fields, { maxFieldBits = 255 } = {}) {
  if (!Array.isArray(fields)) throw new CalculationError('字段列表无效。', 'fields')
  let cursor = 0
  const rows = fields.map((field, i) => {
    const bitLength = parseUnsigned(field.bits, {
      name: `第 ${i + 1} 个字段位长`, field: `fields.${i}.bits`, min: 1, max: maxFieldBits,
    })
    const bitOffset = cursor
    cursor += bitLength
    const byteOffset = Math.floor(bitOffset / 8)
    const bitInByte = bitOffset % 8
    return {
      id: field.id ?? i, name: field.name?.trim() || `字段 ${i + 1}`,
      bitLength, bitOffset, byteOffset, bitInByte, endBitExclusive: cursor,
      endByte: Math.floor((cursor - 1) / 8),
      crossesByte: byteOffset !== Math.floor((cursor - 1) / 8),
      smallFieldCrossesByte: bitLength <= 8 && bitInByte + bitLength > 8,
      largeFieldUnalignedWord: bitLength > 8 && bitOffset % 16 !== 0,
    }
  })
  const totalBytes = Math.ceil(cursor / 8)
  return { rows, totalBits: cursor, totalBytes, byteAligned: cursor % 8 === 0, unusedBits: totalBytes * 8 - cursor }
}

/** End addresses are exclusive; length alignment is an explicit template condition. */
export function planSmMemory({ ramStart, ramEnd, alignment = 1, checkLengthAlignment = true, internalWidth = 8, channels }) {
  const issues = []
  function read(input, options) {
    try { return parseUnsigned(input, options) } catch (error) {
      if (!(error instanceof CalculationError)) throw error
      issues.push(...error.issues)
      return null
    }
  }
  const start = read(ramStart, { name: 'RAM 起始地址', field: 'ramStart', min: 0x1000, max: 65535 })
  const end = read(ramEnd, { name: 'RAM 结束地址', field: 'ramEnd', min: 1, max: 65536 })
  const align = read(alignment, { name: '起始地址对齐', field: 'alignment', min: 1, max: 4 })
  const width = read(internalWidth, { name: 'ESC 内部处理宽度', field: 'internalWidth', min: 8, max: 64 })
  if (width !== null && ![8, 16, 32, 64].includes(width)) issues.push({ field: 'internalWidth', message: 'ESC 内部处理宽度只能为 8、16、32 或 64 bit。' })
  const wordBytes = width !== null && [8, 16, 32, 64].includes(width) ? width / 8 : 1
  if (align !== null && ![1, 2, 4].includes(align)) issues.push({ field: 'alignment', message: '起始地址对齐只能为 1、2 或 4 字节。' })
  if (start !== null && end !== null && end <= start) issues.push({ field: 'ramEnd', message: 'RAM 结束地址必须大于起始地址；结束地址不包含在 RAM 范围内。' })
  if (!Array.isArray(channels)) throw new CalculationError('SyncManager 列表无效。', 'channels')
  const rows = channels.map((channel, i) => {
    const name = channel.name || `SM${i}`
    const rowStart = read(channel.start, { name: `${name} 起始地址`, field: `channels.${i}.start`, max: 65535 })
    const length = read(channel.length, { name: `${name} 单缓冲长度`, field: `channels.${i}.length`, max: 65535 })
    const buffers = read(channel.buffers, { name: `${name} 缓冲数量`, field: `channels.${i}.buffers`, min: 1, max: 3 })
    if (buffers !== null && ![1, 3].includes(buffers)) issues.push({ field: `channels.${i}.buffers`, message: `${name} 缓冲数量只能为 1 或 3。` })
    const active = length !== null && length > 0
    const visibleEnd = rowStart === null || length === null ? null : rowStart + length
    const physicalStart = rowStart === null ? null : active ? Math.floor(rowStart / wordBytes) * wordBytes : rowStart
    const bufferSpan = active && visibleEnd !== null ? Math.ceil(visibleEnd / wordBytes) * wordBytes - physicalStart : 0
    // Section I §8.5: L = 1 bypasses buffering; extra buffers 1 and 2 are unused.
    const effectiveBuffers = !active ? 0 : length === 1 ? 1 : buffers
    const allocated = effectiveBuffers === null ? 0 : bufferSpan * effectiveBuffers
    const rowEnd = physicalStart === null ? null : physicalStart + allocated
    if (active && rowStart !== null && align !== null && [1, 2, 4].includes(align) && rowStart % align !== 0) {
      issues.push({ field: `channels.${i}.start`, message: `${name} 起始地址未按 ${align} 字节对齐；工具不会自动修改地址。` })
    }
    if (active && checkLengthAlignment && align !== null && [1, 2, 4].includes(align) && length % align !== 0) {
      issues.push({ field: `channels.${i}.length`, message: `${name} 单缓冲长度未按 ${align} 字节对齐；这是当前启用的模板条件检查。` })
    }
    if (active && rowEnd !== null && rowEnd > 65536) issues.push({ field: `channels.${i}.length`, message: `${name} 的物理缓冲范围超出 16 位地址空间。` })
    if (active && physicalStart !== null && start !== null && end !== null && (physicalStart < start || rowEnd > end)) {
      issues.push({ field: `channels.${i}.start`, message: `${name} 的完整物理占用（含内部字宽向外取整）必须位于指定 RAM 范围内。` })
    }
    return { name, start: rowStart, visibleEnd, physicalStart, bufferSpan, length, buffers, effectiveBuffers, singleByteMode: length === 1, active, allocated, end: rowEnd, sourceIndex: i }
  })
  const activeRows = rows.filter(row => row.active && row.start !== null && row.end !== null)
  for (let i = 0; i < activeRows.length; i += 1) {
    for (let j = i + 1; j < activeRows.length; j += 1) {
      const a = activeRows[i]
      const b = activeRows[j]
      if (a.physicalStart < b.end && b.physicalStart < a.end) {
        issues.push({ field: `channels.${a.sourceIndex}.start`, message: `${a.name} 与 ${b.name} 的物理缓冲区重叠（已计入三缓冲和内部字宽占用）。` })
        issues.push({ field: `channels.${b.sourceIndex}.start`, message: `${b.name} 与 ${a.name} 的物理缓冲区重叠。` })
      }
    }
  }
  if (issues.length) throw new CalculationError('请修正内存规划中的输入。', issues[0].field, issues)
  const capacity = end - start
  const usedBytes = rows.reduce((sum, row) => sum + row.allocated, 0)
  const gaps = []
  let cursor = start
  for (const row of [...activeRows].sort((a, b) => a.physicalStart - b.physicalStart)) {
    if (row.physicalStart > cursor) gaps.push({ start: cursor, end: row.physicalStart, length: row.physicalStart - cursor })
    cursor = row.end
  }
  if (cursor < end) gaps.push({ start: cursor, end, length: end - cursor })
  return { ramStart: start, ramEnd: end, capacity, rows, usedBytes, freeBytes: capacity - usedBytes, gaps, alignment: align, checkLengthAlignment, internalWidth: width, wordBytes }
}

const TIME_DIVISORS = { ns: 1, us: 1000, ms: 1000000, s: 1000000000 }

export function calculateWatchdogs({ divider, smCount, pdiCount, unit = 'ms' }) {
  const d = parseUnsigned(divider, { name: 'Divider', field: 'divider', max: 65535 })
  const sm = parseUnsigned(smCount, { name: 'SM Count', field: 'smCount', max: 65535 })
  const pdi = parseUnsigned(pdiCount, { name: 'PDI Count', field: 'pdiCount', max: 65535 })
  if (!Object.hasOwn(TIME_DIVISORS, unit)) throw new CalculationError('时间单位须为 ns、us、ms 或 s。', 'unit')
  const tickNs = (d + 2) * 40
  const convert = count => ({ count, enabled: count !== 0, timeoutNs: tickNs * count, value: tickNs * count / TIME_DIVISORS[unit] })
  return { divider: d, tickNs, tick: tickNs / TIME_DIVISORS[unit], unit, sm: convert(sm), pdi: convert(pdi) }
}

export function decodeSmControl(input, { sequentialSupported = false } = {}) {
  const value = parseUnsigned(input, { name: 'ControlByte', field: 'control', max: 255 })
  const mode = value & 3
  const direction = (value >> 2) & 3
  const modeValid = mode === 0 || mode === 2
  const directionValid = direction === 0 || direction === 1
  const ecatEvent = Boolean(value & 0x10)
  const alEvent = Boolean(value & 0x20)
  const watchdogTrigger = Boolean(value & 0x40)
  const bit7 = Boolean(value & 0x80)
  const reservedBit = bit7 && !sequentialSupported
  const sequentialMode = bit7 && sequentialSupported
  const warnings = []
  if (!modeValid) warnings.push(`bits 1:0 = ${mode.toString(2).padStart(2, '0')} 为保留模式，不能作为有效缓冲模式。`)
  if (!directionValid) warnings.push(`bits 3:2 = ${direction.toString(2).padStart(2, '0')} 为保留方向组合。`)
  if (reservedBit) warnings.push('当前未声明 Sequential mode 支持：按传统 ESC 的保留位规则，bit 7 写入时应为 0。请先核对具体 ESC 能力。')
  return {
    value, hex: formatHex(value, 2), binary: value.toString(2).padStart(8, '0'),
    mode, modeValid, buffers: modeValid ? (mode === 0 ? 3 : 1) : null,
    modeLabel: mode === 0 ? '三缓冲模式' : mode === 2 ? '单缓冲 / Mailbox 模式' : '保留模式',
    direction, directionValid,
    directionLabel: direction === 0 ? 'ECAT 读 / PDI 写' : direction === 1 ? 'ECAT 写 / PDI 读' : '保留方向',
    ecatEvent, alEvent, watchdogTrigger, bit7, reservedBit, sequentialMode, sequentialSupported, warnings,
    bits: Array.from({ length: 8 }, (_, i) => ({ bit: 7 - i, value: (value >> (7 - i)) & 1 })),
  }
}
