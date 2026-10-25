import dagre from '@dagrejs/dagre'
import { parseUnsigned, calculateBitLayout, planSmMemory, decodeSmControl } from './calculations.js'
import { sourceLabels, normalize } from './library.js'
import { getConfigModel } from '../data/config-models.js'

export const NODE_WIDTH = 258
export const NODE_HEIGHT = 148
export const GROUP_WIDTH = 294
export const GROUP_HEIGHT = 236
export const relationKinds = {
  initializes: { label: '初始化', color: '#3971bc', directed: true },
  references: { label: '引用', color: '#64748b', directed: true },
  requires: { label: '前置条件', color: '#9a7137', directed: true },
  derives: { label: '计算', color: '#257867', directed: true },
  constrains: { label: '约束', color: '#94632e', directed: true },
  describes: { label: '描述', color: '#78879b', directed: false },
  context: { label: '相关', color: '#94a0b2', directed: false },
  selects: { label: '路径选择', color: '#7b6a9d', directed: true },
  encodes: { label: '编码', color: '#527ca8', directed: true },
}
export const nodeKindLabels = { config: '配置字段', object: 'CoE 对象', subentry: '对象子项', register: 'ESC 寄存器', calculation: '计算规则', rule: '条件规则', artifact: '生成 / 接口', concept: '协议参考', mode: '工作模式', overview: '分组说明' }
const SSC_DOC = { title: 'Beckhoff ET9300 · SSC V1.10', url: 'https://download.beckhoff.com/download/document/io/ethercat-development-products/an_et9300_v1i10.pdf', note: 'SSC 框架参考；对照相应对象、同步或应用定义章节及目标版本。' }
const ESC_DOC = { title: 'Beckhoff ESC · Register Description V3.3', url: 'https://download.beckhoff.com/download/Document/io/ethercat-development-products/ethercat_esc_datasheet_sec2_registers_v3.3.pdf', note: 'SyncManager / Watchdog 寄存器；支持能力以实际 ESC 为准。' }
const shortSummaries = {
  'min-pd-cycle-time': '声明最小应用处理周期。固定值用于初始化同步参数，0 选择运行测量路径。',
  'max-pd-output-size': '固件支持的 RxPDO 字节容量上限；实际映射长度必须小于或等于它。',
  'max-pd-input-size': '固件支持的 TxPDO 字节容量上限；实际映射长度由活动映射确定。',
  'coe-device-name': '设置产品名称；通过 CoE 的设备名称对象查询。',
  'coe-hardware-version': '设置硬件版本字符串，并与实际硬件版本保持一致。',
  'coe-software-version': '设置从站固件版本字符串。',
  'coe-identity': '定义厂商、产品码、接口修订和序列号；与 ESI / SII 身份一致。',
  'xlsx-access': '定义 CoE / SDO 读写权限，可按设备状态限制写入。',
  'xlsx-rx-tx': '声明该成员允许映射到 RxPDO 还是 TxPDO，与 SDO 权限分别配置。',
  'esi-sm': '描述 SyncManager 的地址、长度和控制方式，供主站组态使用。',
  'esi-control-byte': '按位描述 SM 的模式、方向、事件和看门狗触发。',
}

export function entryPosition(entry) {
  const source = entry.sources[0]
  if (entry.collection === 'SSC') return { surface: 'SSC Tool', parent: entry.group?.replaceAll('/', ' › ') || 'Slave Project', selector: entry.name }
  if (entry.collection === 'APP') return { surface: '应用定义文件', parent: source.path.replace(/\s+\/\s+/g, ' › ').replace(/（用户模板）/g, '').trim() || (entry.group === 'device' ? '设备与模块' : '对象字典字段'), selector: source.path }
  if (entry.collection === 'ESI') {
    const parts = source.path.split('/').filter(Boolean)
    return { surface: 'ESI', parent: parts.slice(0, -1).join(' › ') || 'EtherCATInfo', selector: parts.at(-1) || entry.name }
  }
  return { surface: sourceLabels[source.kind] || '协议参考', parent: '对象与机制', selector: source.path }
}

export function entryNode(entry) {
  return {
    id: entry.id, entryId: entry.id, kind: entry.nodeKind || (entry.overview ? 'overview' : entry.collection === 'concepts' ? 'concept' : 'config'),
    name: entry.name, title: entry.title, position: entryPosition(entry),
    brief: shortSummaries[entry.id] || entry.summary,
    fields: (entry.facts || []).filter(f => f.label !== '默认值').slice(0, 2),
    rules: entry.rules || [], references: entry.references || [], entry,
  }
}

function extraNode(id, kind, name, parent, brief, fields = [], options = {}) {
  return { id, kind, name, title: name, position: { surface: kind === 'object' ? 'CoE' : kind === 'register' ? 'ESC' : kind === 'calculation' ? '计算' : kind === 'rule' ? '规则' : '模式', parent, selector: name }, brief, fields, rules: [], references: kind === 'register' ? [ESC_DOC] : [SSC_DOC], ...options }
}
function edge(id, source, target, kind, label, description, condition = '', references = [SSC_DOC]) {
  return { id, source, target, kind, label, description, condition, references }
}

export function cycleScenario(rawValue = '100000') {
  try {
    const ns = parseUnsigned(rawValue, { name: '周期', max: 0xffffffff })
    return { valid: true, ns, measured: ns === 0, display: ns ? `${ns.toLocaleString('en-US')} ns` : '运行时测量', microseconds: ns / 1000, error: '' }
  } catch (error) { return { valid: false, ns: null, measured: false, display: '输入待修正', error: error.message } }
}

export function capacityScenario(rawBits = '16, 32', rawCapacity = '16') {
  try {
    const parts = String(rawBits).trim().split(/[,，;；\s]+/).filter(Boolean)
    if (parts.length > 64) throw new Error('演算示例最多支持 64 个字段。')
    const layout = calculateBitLayout(parts.map((bits, i) => ({ name: `字段 ${i + 1}`, bits })))
    const capacity = parseUnsigned(rawCapacity, { name: '容量上限', max: 65535 })
    return { valid: true, bits: layout.rows.map(r => r.bitLength), totalBits: layout.totalBits, bytes: layout.totalBytes, capacity, fits: layout.totalBytes <= capacity, error: '' }
  } catch (error) { return { valid: false, error: error.message, fits: false } }
}

