// A collection describes a real configuration surface. Cross-references do not
// change an article's home: conceptual articles remain in 基础概念.
export const collections = [
  {
    id: 'SSC', label: 'SSC Tool', shortLabel: 'SSC Tool', overview: 'ssc-overview',
    description: '沿 SSC Tool 配置树查阅工程选项、生成条件和关联字段。',
    groups: [
      { id: 'SlaveInformation', label: 'SlaveInformation' },
      { id: 'Generic', label: 'Generic' },
      { id: 'Hardware', label: 'Hardware' },
      { id: 'EtherCAT State Machine', label: 'EtherCAT State Machine' },
      { id: 'Synchronisation', label: 'Synchronisation' },
      { id: 'Application', label: 'Application', children: [{ id: 'Application/ProcessData', label: 'ProcessData' }] },
      { id: 'Mailbox', label: 'Mailbox' },
      { id: 'Compiler', label: 'Compiler' },
    ],
  },
  {
    id: 'APP', label: '应用对象字典定义', shortLabel: '应用定义', overview: 'application-overview',
    description: '查阅 Excel 应用定义中的对象字典字段和设备、模块定义。',
    groups: [{ id: 'fields', label: '对象字典字段' }, { id: 'device', label: '设备与模块' }],
  },
  {
    id: 'ESI', label: 'ESI 设备描述文件', shortLabel: 'ESI', overview: 'esi-overview',
    description: '按 ESI XML 结构查阅主站可见的设备身份、通信和模块能力。',
    groups: [
      { id: 'identity', label: '设备身份与目录' },
      { id: 'communication', label: '通信与同步' },
      { id: 'dictionary', label: '对象字典描述' },
      { id: 'modules', label: '插槽与模块' },
      { id: 'eeprom', label: 'EEPROM / SII' },
    ],
  },
  {
    id: 'concepts', label: '基础概念', shortLabel: '基础概念', overview: 'object-dictionary',
    description: '理解对象字典、PDO、SM、同步和状态之间的机制与关系。', groups: [],
  },
]

const sscReference = {
  title: 'Beckhoff ET9300 · SSC Application Note V1.10',
  url: 'https://download.beckhoff.com/download/document/io/ethercat-development-products/an_et9300_v1i10.pdf',
  note: 'SSC 生成流程与应用定义参考；具体选项以所用 SSC 版本、厂商 Config.xml 和生成代码为准。',
}
const esiReference = {
  title: 'ETG.2200 · 从站实施指南 V3.2.0',
  url: 'https://www.ethercat.org/download/documents/ETG2200_V3i2i0_G_R_SlaveImplementationGuide.pdf',
  note: '设备开发中的 ESI、SII 与固件一致性；完整 XML 约束由适用版本的 ESI schema 定义。',
}
const relation = (target, type, description) => ({ target, type, description })

