import { si0Protocol } from '../data/sdo-access.js'
import { applicationWorkbooks } from '../data/application-workbooks.js'

export const applicationColumns = [
  ['B', 'Index', 'xlsx-index'], ['C', 'ObjectCode', 'xlsx-object-code'], ['D', 'SI', 'xlsx-si'],
  ['E', 'DataType', 'xlsx-data-type'], ['F', 'Name', 'xlsx-name'], ['G', 'Default Value', 'xlsx-default'],
  ['H', 'Min Value', 'xlsx-min-max'], ['I', 'Max Value', 'xlsx-min-max'], ['J', 'M/O/C', 'xlsx-moc'],
  ['K', 'B/S', 'xlsx-bs'], ['L', 'Access', 'xlsx-access'], ['M', 'rx/tx', 'xlsx-rx-tx'],
  ['N', 'CoeRead', 'xlsx-coe-read'], ['O', 'CoeWrite', 'xlsx-coe-write'], ['P', 'Description', 'xlsx-description'],
].map(([key, name, entryId]) => ({ key, name, entryId, core: 'BCDEFGLM'.includes(key) }))

export const headerDefinitions = {
  'Device Profile': '设备使用的 Profile 编号，例如 5001 表示 Modular Device Profile；它不直接决定是否采用 Slot。',
  'Modul Profile': '附加模块 Profile 编号，0 不表示模块数量为 0。',
  'Module Ident': '模块模板的类型标识；槽位通过这个值引用模块，不使用工作表名称作为标识。',
  IndexIncrement: '普通模板也保留这个表头，可显式填 0；有槽位时由基础表提供对象索引步长，模块表控制槽位依赖。',
  PdoIndexIncrement: '普通模板也保留这个表头，可显式填 0；有槽位时由基础表提供 PDO 索引步长，模块表控制 PDO 槽位依赖。',
}

export function integer(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null
  const text = String(value ?? '').trim()
  return /^(0x[\da-f]+|\d+)$/i.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : null
}
export const hex = value => value === null || value === undefined ? '未定义' : `0x${value.toString(16).toUpperCase().padStart(4, '0')}`
export const displayValue = value => value === null || value === undefined || value === '' ? '未填写' : String(value)
export const metadataValue = (sheet, name) => sheet.metadata.find(field => field.name === name)

export function applicationStructure(workbook) {
  const modules = workbook.sheets.filter(sheet => sheet.role === 'module')
  const slots = getSlots(workbook)
  return { kind: modules.length || slots.length ? 'modular' : 'direct', label: modules.length || slots.length ? '模块化应用' : '普通应用', modules, slots }
}

export function buildSheetModel(workbook, sheet) {
  const objects = []
  for (const row of sheet.rows) {
    if (row.kind === 'object') objects.push({ index: integer(row.values.B), code: row.values.C, name: row.values.F, row, members: [] })
    else if (objects.length) objects.at(-1).members.push(row)
  }
  const rows = objects.flatMap(object => [object.row, ...object.members].map(row => ({ ...row, object })))
  return { workbook, sheet, objects, rows, memberCount: objects.reduce((n, object) => n + object.members.length, 0) }
}

export function generatedSubindex(object) {
  if (!['ARRAY', 'RECORD'].includes(object.code)) return null
  const max = Math.max(0, ...object.members.map(row => integer(row.values.D) || 0))
  return { number: `${object.row.number}-si0`, kind: 'generated', object, protocol: si0Protocol, values: { B: null, C: null, D: 0, E: 'UINT8', F: object.index === 0xF030 ? '配置列表长度' : '最高子索引', G: max, L: object.row.values.L, M: null }, origin: 'SSC 生成规则预览' }
}

export function filterApplicationObjects(model, query) {
  const term = query.trim().toLowerCase()
  if (!term) return model.objects
  return model.objects.flatMap(object => {
    const headMatches = [hex(object.index), object.name, object.code].join(' ').toLowerCase().includes(term)
    const visibleMembers = headMatches ? object.members : object.members.filter(row => Object.values(row.values).join(' ').toLowerCase().includes(term))
    return headMatches || visibleMembers.length ? [{ ...object, visibleMembers }] : []
  })
}