export function bufferScenario(length, capacity, { buffers = '3', internalWidth = '8', start = '0x1200' } = {}) {
  try {
    const plan = value => planSmMemory({ ramStart: '0x1000', ramEnd: '0x10000', alignment: 1, checkLengthAlignment: false, internalWidth, channels: [{ name: 'SM 示例', start, length: String(value), buffers }] }).rows[0]
    const actual = plan(length)
    const reserved = plan(capacity)
    return { valid: true, actual, reserved, internalWidth: Number(internalWidth), wordBytes: Number(internalWidth) / 8, buffers: Number(buffers), error: '' }
  } catch (error) { return { valid: false, error: error.issues?.map(issue => issue.message).slice(0, 2).join(' ') || error.message } }
}

function cycleGraph(entry, rawValue, entries, expanded) {
  const delay = entry.id.endsWith('delay-time')
  const minimum = entry.id === 'min-pd-cycle-time'
  const suffixes = minimum ? ['32', '33'] : [entry.id.includes('output') ? '32' : '33']
  const subIndex = minimum ? 5 : delay ? 9 : 6
  const subHex = subIndex.toString(16).toUpperCase().padStart(2, '0')
  const fieldName = minimum ? 'Minimum Cycle Time' : delay ? 'Delay Time' : 'Calc and Copy Time'
  const scenario = cycleScenario(rawValue)
  if (delay && scenario.valid) { scenario.measured = false; scenario.display = `${scenario.ns.toLocaleString('en-US')} ns` }
  const root = { ...entryNode(entry), fields: [{ label: '演算示例', value: scenario.display }, { label: '单位', value: 'ns' }] }
  const parents = suffixes.map(suffix => extraNode(`object-1c${suffix}`, 'object', `0x1C${suffix}`, '同步参数对象', `这是${suffix === '33' ? '输入' : '输出'}同步参数对象的16bit索引；0x1C32与0x1C33是两个对象，不是高低字节对。`, [{ label: '方向', value: suffix === '33' ? '输入同步参数' : '输出同步参数' }], { isGroup: true, scope: suffix === '33' ? '输入同步参数' : '输出同步参数', addressParts: { index: Number(`0x1c${suffix}`) } }))
  const coe = suffixes.map(suffix => extraNode(`object-1c${suffix}-${subHex}`, 'subentry', `:${subHex} ${fieldName}`, `0x1C${suffix} · ${suffix === '33' ? '输入' : '输出'}同步参数`, `对象中的子索引0x${subHex}。字段为UINT32，单位ns；${delay ? '描述物理延迟，不自动补偿。' : '固定值或运行测量结果维护该字段。'}`, [{ label: '类型 / 单位', value: 'UINT32 · ns' }, { label: '演算值', value: scenario.display }], { parentId: `object-1c${suffix}`, identifier: `0x1C${suffix}:${subHex}`, addressParts: { index: Number(`0x1c${suffix}`), subIndex }, valueBits: scenario.valid && !scenario.measured ? scenario.ns : null, position: { surface: 'CoE', parent: `0x1C${suffix} · ${suffix === '33' ? '输入' : '输出'}同步参数`, selector: `0x1C${suffix}:${subHex}` } }))
  const measurement = extraNode('mode-cycle-measurement', 'mode', '运行测量', 'CoE 控制 › Get Cycle Time', '宏设为0时走测量路径；按目标SSC版本通过支持的Get Cycle Time控制项请求测量，并具备可用计时能力。0不代表处理耗时为0。', [{ label: '控制项', value: '0x1C32:08 / 0x1C33:08' }, { label: '条件', value: '宏=0；支持路径写bit0' }], { rules: ['Get Cycle Time 是UINT16控制项，bit0用于请求测量。', '控制路径与测量基础按目标SSC版本核对；本工具仅演示关系，不读取或执行硬件测量。'] })
  const edges = scenario.measured ? [
    edge('cycle-mode', root.id, measurement.id, 'selects', '0：测量路径', '0 选择运行测量机制，不能直接作为零耗时。', '需按目标版本启用 :08 控制及可用计时基础'),
    ...coe.map(n => edge(`measure-${n.id}`, measurement.id, n.id, 'initializes', '测量后更新', '对象值由运行测量逻辑维护。', '这是测量路径示意；本工具不执行硬件测量')),
  ] : coe.map(n => edge(`initialize-${n.id}`, root.id, n.id, 'initializes', '固定值初始化', `使用 SSC 固定值初始化 ${fieldName}。`, '固定值模式；具体更新路径以目标 SSC 版本为准'))
  const nodes = [root, ...parents, ...coe, ...(scenario.measured ? [measurement] : [])]
  const byId = new Map(entries.map(item => [item.id, item]))
  const related = (entry.relations || []).map((relation, i) => {
    const target = byId.get(relation.target)
    return target && !target.overview ? { node: entryNode(target), edge: legacyEdge(entry, target, relation, i) } : null
  }).filter(record => record?.edge)
  if (expanded) { for (const record of related) { if (!nodes.some(node => node.id === record.node.id)) nodes.push(record.node); edges.push(record.edge) } }
  return { rootId: root.id, nodes, edges, scenario, sample: 'cycle', supportsMeasurement: !delay, contextNote: delay ? 'Delay Time 是延迟描述，不自动补偿。0可以是固定描述值，不切换到周期测量。' : '冒号前是16bit对象索引，冒号后是8bit子索引。1C32与1C33不是高低字节对。', extraCount: expanded ? 0 : related.length }
}