export const navigationEntries = [
  {
    id: 'ssc-overview', name: 'SSC Tool', title: 'SSC Tool：从配置树找到工程选项', category: 'hardware',
    overview: true, collection: 'SSC', group: '',
    summary: '按 SSC Tool 中的实际分组查阅选项，理解它们如何影响生成的从站栈、应用定义和 ESI。',
    sources: [{ kind: 'SSC', path: 'SSC Tool → 配置树概览' }],
    facts: [
      { label: '查阅入口', value: 'SlaveInformation / Generic / Hardware / 状态机 / 同步 / Application / Mailbox / Compiler' },
      { label: '对应资料', value: '工程配置、应用定义文件、生成代码和 ESI' },
      { label: '适用边界', value: '具体选项、默认值和依赖取决于 SSC 版本与厂商配置' },
    ],
    details: [
      '左侧目录保留 SSC Tool 的配置树顺序。Application 下的 ProcessData 为子分组，便于从工具界面直接定位到同名配置。',
      '查阅一个配置时，先核对它所在的分组和用途，再检查关联字段、约束与生成结果。跨实体关联可继续跳到应用定义字段、ESI 元素或基础概念。',
      '工程选项决定栈功能和生成条件；应用定义描述业务对象及成员；ESI 向主站描述设备能力。三者需要一致，但不能相互替代。',
    ],
    rules: [
      '条目中的代码和数值示例不代表所有设备的默认配置。修改前核对当前工程的 Config.xml、生成的 ecat_def.h 和硬件移植层。',
      '同一术语在不同实体中可能承担不同职责，例如对象访问权限、PDO 可映射性和 ESI 下载能力应分别核对。',
    ],
    relations: [
      relation('coe-identity', '起点', 'SlaveInformation 中的设备身份应与 ESI 和 SII 保持一致。'),
      relation('max-pd-output-size', '查阅', 'Application / ProcessData 描述过程数据相关容量。'),
      relation('application-overview', '配合', '应用定义文件提供对象和成员信息。'),
      relation('esi-overview', '核对', 'ESI 描述应与生成代码实际支持的能力一致。'),
      relation('ssc-compiler-overview', '版本相关', 'Compiler 选项需结合实际工具和编译器确认。'),
    ],
    references: [sscReference], aliases: ['SSC 配置', '从站栈', 'Slave Stack Code', '配置树'],
  },
  {
    id: 'application-overview', name: '应用对象字典定义', title: '应用对象字典定义：工作表、对象、成员与模块实例', category: 'object',
    overview: true, collection: 'APP', group: '',
    summary: '用 Excel 模板向 SSC Tool 提供应用对象字典与模块定义；按字段查清用途、约束及其生成结果。',
    sources: [{ kind: 'XLSX', path: 'SSC Tool / Excel 应用定义文件' }],
    facts: [
      { label: '文件载体', value: 'SSC 支持的 Excel 应用定义模板' },
      { label: '主要内容', value: '对象索引、子索引、类型、名称、访问权限、PDO 方向和回调' },
      { label: '关联产物', value: '对象字典代码、PDO 描述和 ESI；以生成器版本及配置为准' },
    ],
    details: [
      '对象字典字段分组按实际模板字段查阅。Index 与 SI 定位对象成员，ObjectCode 和 DataType 定义结构与类型，Access 和 rx/tx 分别表达 SDO 访问权限与 PDO 可映射方向。',
      '设备与模块分组说明模块工作表和模块化定义的用途。模块展开后仍需核对对象索引、PDO 和插槽之间的一致性。',
      '这里使用“应用定义文件”作为实体名称。XLSX 是文件格式，不表示另一套协议；资料中的列字母来自用户模板，应以实际工作簿表头为准。',
    ],
    rules: [
      '使用与当前 SSC Tool 匹配的模板。不要仅凭列位置填值，应先核对字段名和生成规则。',
      '元数据声明不能替代应用实现：范围校验、读写回调和参数持久化仍需在对应固件路径落实。',
      '本工具用于查阅与计算，不直接导入、改写或生成整份应用定义工作簿。',
    ],
    relations: [
      relation('xlsx-index', '字段', '从 Index 和子索引定位对象成员。'),
      relation('xlsx-access', '字段', 'Access 描述 CoE / SDO 访问权限。'),
      relation('xlsx-rx-tx', '字段', 'rx/tx 表示 PDO 可映射方向。'),
      relation('xlsx-modular', '设备与模块', '模块化应用需进一步核对工作表和索引展开。'),
      relation('esi-dictionary', '对应描述', '生成的 ESI 对象字典描述应与固件一致。'),
      relation('ssc-overview', '生成上下文', 'SSC 工程选项决定生成条件和栈能力。'),
    ],
    references: [sscReference], aliases: ['Excel', 'XLSX', '应用定义', 'OD Tool', '对象字典模板'],
  },
  {
    id: 'esi-overview', name: 'ESI 设备描述文件', title: 'ESI：沿 XML 结构理解设备对主站的声明', category: 'esi',
    overview: true, collection: 'ESI', group: '',
    summary: '按设备身份、通信与同步、对象字典、模块和 EEPROM 分组查阅 XML 元素及其关联配置。',
    sources: [{ kind: 'ESI', path: 'EtherCATInfo / ESI 文件概览' }],
    facts: [
      { label: '文件格式', value: 'XML；结构遵循适用版本的 ESI schema' },
      { label: '使用方', value: '主站组态和设备目录' },
      { label: '需要一致', value: 'ESI / SII / 固件实现 / 主站实际配置' },
    ],
    details: [
      '从 EtherCATInfo 进入 Vendor 和 Descriptions，再定位 Device。设备主体包含身份、通信资源、PDO、同步能力及可选模块相关描述。',
      'ESI 用于描述设备可支持的能力和相关默认配置。主站还会结合在线身份与用户组态建立运行配置，XML 本身不会改变固件的实际功能。',
      '阅读一个元素时，同时检查对应 SSC 配置、应用定义字段和运行时对象。详情中的关联关系用于说明这些位置如何配合。',
    ],
    rules: [
      'XML 元素名称、属性、顺序与允许值需由适用的 schema 校验；示意片段不是完整可发布的 ESI。',
      'ESI 描述与在线配置不一致时，应检查固件、SII、主站缓存及下载过程，不能只修改显示名称。',
      '本工具不执行设备通信，也不将静态描述视为已验证的在线行为。',
    ],
    relations: [
      relation('esi-root', '结构起点', '从 EtherCATInfo 查看文件层次。'),
      relation('esi-type', '身份', '产品码与修订号参与设备识别。'),
      relation('esi-sm', '通信资源', 'SM 描述要与过程数据和硬件资源配合。'),
      relation('esi-dictionary', '对象字典', '对象描述应与应用定义和固件保持一致。'),
      relation('esi-slots', '模块化', 'Slots 和 Modules 共同描述模块选择。'),
      relation('esi-eeprom', 'SII', 'EEPROM 描述与实际设备初始化数据需要核对。'),
    ],
    references: [esiReference, sscReference], aliases: ['ESI', 'XML', '设备描述', 'EtherCAT Slave Information'],
  },
  {
    id: 'ssc-compiler-overview', name: 'Compiler', title: 'Compiler：以当前 SSC 与厂商配置确认编译选项', category: 'hardware',
    overview: true, collection: 'SSC', group: 'Compiler',
    summary: '了解 Compiler 分组的核对方法；具体字段随 SSC 版本、厂商 Config.xml 和目标编译器变化。',
    sources: [{ kind: 'SSC', path: 'SSC Tool → Compiler' }],
    facts: [
      { label: '所在分组', value: 'SSC Tool / Compiler' },
      { label: '核对依据', value: '当前 SSC 版本、厂商 Config.xml、目标编译器与生成代码' },
      { label: '本页用途', value: '分组说明与编译适配核对步骤' },
    ],
    details: [
      '本页提供 Compiler 分组说明。先确认实际 SSC Tool 版本、厂商 Config.xml、目标处理器与编译器，再按当前界面中的字段说明检查生成结果。',
      '核对 C 类型的实际宽度、结构体打包与对齐方式、字节序及预定义宏。结合编译器文档与生成代码，确认应用对象的本地存储布局和数据访问方式。',
      '系统头文件、MCU 内存模型与 ESC 访问宽度也会影响编译适配。相关配置仍位于各自的 Generic 或 Hardware 分组，可通过下方关联继续核对。',
    ],
    rules: [
      '按当前工具和厂商配置确认字段名称、可选值与默认值；升级 SSC、切换 Config.xml 或编译器后重新核对。',
      '编译通过只说明当前工具链接受生成代码；仍需检查对象布局、访问宽度和相关运行逻辑。',
    ],
    relations: [
      relation('system-header-file', '相关核对', '公共系统声明实际位于 Generic 分组。'),
      relation('memory-unit-16bit', '相关核对', 'MCU 内存模型实际位于 Hardware 分组。'),
      relation('hw-access-file', '相关核对', '硬件适配声明实际位于 Hardware 分组。'),
      relation('ssc-overview', '返回概览', '结合完整配置树查阅工程选项。'),
    ],
    references: [sscReference], aliases: ['编译器', '编译选项', 'Config.xml'],
  },
]