export function getSlots(workbook) {
  const base = workbook.sheets.find(sheet => sheet.role === 'base')
  if (!base) return []
  const model = buildSheetModel(workbook, base)
  const list = model.objects.find(object => object.index === 0xF030)
  return (list?.members || []).map(row => {
    const description = String(row.values.P || '')
    const allowed = [...description.matchAll(/\[ModuleIds\s*:\s*([^\]]+)\]/gi)].flatMap(match => match[1].split(';').map(id => integer(id.trim())).filter(id => id !== null))
    const name = description.match(/\[Slotname\s*:\s*([^\]]+)\]/i)?.[1]?.trim()
    return { id: `slot-${row.values.D}`, ordinal: integer(row.values.D) - 1, subindex: integer(row.values.D), name: name || `Slot ${integer(row.values.D) - 1}`, allowed: [...new Set(allowed)], defaultIdent: integer(row.values.G), row, base }
  })
}

export function resolveModuleInstance(workbook, slot) {
  const module = workbook.sheets.find(sheet => sheet.role === 'module' && integer(metadataValue(sheet, 'Module Ident')?.value) === slot.defaultIdent)
  if (!module) return { slot, module: null, objects: [], valid: false, reason: slot.defaultIdent === null ? '未定义默认模块' : '找不到引用的模块模板' }
  if (!slot.allowed.includes(slot.defaultIdent)) return { slot, module, objects: [], valid: false, reason: '默认模块不在允许列表中' }
  const objectStep = integer(metadataValue(slot.base, 'IndexIncrement')?.value)
  const pdoStep = integer(metadataValue(slot.base, 'PdoIndexIncrement')?.value)
  const moduleFlag = integer(metadataValue(module, 'IndexIncrement')?.value)
  const dependsOnSlot = moduleFlag === null ? null : moduleFlag !== 0
  const objects = buildSheetModel(workbook, module).objects.map(object => {
    const resolvedIndex = dependsOnSlot === null || (dependsOnSlot && objectStep === null) ? null : object.index + (dependsOnSlot ? slot.ordinal * objectStep : 0)
    return { ...object, resolvedIndex, valid: resolvedIndex !== null && resolvedIndex >= 0 && resolvedIndex <= 0xFFFF, expression: dependsOnSlot ? `${hex(object.index)} + ${slot.ordinal} × ${hex(objectStep)}` : dependsOnSlot === false ? `${hex(object.index)}（不加槽位偏移）` : '槽位依赖设置未定义' }
  })
  return { slot, module, objects, objectStep, pdoStep, dependsOnSlot, valid: objects.every(object => object.valid), reason: '规则预览；需核对 SSC 生成的 ESI 与固件', pdoIndex: null }
}

export function applicationContext(route = {}, entryId = 'application-overview') {
  const workbook = applicationWorkbooks.find(book => book.id === route.workbook) || applicationWorkbooks.find(book => book.id === 'mdp-io' && book.sheets.some(sheet => sheet.id === route.sheet)) || applicationWorkbooks.find(book => book.sheets.some(sheet => sheet.id === route.sheet)) || applicationWorkbooks.find(book => book.id === (entryId === 'xlsx-modular' || route.appPane === 'slots' ? 'mdp-io' : 'direct-io'))
  const defaultSheet = ['xlsx-access', 'xlsx-rx-tx', 'xlsx-data-type', 'xlsx-padding', 'xlsx-coe-read', 'xlsx-coe-write'].includes(entryId) ? 'Digital_Output' : workbook.sheets[0].id
  const sheet = workbook.sheets.find(item => item.id === route.sheet) || workbook.sheets.find(item => item.id === defaultSheet) || workbook.sheets[0]
  const model = buildSheetModel(workbook, sheet)
  const column = applicationColumns.find(item => item.key === route.field) || applicationColumns.find(item => item.entryId === entryId) || (entryId === 'xlsx-padding' ? applicationColumns.find(item => item.key === 'E') : null)
  const header = sheet.metadata.find(item => `header:${item.name}` === route.field)
  const hasSelection = Boolean(route.field || column || entryId === 'xlsx-modular')
  const selectedField = header ? `header:${header.name}` : column?.key || (entryId === 'xlsx-modular' ? `header:${sheet.role === 'module' ? 'Module Ident' : 'IndexIncrement'}` : 'B')
  const preferredRow = model.rows.find(row => row.kind === 'member' && row.values[column?.key] !== null && row.values[column?.key] !== undefined)
  const row = model.rows.find(item => String(item.number) === String(route.row)) || model.objects.map(generatedSubindex).filter(Boolean).find(item => String(item.number) === String(route.row)) || preferredRow || model.rows[0]
  return { workbook, sheet, model, row, field: selectedField, entryId, structure: applicationStructure(workbook), selection: hasSelection, mode: route.appPane === 'slots' && getSlots(workbook).length ? 'slots' : 'table' }
}