function capacityGraph(entry, rawBits, rawCapacity, expanded, memoryOptions) {
  const input = entry.id === 'max-pd-input-size'
  const pdo = input ? 'TxPDO' : 'RxPDO'
  const xmlPdo = input ? 'TxPdo' : 'RxPdo'
  const sm = input ? 'Inputs' : 'Outputs'
  const scenario = capacityScenario(rawBits, rawCapacity)
  const buffer = scenario.valid ? bufferScenario(scenario.bytes, scenario.capacity, memoryOptions) : { valid: false, error: '先修正活动位长或容量输入。' }
  const root = { ...entryNode(entry), bufferModel: buffer, status: !scenario.valid ? 'invalid' : !scenario.fits ? 'over-capacity' : null, fields: [{ label: '容量示例', value: scenario.valid ? `${scenario.capacity} Byte` : '输入待修正' }, { label: '方向', value: `${input ? '从站 → 主站' : '主站 → 从站'} · ${pdo}` }] }
  const active = extraNode('object-active-rxpdo', 'object', `活动 ${pdo} 映射`, input ? '0x1C13 → 0x1A00…' : '0x1C12 → 0x1600…', 'Assignment 选择映射对象；映射条目决定实际字段和位长，包含显式 padding。', [{ label: '示例位长', value: scenario.valid ? `${scenario.bits.join(' + ')} bit` : '输入待修正' }, { label: '配置状态', value: '演算示例，非在线读取' }])
  const formula = extraNode('rule-active-length', 'calculation', '活动长度与 SM 占用', 'PDO 位流 → Byte → 物理缓冲', '先求L=ceil(Σ bit/8)，再按地址和内部字宽求每缓冲跨度B；物理占用为B×有效缓冲数量。', [{ label: '活动长度 L', value: scenario.valid ? `${scenario.bytes} Byte` : '输入待修正' }, { label: 'SM 实际占用', value: buffer.valid ? `${buffer.actual.bufferSpan} × ${buffer.actual.effectiveBuffers} = ${buffer.actual.allocated} B` : '输入待修正' }], { bufferModel: buffer })
  const esiDefault = extraNode('field-esi-output-default', 'config', '@DefaultSize', `Device › Sm[${sm}]`, 'ESI 中的默认 SM 长度，不等于固件支持的最大容量。', [{ label: '语义', value: '默认长度 ≠ 容量上限' }], { entryId: 'esi-sm', position: { surface: 'ESI', parent: `Device › Sm[${sm}]`, selector: '@DefaultSize' } })
  const app = extraNode('field-app-member', 'config', 'DataType · rx/tx', '应用对象成员', '定义成员的协议位宽与 PDO 可映射方向。', [{ label: '说明', value: '还需对象允许被映射' }], { entryId: 'xlsx-data-type', position: { surface: '应用定义文件', parent: '用户模板 › E列 DataType / M列 rx/tx', selector: 'DataType / rx/tx' } })
  const esi = extraNode('field-esi-entry', 'config', 'Index · SubIndex · BitLen', `Device / Module › ${xmlPdo} › Entry`, '离线描述默认或可选 PDO 成员，不能当作当前活动映射。', [{ label: '定位', value: '具体设备或模块的 Entry' }], { entryId: 'esi-entry', position: { surface: 'ESI', parent: `Device / Module › ${xmlPdo} › Entry`, selector: 'Index / SubIndex / BitLen' } })
  const edges = [
    edge('active-bits', active.id, formula.id, 'derives', '活动位长求和', 'L = ceil(全部活动字段 bit 长度之和 / 8)，含显式 padding。'),
    edge('capacity-check', formula.id, root.id, 'constrains', 'L ≤ 容量', '当前活动长度不得超过固件容量。容量应覆盖所有允许布局中的最大需求，可保留余量。'),
    edge('esi-default', esiDefault.id, root.id, 'describes', '默认值 ≠ 上限', 'ESI DefaultSize、主站实际 SM Length、固件最大容量分别表达；不画为恒等。'),
    ...(expanded ? [edge('app-defines', app.id, active.id, 'describes', '定义可映射成员', '应用定义提供类型和方向；实际活动组合由 Assignment / Mapping 确定。'), edge('esi-describes', esi.id, active.id, 'describes', '描述候选布局', 'ESI 描述默认或可选映射；实际配置需核对主站和从站对象。')] : []),
  ]
  const constraint = edges.find(link => link.id === 'capacity-check')
  constraint.failed = scenario.valid && !scenario.fits
  if (constraint.failed) { constraint.label = '容量不足'; constraint.condition = `演算结果：${scenario.bytes} Byte > ${scenario.capacity} Byte，需要调整容量或允许的映射。` }
  return { rootId: root.id, nodes: [root, active, formula, esiDefault, ...(expanded ? [app, esi] : [])], edges, scenario, buffer, sample: 'capacity', contextNote: '实际占用按当前 Length 计算；按容量上限预留另算。Length=1 不使用额外缓冲。', extraCount: expanded ? 0 : 2 }
}

