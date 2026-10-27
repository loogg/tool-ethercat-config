// Object definition, local allocation and request-dependent transfer geometry are separate.
const permissions = { rw: { read: true, write: true }, ro: { read: true, write: false }, wo: { read: false, write: true }, rw_preop: { read: true, write: true, writeState: 'PREOP' } }
const states = ['PREOP', 'SAFEOP', 'OP']
export const subIndexText = value => `:${Number(value).toString(16).toUpperCase().padStart(2, '0')}`
export const byteText = value => value.toString(16).toUpperCase().padStart(2, '0')
export const valueText = entry => `0x${entry.value.toString(16).toUpperCase().padStart(entry.logicalBits / 4, '0')}`

function littleEndian(value, byteLength) {
  return Array.from({ length: byteLength }, (_, offset) => Math.floor(value / 2 ** (offset * 8)) & 255)
}
function startIndex(raw) {
  const text = String(raw ?? '').trim()
  if (!/^(?:0x[\da-f]+|\d+)$/i.test(text)) return null
  const value = Number(text)
  return Number.isInteger(value) && value >= 0 && value <= 255 ? value : null
}

export function sscStorageLayout(object) {
  let bitOffset = 0
  const rows = object.entries.map(entry => {
    const allocatedBits = entry.role === 'header' && object.code !== 'VARIABLE' ? 16 : entry.logicalBits
    const row = { subIndex: entry.subIndex, name: entry.name, cName: entry.role === 'header' ? 'u16SubIndex0' : `value${entry.subIndex}`, cType: [8, 16, 32].includes(allocatedBits) ? `UINT${allocatedBits}` : '未建模', allocatedBits, bitOffset, byteOffset: bitOffset / 8 }
    bitOffset += allocatedBits
    return row
  })
  return { profile: 'SSC默认示意 · 以8 bit Byte计偏移', rows, totalBits: bitOffset }
}

export function deriveSdoAccess(object, request) {
  const storage = sscStorageLayout(object)
  const result = { object, storage, request, checks: [], valid: false, kind: 'input', abortCode: null, segments: [], bytes: [], byteLength: 0, start: null }
  function fail(kind, message, abortCode = null) { return { ...result, kind, message, abortCode } }
  function check(id, label, ok, detail, skipped = false) { result.checks.push({ id, label, status: skipped ? 'skip' : ok ? 'pass' : 'fail', detail }); return ok }
  const start = startIndex(request.start)
  if (!check('input', '请求参数', start !== null && ['single', 'complete'].includes(request.mode) && ['read', 'write'].includes(request.operation) && states.includes(request.state) && Object.hasOwn(permissions, request.permission) && typeof request.completeSupported === 'boolean', '起始SI为0…255，支持0x十六进制；读写、状态与权限须有效。')) return fail('input', '请输入0…255的整数子索引，并选择有效的访问参数。此时尚未形成合法SDO请求。')
  result.start = start
  const complete = request.mode === 'complete'
  if (!check('kind', '对象组织', !complete || object.code !== 'VARIABLE', complete ? `${object.code}：SSC默认CA适用于ARRAY/RECORD。` : '单项访问按所选条目的实际类型处理。')) return fail('abort', 'VARIABLE的:00就是变量值，SSC默认不接受这里的复合对象完整访问。', '0x06010000')
  if (!check('start', 'CA起点', !complete || start <= 1, complete ? '完整访问只能从SI0或SI1开始。' : '单项访问不受CA的0/1起点限制。', !complete)) return fail('abort', `CA从${subIndexText(start)}开始不受支持；这不表示该子索引在单项访问中一定不存在。`, '0x06010000')
  if (!check('capability', 'CA能力', !complete || request.completeSupported, complete ? '栈和对象必须实际支持CA；ESI声明本身不构成实现。' : '单项访问不要求CA能力。', !complete)) return fail('precondition', '教学CA能力关闭，当前不生成成功载荷；实际设备返回的Abort代码以目标栈和对象实现为准。')
  const entries = complete ? object.entries.filter(entry => entry.subIndex >= start && entry.subIndex <= object.accessUpperSubIndex) : object.entries.filter(entry => entry.subIndex === start)
  if (!check('exists', '访问范围', entries.length > 0 && entries.some(entry => entry.subIndex === start), `教学对象声明到${subIndexText(object.declaredMaxSubIndex)}，本次CA访问上界为${subIndexText(object.accessUpperSubIndex)}。`)) return fail('abort', `对象没有可访问的${subIndexText(start)}条目。`, '0x06090011')
  // The teaching scope is contiguous, fixed unsigned entries with a uniform permission policy.
  if (complete && entries.length !== object.accessUpperSubIndex - start + 1) return fail('unmodeled', '对象存在未展开的子项；当前教学模型不猜测空洞的CA布局。')
  if (entries.some(entry => ![8, 16, 32].includes(entry.logicalBits) || !Number.isInteger(entry.value) || entry.value < 0 || entry.value >= 2 ** entry.logicalBits)) return fail('unmodeled', '当前教学布局只处理已明确值的8/16/32 bit无符号条目，未生成猜测载荷。')
  const access = permissions[request.permission]
  if (!check('permission', '读写权限', access[request.operation], `本演示统一权限为${request.permission}，${request.operation === 'read' ? 'Upload读取' : 'Download写入'}。`)) return fail('abort', request.operation === 'read' ? '该示例为只写对象，不允许读取。' : '该示例为只读对象，不允许写入。', request.operation === 'read' ? '0x06010001' : '0x06010002')
  if (!check('state', '允许状态', request.operation !== 'write' || !access.writeState || access.writeState === request.state, `当前${request.state}${access.writeState ? `，写入只允许${access.writeState}` : '，本示例不增加状态限制'}。`)) return fail('abort', '当前状态不允许本示例的数据写入。', '0x08000022')
  let offset = 0
  for (const entry of entries) {
    const bytes = littleEndian(entry.value, entry.logicalBits / 8)
    result.segments.push({ id: `entry-${entry.subIndex}`, role: 'entry', subIndex: entry.subIndex, name: `${subIndexText(entry.subIndex)} ${entry.name}`, byteOffset: offset, byteLength: bytes.length, bytes })
    offset += bytes.length
    if (complete && start === 0 && entry.role === 'header') {
      result.segments.push({ id: 'ca-si0-padding', role: 'ca-padding', subIndex: null, associatedSubIndex: 0, name: 'CA对齐填充', byteOffset: offset, byteLength: 1, bytes: [0] })
      offset++
    }
  }
  result.bytes = result.segments.flatMap(segment => segment.bytes)
  result.byteLength = offset
  return { ...result, valid: true, kind: 'success', message: !complete ? `单项${subIndexText(start)}按条目逻辑位长传输有效数据。` : start === 0 ? '包含SI0：8 bit有效值后补1Byte，SI1从载荷偏移2Byte开始。' : '不含SI0：SI1从载荷偏移0开始；SSC本地SI1偏移仍为16bit（2个8bit Byte）。' }
}