export function fieldOccurrence(context, entries) {
  const { workbook, sheet, row, field } = context
  const header = field.startsWith('header:') ? metadataValue(sheet, field.slice(7)) : null
  const definition = applicationColumns.find(column => column.key === field)
  const entry = entries.find(item => item.id === (context.entryId === 'xlsx-padding' ? 'xlsx-padding' : definition?.entryId || 'xlsx-modular'))
  const object = row?.object
  const generated = row?.kind === 'generated' && !header
  const source = header?.cell || (row && !generated ? `${field}${row.number}` : '')
  const value = header ? header.value : row?.values[field]
  const member = row?.kind === 'member'
  const address = object && !header ? `${hex(object.index)}${member || generated || object.code === 'VARIABLE' ? `:${(integer(row.values.D) || 0).toString(16).toUpperCase().padStart(2, '0')}` : ''}` : ''
  let summary = header ? headerDefinitions[header.name] : entry?.summary || '从工作表中的原始位置查看字段。'
  let scope = header ? sheet.role === 'module' ? '模块表头' : '应用表头' : generated ? '生成项' : member ? '对象成员' : object?.code === 'VARIABLE' ? '单值对象 :00' : '对象头'
  const notes = []
  if (!header && field === 'L' && !member && ['ARRAY', 'RECORD'].includes(object?.code)) {
    summary = '对象头行的 Access 描述生成的 :00 访问权限；各业务成员使用自己的 Access。'
    notes.push('头行 ro 不会把下方 rw 成员改成只读。')
  }
  if (!header && ['B', 'C'].includes(field) && member) notes.push(`本行原单元格为空；对象 ${field === 'B' ? 'Index' : 'ObjectCode'} 来自 ${field}${object.row.number}。`)
  if (!header && field === 'G' && object?.index === 0xF030 && member) {
    summary = '这个默认值选择槽位的默认模块，必须能找到同一应用内对应的 Module Ident。'
    scope = '槽位默认模块'
  }
  if (!header && field === 'P' && object?.index === 0xF030 && member) {
    summary = '[Slotname: …] 定义槽位名称；[ModuleIds: …] 定义允许安装的模块。其余文字作为说明。'
    scope = '槽位结构注解'
  }
  if (!header && field === 'M') notes.push('rx/tx 声明可映射方向；当前文件没有显式 Mapping/Assignment，实际活动映射需核对生成结果。')
  if (!header && field === 'G' && value === null) notes.push('原文件未填写，保留为未定义；不能自动补成数字 0。')
  if (header?.name === 'IndexIncrement' || header?.name === 'PdoIndexIncrement') notes.push(sheet.role === 'module' ? '本表设置用于生成 DependOnSlot；实际增量取自基础设备表。' : '增量与 F000:01 是不同来源的字段，不能因名称接近而直接合并。')
  if (generated) notes.push('这是规则预览，原文件中没有这一行；未核对 SSC 实际生成结果。')
  if (workbook.sourceType === 'teaching') notes.push('当前数据是通用教学示意，位置按模板列表示；不是某个项目文件的配置。')
  return { name: header?.name || definition?.name || field, field, entry, value, display: displayValue(value), address, source, sourcePath: `${workbook.filename} › ${sheet.name}${source ? ` › ${source}${workbook.sourceType === 'teaching' ? '（示意）' : ''}` : ''}`, scope, summary, notes, generated, definition }
}