function watchdogGraph(entry) {
  const root = entryNode(entry)
  const technology = { title: 'Beckhoff ESC Technology V2.5 · Watchdogs §13', url: 'https://download.beckhoff.com/download/document/io/ethercat-development-products/ethercat_esc_datasheet_sec1_technology_v2.5.pdf', note: '40ns时基的标称估算，硬件有计时量化；具体型号和第二PDI支持另核对。' }
  const references = [ESC_DOC, technology]
  const status = extraNode('register-sm-watchdog-status', 'register', '0x0440 · SM WD Status', 'ESC › 过程数据看门狗状态', '宏为1时SSC读取硬件过程数据看门狗状态；此寄存器不是PDI看门狗状态。', [{ label: 'SSC宏值', value: 'ESC_SM_WD_SUPPORTED = 1' }])
  const software = extraNode('mode-software-watchdog', 'mode', 'SSC 本地计时', 'ECAT_CheckTimer()', '宏为0时使用SSC软件计时路径；不是取消所有超时监测，不控制PDI看门狗。', [{ label: 'SSC宏值', value: 'ESC_SM_WD_SUPPORTED = 0' }])
  const divider = extraNode('register-watchdog-time', 'register', '0x0400 · 共享分频器', 'ESC › Watchdog Divider', 'PDI与过程数据看门狗共享这个分频值，但使用各自的计数寄存器。', [{ label: '地址 / 位宽', value: '0x0400–0x0401 · 16 bit' }, { label: '时基示例', value: 'D=2498 → 100µs' }], { references })
  const smCount = extraNode('register-sm-watchdog-count', 'register', '0x0420 · SM WD Time', 'ESC › 过程数据时间', '过程数据看门狗的独立计数；写入启用WD触发的SM时重新计时，一个过程数据WD服务所有相关SM。', [{ label: '地址 / 位宽', value: '0x0420–0x0421 · 16 bit' }, { label: '示例 C_SM', value: '1000；0表示禁用本侧' }], { references })
  const pdiCount = extraNode('register-pdi-watchdog-count', 'register', '0x0410 · PDI WD Time', 'ESC › PDI / PDI0 时间', 'PDI看门狗监视本地PDI访问，单独计数，不受ESC_SM_WD_SUPPORTED直接选择。', [{ label: '地址 / 位宽', value: '0x0410–0x0411 · 16 bit' }, { label: '示例 C_PDI', value: '1000；0表示禁用本侧' }], { references, rules: ['PDI活动重新计时的具体条件按ESC手册核对。', '常见单PDI/PDI0使用0410；有第二PDI的ESC可能另有0412，不能假定所有型号相同。'] })
  const formula = extraNode('rule-watchdog-time', 'calculation', 'SM 看门狗标称时间', '40 ns ESC 时基示例', 'T_SM ≈ (D+2) × 40ns × C_SM；这是标称估算，不是纳秒级精确波形。', [{ label: '公式', value: '(D + 2) × 40 ns × C_SM' }, { label: '示例', value: '2498 / 1000 → 名义100ms' }], { references })
  const pdiFormula = extraNode('rule-pdi-watchdog-time', 'calculation', 'PDI 看门狗标称时间', '独立PDI计数 · 同一分频', 'T_PDI ≈ (D+2) × 40ns × C_PDI；PDI访问与SM写入分别刷新自己的计时。', [{ label: '公式', value: '(D + 2) × 40 ns × C_PDI' }, { label: '示例', value: '2498 / 1000 → 名义100ms' }], { references })
  const esi = extraNode('field-watchdog-trigger', 'config', 'ControlByte · bit 6', 'Device › Sm[Outputs]', '相应SM的Watchdog Trigger Enable；与PDI访问触发是不同链路。', [{ label: '作用', value: '过程数据 WD 触发使能' }], { entryId: 'esi-control-byte', position: { surface: 'ESI', parent: 'Device › Sm[Outputs]', selector: 'ControlByte / bit 6' } })
  return { rootId: root.id, nodes: [root, status, software, divider, smCount, pdiCount, formula, pdiFormula, esi], edges: [
    edge('wd-hardware-path', root.id, status.id, 'selects', '1：硬件状态', '选择通过ESC过程数据看门狗状态检查超时，不选择PDI看门狗。'),
    edge('wd-software-path', root.id, software.id, 'selects', '0：软件计时', '选择SSC本地过程数据超时路径；PDI硬件参数独立。'),
    edge('wd-divider-sm', divider.id, formula.id, 'derives', '共享时基', '0400提供共同的基本时间增量。', '40ns基础周期的ESC模型', references),
    edge('wd-count-time', smCount.id, formula.id, 'derives', '独立SM计数', '0420提供C_SM；不读取0410来计算此阈值。', 'C_SM=0时禁用硬件过程数据WD', references),
    edge('wd-divider-pdi', divider.id, pdiFormula.id, 'derives', '共享时基', 'PDI同样使用0400，但不共用SM的计数。', '40ns基础周期的ESC模型', references),
    edge('wd-pdi-count-time', pdiCount.id, pdiFormula.id, 'derives', '独立PDI计数', '0410提供C_PDI；SM过程数据写入不代替PDI访问。', 'C_PDI=0时禁用本侧PDI WD', references),
    edge('wd-time-status', formula.id, status.id, 'context', '硬件时间阈值', '使能后按过程数据WD硬件规则报告状态。', '不把标称公式当作在线状态测量', references),
    edge('wd-trigger', esi.id, status.id, 'requires', '需启用SM触发', '只有使能WD触发的SM写入才按相应硬件规则刷新过程数据计时。', '具体触发及超时反应按ESC与固件核对', references),
  ], sample: null, timing: 'watchdog', contextNote: '0410=PDI/PDI0，0420=过程数据（SM）；共享0400，各自触发与计数。SSC宏不直接控制PDI。', extraCount: 0 }
}

function smAddressGraph(entry) {
  const read = entry.id.includes('read')
  const mailbox = entry.id.includes('mbx')
  const n = mailbox ? read ? 1 : 0 : read ? 3 : 2
  const label = mailbox ? read ? 'MBoxIn' : 'MBoxOut' : read ? 'Inputs' : 'Outputs'
  const root = entryNode(entry)
  const esi = extraNode(`field-sm${n}-address`, 'config', '@StartAddress', `Device › Sm[${label}]`, 'ESI 描述的默认物理地址应与设备默认配置保持一致。', [{ label: '对应通道', value: `常见四 SM 配置中的 SM${n}` }], { entryId: 'esi-sm', position: { surface: 'ESI', parent: `Device › Sm[${label}]`, selector: '@StartAddress' } })
  const register = extraNode(`register-sm${n}-start`, 'register', `SM${n} Start Address`, `ESC › SyncManager ${n}`, '主站写入的实际 SM 起始地址；可能依据组态调整，需要通过固件范围和对齐校验。', [{ label: '寄存器', value: `0x${(0x800 + n * 8).toString(16).toUpperCase().padStart(4, '0')}–0x${(0x801 + n * 8).toString(16).toUpperCase().padStart(4, '0')}` }])
  const memory = extraNode(`rule-sm${n}-memory`, 'calculation', '完整物理缓冲区', `SM${n} › 地址与 Length`, '内存规划同时考虑可见长度、缓冲数量及 ESC 内部处理字宽。', [{ label: '输入', value: '地址 / Length / 模式 / 内部字宽' }, { label: '检查', value: '边界、对齐、重叠' }])
  return { rootId: root.id, nodes: [root, esi, register, memory], edges: [edge(`default-sm${n}`, root.id, esi.id, 'describes', '默认地址一致', 'SSC 默认地址与相应 ESI 的默认 StartAddress 需要一致。', 'SM 分工以实际设备为准'), edge(`actual-sm${n}`, esi.id, register.id, 'describes', '主站配置实际值', 'ESI 默认值是主站组态依据之一，不保证等于最终运行寄存器值。'), edge(`memory-sm${n}`, register.id, memory.id, 'derives', '参与内存规划', '实际地址和 Length 等共同确定完整物理占用。')], sample: null, contextNote: '默认地址与主站实际配置分别表达；此处 SM 分工为常见四通道布局。', extraCount: 0 }
}