const sscGroupIds = new Set(collections[0].groups.map(group => group.id))

export function getEntryNavigation(entry, origin) {
  if (entry.overview && entry.collection) {
    return { collection: entry.collection, group: entry.group || '' }
  }
  if (origin === 'ssc') {
    const source = entry.sources?.find(item => item.kind === 'SSC' && /^SSC Tool\s*→/.test(item.path))
    const segments = source?.path.split('→').map(part => part.trim()) || []
    const parent = segments[1] || ''
    const group = parent === 'Application' && segments[2] === 'ProcessData'
      ? 'Application/ProcessData'
      : sscGroupIds.has(parent) ? parent : ''
    return { collection: 'SSC', group }
  }
  if (origin === 'esi') {
    const path = (entry.sources?.find(source => source.kind === 'ESI')?.path || '').split('；')[0]
    let group = 'identity'
    if (/Eeprom(?:\/|$)/.test(path)) group = 'eeprom'
    else if (/Dictionary(?:\/|；|$)/.test(path)) group = 'dictionary'
    else if (/Slots|Descriptions\/Modules|DependOnSlot/.test(path)) group = 'modules'
    else if (/Fmmu|\/Sm(?:\/|$)|Mailbox|RxPdo|TxPdo|\/Dc(?:\/|$)/.test(path)) group = 'communication'
    return { collection: 'ESI', group }
  }
  if (origin === 'dictionary' && entry.sources?.[0]?.kind === 'XLSX') {
    return { collection: 'APP', group: entry.id === 'xlsx-modular' ? 'device' : 'fields' }
  }
  return { collection: 'concepts', group: '' }
}