export function buildApplicationRelations(context, occurrence, knowledgeEntries = []) {
  const { workbook, sheet, row } = context
  const nodes = [], edges = []
  const add = (id, title, parent, value, brief, extra = {}) => { nodes.push({ id, title, parent, value: displayValue(value), brief, ...extra }); return id }
  const link = (source, target, label, condition = '', kind = 'reference') => edges.push({ id: `${source}-${target}`, source, target, label, condition, kind })
  add('source', occurrence.name, `${sheet.name} › ${occurrence.source || '规则生成项'}`, occurrence.value, occurrence.summary, { source: true })
  const object = occurrence.field.startsWith('header:') ? null : row?.object
  if (object) {
    add('object', `${hex(object.index)} ${object.name || ''}`, `${workbook.filename} › ${sheet.name}`, object.code, '字段所属的对象定义；模板地址与实例地址分开。')
    link('object', 'source', '包含字段', '', 'contains')
  }
  const slot = getSlots(workbook).find(item => sheet.role === 'base' ? object?.index === 0xF030 && item.row.number === row.number : item.defaultIdent === integer(metadataValue(sheet, 'Module Ident')?.value))
  if (applicationStructure(workbook).kind === 'direct' && ['header:IndexIncrement', 'header:PdoIndexIncrement'].includes(occurrence.field)) {
    add('direct-context', '普通应用表头', `${sheet.name} › 模板元数据`, '字段存在；没有 Slot 实例化', '值 0 与未填写不同。不能凭增量字段是否出现判断应用结构。')
    link('source', 'direct-context', '保留配置字段', '按当前表角色解释，不推断新增模块或槽位', 'describe')
    add('direct-index', '对象定义索引', `${sheet.name} › 对象字典`, hex(context.model.objects[0]?.index), '没有模块/Slot 展开时，业务对象仍直接使用定义的索引。')
    link('direct-context', 'direct-index', '直接定义对象', '未执行模板实例化偏移', 'reference')
  } else if (sheet.role === 'base' && ['header:IndexIncrement', 'header:PdoIndexIncrement'].includes(occurrence.field)) {
    const pdo = occurrence.field === 'header:PdoIndexIncrement'
    for (const candidate of getSlots(workbook)) {
      const instance = resolveModuleInstance(workbook, candidate)
      add(candidate.id, `Slot ${candidate.ordinal} · ${candidate.name}`, `${candidate.base.name} › G${candidate.row.number}`, `${hex(candidate.defaultIdent)} → ${instance.module?.name || '未解析'}`, '通过 F030 默认值找到模块模板。', { locate: { sheet: candidate.base.id, row: candidate.row.number, field: 'G' } })
      link('source', candidate.id, pdo ? 'PDO 增量上下文' : '对象增量上下文')
      const resolved = instance.objects[0]
      add(`${candidate.id}-result`, pdo ? '实例 PDO 索引' : '实例对象索引', `${instance.module?.name || '模块'} · Slot ${candidate.ordinal}`, pdo ? '待核对生成结果' : hex(resolved?.resolvedIndex), pdo ? '源表没有显式 PDO Mapping，不能仅凭步长确定生成的 PDO 索引。' : resolved?.expression || instance.reason, { preview: !pdo })
      link(candidate.id, `${candidate.id}-result`, pdo ? '还需 PDO 模板索引' : '按条件展开', pdo ? '需核对生成的 PDO Mapping 与 DependOnSlot' : '仅对声明 DependOnSlot 的对象增加偏移', pdo ? 'reference' : 'derive')
    }
  } else if (slot && (['B', 'C'].includes(occurrence.field) || object?.index === 0xF030 || occurrence.field.startsWith('header:'))) {
    const instance = resolveModuleInstance(workbook, slot)
    add('slot', `Slot ${slot.ordinal} · ${slot.name}`, `${slot.base.name} › 0xF030:${slot.subindex.toString(16).padStart(2, '0')}`, hex(slot.defaultIdent), '默认选择与允许模块分别定义。', { locate: { sheet: slot.base.id, row: slot.row.number, field: 'G' } })
    link('source', 'slot', '槽位上下文')
    add('module', instance.module?.name || '未解析模块', 'Module Ident · 模块模板', hex(slot.defaultIdent), instance.module ? '通过标识找到模块工作表；不通过名称猜测。' : instance.reason, { locate: instance.module ? { sheet: instance.module.id, field: 'header:Module Ident' } : null })
    link('slot', 'module', '默认选择', '默认 Module Ident 应在 ModuleIds 允许列表中', 'reference')
    const resolved = instance.objects.find(item => item.index === object?.index) || instance.objects[0]
    if (resolved) {
      add('step', '基础表索引步长', `${slot.base.name} › ${metadataValue(slot.base, 'IndexIncrement')?.cell}`, hex(instance.objectStep), '模块表设置 DependOnSlot，基础表提供实际增量。')
      add('resolved', '实例对象索引', `Slot ${slot.ordinal} › ${instance.module.name} · 规则预览`, hex(resolved.resolvedIndex), resolved.expression, { preview: true })
      link('module', 'resolved', '模板实例化', '仅对声明 DependOnSlot 的对象加槽位偏移', 'derive')
      link('step', 'resolved', '提供步长', resolved.expression, 'derive')
    }
    add('esi-slot', 'Modules / Slots', 'ESI › Descriptions', '生成产物待核对', '此处展示源文件与生成规则的对应，不宣称已有实际 ESI。', { entryId: 'esi-slots' })
    link('module', 'esi-slot', '生成描述', '按使用的 SSC 版本生成并核对', 'reference')
  } else if (occurrence.field === 'M' || occurrence.field === 'E' || occurrence.entry?.id === 'xlsx-padding') {
    const direction = row?.values.M
    const type = row?.values.E
    const bits = type === 'BOOL' ? 1 : Number(String(type).match(/(?:U?INT|BIT)(\d+)/)?.[1]) || null
    add('type', '协议类型与位宽', `${occurrence.address} › DataType`, `${displayValue(type)}${bits ? ` · ${bits} bit` : ''}`, '协议位宽与本地 C 结构体大小分别核对。', { entryId: 'xlsx-data-type' })
    link('source', 'type', '同一成员')
    add('pdo', direction === 'rx' ? 'RxPDO 可映射' : direction === 'tx' ? 'TxPDO 可映射' : 'PDO 可映射方向', '成员属性 › rx/tx', direction === 'rx' ? '主站 → 从站' : direction === 'tx' ? '从站 → 主站' : '未声明', '可映射性不等于已进入活动 PDO。', { entryId: direction === 'rx' ? 'esi-rxpdo' : direction === 'tx' ? 'esi-txpdo' : 'xlsx-rx-tx' })
    link('source', 'pdo', '成员描述')
    add('mapping', 'Mapping → Assignment → SM', 'SSC 生成结果 / 在线配置', '待核对', '源工作簿没有显式定义这些对象，不能推定实际 PDO 索引、顺序或长度。', { entryId: 'pdo-mapping' })
    link('pdo', 'mapping', '还需实际映射', '先确认生成的 Mapping 与 Assignment', 'reference')
  } else if (occurrence.field === 'L') {
    add('sdo', 'CoE / SDO 访问权限', occurrence.address || '对象条目', occurrence.value, 'SDO 权限与 PDO 方向独立；对象头只说明复合对象 :00。', { entryId: 'xlsx-access' })
    link('source', 'sdo', '声明权限', '', 'describe')
    if (object?.members.length) {
      const member = row.kind === 'member' ? row : object.members[0]
      add('member', `${hex(object.index)}:${Number(member.values.D).toString(16).padStart(2, '0')} ${member.values.F || ''}`, `${sheet.name} › L${member.number}`, member.values.L, '业务成员拥有自己的访问权限。', { locate: { sheet: sheet.id, row: member.number, field: 'L' } })
      link('object', 'member', '成员独立声明', '头行权限不覆盖成员', 'contains')
    }
    add('pdo', 'PDO 可映射方向', `${sheet.name} › M${row.number}`, row.values.M, '不从 ro / rw 自动推断 rx / tx。', { entryId: 'xlsx-rx-tx' })
    link('sdo', 'pdo', '不同属性', '分别检查 SDO 权限与 PDO 能力', 'reference')
  } else if (applicationStructure(workbook).kind === 'direct' && object && ['B', 'C', 'D'].includes(occurrence.field)) {
    add('direct-address', '直接使用定义索引', `普通应用 › ${sheet.name}`, hex(object.index), '当前定义没有 Module Ident / Slot 展开层，不增加模块槽位偏移。')
    link('source', 'direct-address', '对象地址', '对象头 Index 直接定位对象', 'describe')
    for (const member of object.members.slice(0, 3)) {
      const si = integer(member.values.D)
      add(`member-${si}`, `${hex(object.index)}:${si.toString(16).padStart(2, '0')}`, `${sheet.name} › D${member.number}`, `${member.values.F || '数组成员'} · ${member.values.E}`, '对象内的成员；子索引与对象索引独立。', { locate: { sheet: sheet.id, row: member.number, field: 'D' } })
      link('object', `member-${si}`, '包含成员', '', 'contains')
    }
  } else {
    for (const [i, relation] of (occurrence.entry?.relations || []).slice(0, 3).entries()) {
      const target = knowledgeEntries.find(entry => entry.id === relation.target)
      add(`reference-${i}`, target?.name || applicationColumns.find(column => column.entryId === relation.target)?.name || relation.target, target ? `字段 / 配置资料 › ${target.sources[0].path}` : '相关字段 / 配置', relation.type, relation.description, { entryId: relation.target })
      link('source', `reference-${i}`, relation.type, relation.description, 'reference')
    }
  }
  return { nodes, edges }
}