function mappingGraph(entry) {
  const root = entryNode(entry)
  const word = extraNode('rule-mapping-word', 'calculation', '0x70000110', 'PDO Mapping Entry · 32 bit', '高16bit为Index，中8bit为SubIndex，低8bit为映射位长。映射对象自己的Index与被映射成员的Index分开。', [{ label: '被引用成员', value: '0x7000:01' }, { label: '位长', value: '0x10 = 16 bit' }], { mappingParts: { word: 0x70000110, index: 0x7000, subIndex: 1, bitLength: 16 } })
  const parent = extraNode('object-example-7000', 'object', '0x7000', '教学示例对象', '厂家自定义对象地址的示例，不代表某个实际设备必须有这个对象。', [], { isGroup: true, scope: '教学示例对象', addressParts: { index: 0x7000 } })
  const child = extraNode('object-example-7000-01', 'subentry', ':01 示例成员', '0x7000 · 教学示例对象', '映射值引用该对象的0x01子项，长度为16bit。', [{ label: '示例类型', value: 'UINT16' }, { label: '映射位宽', value: '16 bit' }], { parentId: parent.id, addressParts: { index: 0x7000, subIndex: 1 }, identifier: '0x7000:01' })
  const encoding = entry.id === 'xlsx-index' ? 'Index → bits 31:16' : entry.id === 'xlsx-si' ? 'SubIndex → bits 15:8' : entry.id === 'xlsx-data-type' ? 'UINT16 示例 → 16 bit' : '32 bit 映射条目'
  return { rootId: root.id, nodes: [root, word, parent, child], edges: [edge('mapping-definition', root.id, word.id, entry.id === 'pdo-mapping' ? 'describes' : 'encodes', encoding, '格式示例：Index占高16bit，SubIndex占中8bit，BitLength占低8bit；BitLength不是DataType编号。'), edge('mapping-object-ref', word.id, child.id, 'references', '引用 0x7000:01', '0x70000110编码成员地址0x7000:01及16bit位长。')], sample: null, calculator: 'mapping', contextNote: '0x70000110 是32bit映射值；0x7000:01是对象地址，二者不是同一种编码。', extraCount: 0 }
}

function fileGraph(entry) {
  const root = entryNode(entry)
  const hardware = entry.id === 'hw-access-file'
  const artifact = extraNode('artifact-include', 'artifact', hardware ? '硬件适配声明' : '公共系统声明', '生成代码 › include 接入', hardware ? '由硬件适配层提供 ESC 访问、中断、定时器等所需接口。' : '由公共头文件提供类型、编译器适配或系统声明。', [{ label: '输入', value: '项目中的实际头文件路径' }, { label: '核对', value: '生成的 include 与编译器搜索路径' }], { position: { surface: '固件工程', parent: '生成配置 › 公共引用', selector: 'include' }, references: entry.references })
  return { rootId: root.id, nodes: [root, artifact], edges: [edge('include-configuration', root.id, artifact.id, 'references', '接入头文件', '配置头文件名/路径，由生成代码引用；具体写法以工具输入格式和生成结果为准。')], sample: null, contextNote: '这是代码接入关系，没有必然同值的 Excel 或 ESI 字段。', extraCount: 0 }
}

function mailboxSizeGraph(entry, entries) {
  const root = entryNode(entry)
  const other = entryNode(entries.find(e => e.id === (entry.id === 'def-mbx-size' ? 'max-mbx-size' : 'def-mbx-size')))
  const receiver = extraNode('resource-mailbox-rx', 'concept', 'SM0 · Mailbox Out', '常见四 SM 设备 › 接收邮箱', '默认接收邮箱的长度和地址由设备声明与主站组态配合，典型使用单缓冲。', [{ label: '方向', value: '主站 → 从站' }, { label: '模式', value: 'Mailbox · 单缓冲' }], { position: { surface: 'ESC', parent: 'SyncManager 0 › Mailbox', selector: 'Length' }, references: [ESC_DOC] })
  const sender = extraNode('resource-mailbox-tx', 'concept', 'SM1 · Mailbox In', '常见四 SM 设备 › 发送邮箱', '默认发送邮箱同样需独立预算单缓冲区，不能复用接收邮箱的地址空间。', [{ label: '方向', value: '从站 → 主站' }, { label: '模式', value: 'Mailbox · 单缓冲' }], { position: { surface: 'ESC', parent: 'SyncManager 1 › Mailbox', selector: 'Length' }, references: [ESC_DOC] })
  const memory = extraNode('rule-mailbox-memory', 'calculation', 'Mailbox 空间预算', '8 bit 内部处理模型 · 示例', '示例默认每向128B，两个单缓冲共256B。若按每向最大256B预留，则共512B；宽内部字宽还需分别对齐取整。', [{ label: '默认长度示例', value: '128 × 1 + 128 × 1 = 256 B' }, { label: '按上限预留示例', value: '256 × 1 + 256 × 1 = 512 B' }])
  const def = entry.id === 'def-mbx-size' ? root : other
  const max = entry.id === 'max-mbx-size' ? root : other
  return { rootId: root.id, nodes: [root, other, receiver, sender, memory], edges: [edge('mbx-limit', max.id, def.id, 'constrains', 'Default ≤ Max', '默认长度不得超出固件允许的最大邮箱容量。'), edge('mbx-rx-size', def.id, receiver.id, 'describes', '默认接收长度', '与相应Mailbox Sm DefaultSize配合；实际值由主站组态和固件校验决定。'), edge('mbx-tx-size', def.id, sender.id, 'describes', '默认发送长度', '接收与发送邮箱各自预留完整空间。'), edge('mbx-rx-memory', receiver.id, memory.id, 'derives', '单缓冲占用', '邮箱模式采用单缓冲；内部字宽取整规则仍需按ESC考虑。'), edge('mbx-tx-memory', sender.id, memory.id, 'derives', '单缓冲占用', '两个邮箱的物理区间均须位于RAM内，彼此及与过程数据不可重叠。')], sample: null, calculator: 'memory', contextNote: 'Mailbox 长度还包含协议头；缓冲字节数不等于一次可传的SDO业务净载荷。', extraCount: 0 }
}

function controlByteGraph(entry) {
  const root = entryNode(entry)
  const decoded = decodeSmControl('0x64')
  const register = extraNode('register-sm-control', 'register', 'SMx Control · 0x64', '0x0804 + 8 × n · 8 bit', '这是过程输出SM的控制字节示例。各字段独立编码，不能把整个字节当作长度或对象索引。', [{ label: '示例二进制', value: '0110 0100' }, { label: '寄存器位置', value: 'SM 起始寄存器组 + 4' }], { controlByte: decoded })
  const mode = extraNode('mode-sm-buffer', 'mode', '00 · 三缓冲', 'ControlByte › bits 1:0', '00为三缓冲，10为Mailbox单缓冲；01和11保留。物理占用还受Length和内部字宽影响。', [{ label: '示例模式', value: '三缓冲 × 3' }, { label: '例外', value: 'Length=1 时额外缓冲不使用' }])
  const direction = extraNode('mode-sm-direction', 'mode', '01 · ECAT 写 / PDI 读', 'ControlByte › bits 3:2', '00为ECAT读/PDI写，01为ECAT写/PDI读；10和11保留。', [{ label: '从站方向', value: '接收 · RxPDO / Outputs' }])
  const events = extraNode('rule-sm-events', 'rule', '事件与看门狗触发', 'ControlByte › bits 4 / 5 / 6', 'bit4控制ECAT事件，bit5控制AL事件，bit6控制过程数据看门狗触发。中断还受掩码和硬件配置影响。', [{ label: 'bit4 / bit5', value: '0 / 1：ECAT关 / AL开' }, { label: 'bit6', value: '1：允许看门狗触发' }])
  const bit7 = extraNode('rule-sm-bit7', 'rule', 'bit 7 · 按 ESC 能力解释', 'Feature 0x0008 › bit 12', '传统ESC保留；ET1150/IP Core≥4.0等支持Sequential mode。该功能只作用于ECAT写入侧。', [{ label: '0x64示例', value: 'bit7 = 0' }, { label: '核对依据', value: '实际ESC手册与Feature能力' }], { references: [ESC_DOC] })
  return { rootId: root.id, nodes: [root, register, mode, direction, events, bit7], edges: [edge('controlbyte-register', root.id, register.id, 'describes', '描述控制字节', 'ESI Sm ControlByte描述相应SM控制字段；实际写入由主站和设备配置完成。', '', [ESC_DOC]), edge('controlbyte-mode', register.id, mode.id, 'encodes', 'bits 1:0', mode.brief, '', [ESC_DOC]), edge('controlbyte-direction', register.id, direction.id, 'encodes', 'bits 3:2', direction.brief, '', [ESC_DOC]), edge('controlbyte-events', register.id, events.id, 'encodes', 'bits 4 / 5 / 6', events.brief, '', [ESC_DOC]), edge('controlbyte-bit7', bit7.id, register.id, 'requires', 'bit7含义有条件', bit7.brief, 'bit7=1时核对Sequential能力；传统ESC按保留位规则置0', [ESC_DOC])], sample: null, calculator: 'control', contextNote: '0x64用于解释字段组合；选择其他值可打开完整ControlByte计算器。', extraCount: 0 }
}

function callbackGraph(entry, entries) {
  const write = entry.id === 'xlsx-coe-write'
  const root = entryNode(entry)
  const access = entryNode(entries.find(e => e.id === 'xlsx-access'))
  const request = extraNode('mode-sdo-request', 'mode', `SDO ${write ? '写' : '读'}请求`, 'CoE › 对象访问路径', '请求按Index/SubIndex定位对象；访问条件和自定义处理是不同层。', [{ label: '地址', value: 'Index : SubIndex' }])
  const handler = extraNode('mode-sdo-handler', 'mode', `应用自定义${write ? '写入' : '读取'}函数`, '目标 SSC › CoE 回调接口', '单元格填写函数名，不是填写是否允许访问。按目标接口处理长度、数据和返回结果。', [{ label: '配置值', value: '实际回调函数名称' }, { label: '结果', value: '成功 / Abort / 支持的Pending路径' }])
  return { rootId: root.id, nodes: [root, request, access, handler], edges: [edge('callback-binding', root.id, handler.id, 'references', '绑定函数名', '应用定义中的CoeRead/CoeWrite绑定对应自定义处理函数。'), edge('callback-access', access.id, handler.id, 'requires', '访问权限与状态', '回调仍须遵守对象访问契约，不能把函数名当成权限开关。'), edge('callback-request', request.id, handler.id, 'selects', '转交处理', '有效访问进入相应对象处理路径。', '具体调用接口、状态与返回方式以所用SSC版本为准')], sample: null, contextNote: '函数回调、SDO权限、PDO可映射方向分别配置。', extraCount: 0 }
}

function objectShapeGraph(entry) {
  const root = entryNode(entry)
  const shapes = [
    extraNode('shape-variable', 'concept', 'VARIABLE', '对象字典 › 单值对象', '一个单值，通常通过SubIndex 0访问。', [{ label: '组织', value: '单个变量' }, { label: '地址示例', value: '0x2000:00' }]),
    extraNode('shape-array', 'concept', 'ARRAY', '对象字典 › 同类成员', '成员协议数据类型相同；SubIndex 0与业务成员分别定义。', [{ label: '成员', value: '相同数据类型' }, { label: ':00', value: '最高子索引，不等于字节长度' }]),
    extraNode('shape-record', 'concept', 'RECORD', '对象字典 › 结构成员', '业务成员允许具有不同协议数据类型；须核对SSC本地布局。', [{ label: '成员', value: '数据类型可不同' }, { label: '布局', value: 'WORD / 字节 / padding规则' }]),
  ]
  return { rootId: root.id, nodes: [root, ...shapes], edges: shapes.map(node => edge(`shape-${node.id}`, root.id, node.id, 'selects', '对象结构', node.brief)), sample: null, contextNote: '对象结构、线上PDO位流和编译器C结构体布局分别核对。', extraCount: 0 }
}

function permissionGraph(entry, entries) {
  const root = entryNode(entry)
  const pdo = entryNode(entries.find(e => e.id === 'xlsx-rx-tx'))
  const state = extraNode('rule-state-permission', 'rule', 'SDO 状态权限', '示例：ro, wr_preop', '权限随EtherCAT状态判断。下面是一个示例，不是所有对象的默认权限。', [{ label: 'PREOP', value: '可读 / 可写' }, { label: 'SAFEOP / OP', value: '可读，禁止写入' }])
  return { rootId: root.id, nodes: [root, state, pdo], edges: [edge('state-access-check', root.id, state.id, 'constrains', '按状态检查', 'Access控制CoE/SDO读写；所用语法与检查逻辑须匹配目标SSC版本。'), edge('pdo-access-independent', root.id, pdo.id, 'describes', '分别配置', 'Access与rx/tx是两种独立约束，不能从ro/rw直接推导PDO方向。')], sample: null, contextNote: '声明权限不替代写入范围、长度和业务副作用校验。', extraCount: 0 }
}

function addressRangeGraph(entry, entries) {
  const write = entry.id.includes('write')
  const root = entryNode(entry)
  const min = entries.find(e => e.id === `min-pd-${write ? 'write' : 'read'}-address`)
  const max = entries.find(e => e.id === `max-pd-${write ? 'write' : 'read'}-address`)
  const other = entryNode(entry.id === min.id ? max : min)
  const window = extraNode('rule-start-window', 'rule', '允许的 SM 起始地址', `常见 SM${write ? 2 : 3} › ${write ? 'Outputs' : 'Inputs'}`, 'Min/Max限定的是主站可配置的起始地址窗口，完整结束边界需另外计入缓冲占用。', [{ label: '条件', value: 'MIN ≤ StartAddress ≤ MAX' }, { label: '另需检查', value: '全部物理缓冲落在RAM内' }])
  const actual = entryNode(entries.find(e => e.id === `def-pd-${write ? 'write' : 'read'}-address`))
  return { rootId: root.id, nodes: [root, other, window, actual], edges: [edge('range-root', root.id, window.id, 'constrains', entry.id === min.id ? '起点下限' : '起点上限', '这是起始地址边界，不是完整缓冲的结束地址。'), edge('range-other', other.id, window.id, 'constrains', entry.id === min.id ? '起点上限' : '起点下限', '起始地址必须同时满足上下限。'), edge('range-default', window.id, actual.id, 'constrains', '默认地址也须满足', '默认值与主站实际地址分别核对；可用区间还受Length和内部字宽影响。')], sample: null, calculator: 'memory', contextNote: '物理结束地址不能只看StartAddress上限；需带入Length、缓冲数与内部字宽。', extraCount: 0 }
}

const objectNames = { '0x1008:00': 'Device name', '0x1009:00': 'Hardware version', '0x100A:00': 'Software version', '0x1018:01': 'Vendor ID', '0x1018:02': 'Product code', '0x1018:03': 'Revision number', '0x1018:04': 'Serial number' }
const identityObjects = { 'coe-device-name': ['0x1008:00'], 'coe-hardware-version': ['0x1009:00'], 'coe-software-version': ['0x100A:00'], 'coe-identity': ['0x1018:01', '0x1018:02', '0x1018:03', '0x1018:04'] }

function knownObjectLinks(entry) {
  const addresses = identityObjects[entry.id] || (entry.facts || []).filter(f => /CoE/.test(f.label)).flatMap(f => f.value.match(/0x[0-9a-f]{4}:[0-9a-f]{1,2}/ig) || [])
  return [...new Set(addresses)].map(address => {
    const formatted = address.replace(/0x/i, '0x').toUpperCase().replace('0X', '0x')
    const [indexText, subText] = formatted.split(':')
    return extraNode(`object-${formatted.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, 'subentry', formatted, `对象字典 › ${indexText}`, objectNames[formatted] || '配置关联的 CoE 对象条目。', [{ label: '对象含义', value: objectNames[formatted] || entry.title }], { identifier: formatted, addressParts: { index: Number(indexText), subIndex: Number(`0x${subText}`) } })
  })
}

function legacyEdge(from, to, relation, i) {
  const noEdges = ['区别于', '区分', '澄清方向', '返回概览', '查阅', '起点', '版本相关', '配合', '相关核对', '属于']
  if (noEdges.includes(relation.type)) return null
  let kind = 'context', source = from.id, target = to.id, label = relation.type
  if (relation.type === '依赖') { kind = 'requires'; source = to.id; target = from.id; label = '启用前提' }
  else if (relation.type === '引用') { kind = 'references'; label = '引用对象' }
  else if (relation.type === '被引用') { kind = 'references'; source = to.id; target = from.id; label = '引用对象' }
  else if (relation.type === '约束') { kind = 'constrains'; label = '约束' }
  else if (relation.type === '共同约束' && /^(min|max)-pd-cycle-time$/.test(from.id) && /^(min|max)-pd-cycle-time$/.test(to.id)) { kind = 'constrains'; label = 'MIN ≤ MAX' }
  else if (['对应', '需一致', '描述'].includes(relation.type)) { kind = 'describes'; label = relation.type === '对应' ? '字段对应' : relation.type }
  else if (label.length > 7) label = '参考关系'
  return edge(`recorded-${from.id}-${i}`, source, target, kind, label, relation.description, kind === 'context' ? '参考关系；此连线不表示同值或计算公式。' : '', from.references)
}

function createConfigGraph(entry, entries, { expanded = false, cycleValue = '100000', bitLengths = '16, 32', capacity = '16', memory = {} } = {}) {
  if (['min-pd-cycle-time', 'pd-output-calc-and-copy-time', 'pd-input-calc-and-copy-time', 'pd-output-delay-time', 'pd-input-delay-time'].includes(entry.id)) return cycleGraph(entry, cycleValue, entries, expanded)
  if (['max-pd-output-size', 'max-pd-input-size'].includes(entry.id)) return capacityGraph(entry, bitLengths, capacity, expanded, memory)
  if (entry.id === 'esc-sm-wd-supported') return watchdogGraph(entry)
  if (/^def-(pd|mbx)-(write|read)-address$/.test(entry.id)) return smAddressGraph(entry)
  if (['pdo-mapping', 'esi-entry', 'xlsx-index', 'xlsx-si', 'xlsx-data-type'].includes(entry.id)) return mappingGraph(entry)
  if (['system-header-file', 'hw-access-file'].includes(entry.id)) return fileGraph(entry)
  if (['def-mbx-size', 'max-mbx-size'].includes(entry.id)) return mailboxSizeGraph(entry, entries)
  if (entry.id === 'esi-control-byte') return controlByteGraph(entry)
  if (['xlsx-coe-read', 'xlsx-coe-write'].includes(entry.id)) return callbackGraph(entry, entries)
  if (entry.id === 'xlsx-object-code') return objectShapeGraph(entry)
  if (entry.id === 'xlsx-access') return permissionGraph(entry, entries)
  if (/^(min|max)-pd-(write|read)-address$/.test(entry.id)) return addressRangeGraph(entry, entries)
  const map = new Map(entries.map(e => [e.id, e]))
  const objects = knownObjectLinks(entry)
  const allEdges = []
  for (const from of entries) for (const [i, relation] of (from.relations || []).entries()) {
    const to = map.get(relation.target)
    if (!to || from.overview || to.overview) continue
    const link = legacyEdge(from, to, relation, i)
    if (link && (link.source === entry.id || link.target === entry.id)) allEdges.push(link)
  }
  const priority = e => e.kind === 'context' ? 2 : e.kind === 'describes' ? 1 : 0
  allEdges.sort((a, b) => priority(a) - priority(b))
  const limit = expanded ? 16 : Math.max(3, 6 - objects.length)
  const ids = new Set([entry.id])
  const visibleEdges = []
  for (const link of allEdges) {
    const other = link.source === entry.id ? link.target : link.source
    if (ids.has(other) || ids.size - 1 < limit) { ids.add(other); visibleEdges.push(link) }
  }
  const hidden = new Set(allEdges.flatMap(e => [e.source, e.target]).filter(id => !ids.has(id))).size
  const nodes = [...ids].map(id => entryNode(map.get(id)))
  const indexGroups = new Map()
  for (const object of objects) {
    const list = indexGroups.get(object.addressParts.index) || []
    list.push(object); indexGroups.set(object.addressParts.index, list)
  }
  for (const [index, members] of indexGroups) {
    const groupId = `object-group-${index.toString(16)}`
    const indexText = `0x${index.toString(16).toUpperCase().padStart(4, '0')}`
    nodes.push(extraNode(groupId, 'object', indexText, '对象字典', 'Index为16bit对象索引；各子项用独立的8bit SubIndex定位。', [], { isGroup: true, scope: index === 0x1018 ? 'Identity' : objectNames[`${indexText}:00`] || '对象字典', addressParts: { index }, groupHeight: members.length > 1 ? 86 + members.length * 74 : GROUP_HEIGHT, references: entry.references }))
    members.forEach((object, i) => {
      const subHex = object.addressParts.subIndex.toString(16).toUpperCase().padStart(2, '0')
      const typeFields = index === 0x1018 ? [{ label: '类型', value: 'UINT32' }] : [0x1008, 0x1009, 0x100a].includes(index) ? [{ label: '类型', value: 'VISIBLE_STRING · 可变长' }] : object.fields
      nodes.push({ ...object, fields: typeFields, parentId: groupId, childOrder: i, name: `:${subHex} ${objectNames[object.identifier] || entry.title}`, compact: members.length > 1, nodeHeight: members.length > 1 ? 66 : NODE_HEIGHT })
      visibleEdges.push(edge(`coe-${object.id}`, entry.id, object.id, 'describes', '对象对应', '此字段关联的对象字典位置；具体初始化或更新路径以固件为准。', '查阅定位关系，不代表运行值已被读取', entry.references))
    })
  }
  return { rootId: entry.id, nodes, edges: visibleEdges, sample: null, contextNote: '实线表示有方向的工程关系；虚线表示描述或参考，点线查看条件。', extraCount: hidden }
}

export function buildConfigGraph(entry, entries, options = {}) {
  return { ...createConfigGraph(entry, entries, options), profile: getConfigModel(entry) }
}

export function filterConfigGraph(graph, mode = 'all') {
  if (mode === 'all') return graph
  const edges = graph.edges.filter(link => mode === 'directed' ? relationKinds[link.kind].directed : !relationKinds[link.kind].directed)
  const ids = new Set([graph.rootId, ...edges.flatMap(link => [link.source, link.target])])
  const byId = new Map(graph.nodes.map(node => [node.id, node]))
  for (const id of ids) {
    const parent = byId.get(id)?.parentId
    if (parent) ids.add(parent)
  }
  return { ...graph, edges, nodes: graph.nodes.filter(node => ids.has(node.id)) }
}

function layoutInDirection(graph, direction) {
  const byId = new Map(graph.nodes.map(node => [node.id, node]))
  const topLevel = graph.nodes.filter(node => !node.parentId)
  const model = new dagre.graphlib.Graph({ multigraph: true })
  model.setGraph({ rankdir: direction, ranksep: direction === 'LR' ? 90 : 52, nodesep: 32, marginx: 24, marginy: 24 })
  model.setDefaultEdgeLabel(() => ({}))
  topLevel.forEach(node => model.setNode(node.id, { width: node.isGroup ? GROUP_WIDTH : NODE_WIDTH, height: node.isGroup ? node.groupHeight || GROUP_HEIGHT : node.nodeHeight || NODE_HEIGHT }))
  graph.edges.forEach(link => {
    const source = byId.get(link.source)?.parentId || link.source
    const target = byId.get(link.target)?.parentId || link.target
    if (source !== target) model.setEdge(source, target, { weight: link.kind === 'context' ? 1 : 2 }, link.id)
  })
  dagre.layout(model)
  if (graph.sample === 'cycle') {
    const objects = topLevel.filter(node => node.isGroup).sort((a, b) => a.id.localeCompare(b.id))
    const coordinates = objects.map(node => model.node(node.id)[direction === 'LR' ? 'y' : 'x']).sort((a, b) => a - b)
    objects.forEach((node, i) => { model.node(node.id)[direction === 'LR' ? 'y' : 'x'] = coordinates[i] })
  }
  return { direction, nodes: graph.nodes.map(node => node.parentId ? { ...node, x: 18, y: 78 + (node.childOrder || 0) * 74 } : { ...node, x: model.node(node.id).x - (node.isGroup ? GROUP_WIDTH : NODE_WIDTH) / 2, y: model.node(node.id).y - (node.isGroup ? node.groupHeight || GROUP_HEIGHT : node.nodeHeight || NODE_HEIGHT) / 2 }), width: model.graph().width, height: model.graph().height }
}

export function layoutConfigGraph(graph, preference = 'auto', availableWidth = 1000, availableHeight = 680) {
  if (preference === 'horizontal') return layoutInDirection(graph, 'LR')
  if (preference === 'vertical') return layoutInDirection(graph, 'TB')
  const horizontal = layoutInDirection(graph, 'LR')
  const vertical = layoutInDirection(graph, 'TB')
  if (availableWidth < 650) return vertical
  const hScale = Math.min(availableWidth / horizontal.width, availableHeight / horizontal.height, 1)
  const vScale = Math.min(availableWidth / vertical.width, availableHeight / vertical.height, 1)
  return hScale >= .88 || hScale >= vScale ? horizontal : vertical
}

export function matchGraphNode(graph, query) {
  const needle = normalize(query)
  return needle ? graph.nodes.find(node => normalize(`${node.name} ${node.position.parent} ${node.position.selector} ${node.fields.map(f => f.value).join(' ')}`).includes(needle))?.id : null
}
