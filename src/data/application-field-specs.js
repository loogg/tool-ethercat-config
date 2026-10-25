export const applicationSyntaxReference = {
  title: 'Beckhoff ET9300 V1.10 · SSC OD Tool',
  url: 'https://download.beckhoff.com/download/Document/io/ethercat-development-products/an_et9300_v1i10.pdf',
  note: '§13.4 填写语法、§13.5 ENUM、§7.1对象布局、§6.4.1 模块与槽位；不同 SSC / OD Tool 版本应核对导入结果。',
}
const option = (syntax, meaning, extra = {}) => ({ syntax, meaning, ...extra })
const spec = (name, kind, scope, blank, section, options, examples, notes = []) => ({ name, kind, scope, blank, section, options, examples, notes })
const signedRange = bits => `${-(1n << BigInt(bits - 1))}…${(1n << BigInt(bits - 1)) - 1n}`
const unsignedRange = bits => `0…${(1n << BigInt(bits)) - 1n}`

const dataTypeCatalog = [
  option('BOOL / BIT', '布尔类型', { bits: '1', group: '位类型' }),
  option('BYTE', '8 位位串', { bits: '8', group: '位类型' }),
  option('WORD', '16 位位串', { bits: '16', group: '位类型' }),
  option('DWORD', '32 位位串', { bits: '32', group: '位类型' }),
  ...Array.from({ length: 8 }, (_, i) => option(`BIT${i + 1}`, `${i + 1} 位字段`, { bits: String(i + 1), group: '位类型' })),
  ...[8, 16, 32].map(bits => option(`BITARR${bits}`, `${bits} 位位数组类型`, { bits: String(bits), group: '位类型' })),
  ...[['SINT / INT8',8],['INT / INT16',16],['DINT / INT32',32],['LINT / INT64',64]].map(([syntax,bits]) => option(syntax, `${bits} 位有符号整数；${signedRange(bits)}`, { bits: String(bits), group: '数值' })),
  ...[['USINT / UINT8',8],['UINT / UINT16',16],['UDINT / UINT32',32],['ULINT / UINT64',64]].map(([syntax,bits]) => option(syntax, `${bits} 位无符号整数；${unsignedRange(bits)}`, { bits: String(bits), group: '数值' })),
  option('REAL', '32 位浮点数', { bits: '32', group: '数值' }), option('LREAL', '64 位浮点数', { bits: '64', group: '数值' }),
  option('STRING(n)', 'n 字节可见字符串，例如 STRING(16)', { bits: '8 × n', group: '字符串 / 数组' }),
  ...[['BYTE',8],['UINT',16],['INT',16],['SINT',8],['DINT',32],['UDINT',32]].map(([type,bits]) => option(`ARRAY [0..n] OF ${type}`, `上界包含 n，共 n+1 个元素；这是 DataType 语法`, { bits: `${bits} × (n+1)`, group: '字符串 / 数组' })),
  option('pad_x', '填充 1–15 bit，例如 pad_7；不承载业务值', { bits: 'x = 1…15', group: '填充 / 枚举' }),
  option('DTxxxxENyy', '先在 0x0800–0x0FFF 定义的枚举类型，例如 DT0800EN03', { bits: 'yy：定义的位宽', group: '填充 / 枚举' }),
]
const commonTypes = ['BOOL / BIT','USINT / UINT8','UINT / UINT16','UDINT / UINT32','ULINT / UINT64','SINT / INT8','INT / INT16','DINT / INT32','LINT / INT64','REAL','LREAL','STRING(n)']
export const applicationDataTypes = [...dataTypeCatalog].sort((a,b) => (commonTypes.includes(a.syntax) ? commonTypes.indexOf(a.syntax) : 100) - (commonTypes.includes(b.syntax) ? commonTypes.indexOf(b.syntax) : 100))

export const applicationAccessOptions = [
  option('ro', 'PREOP / SAFEOP / OP 只读'), option('wo', 'PREOP / SAFEOP / OP 只写'), option('rw', 'PREOP / SAFEOP / OP 可读写'),
  ...[['preop','PREOP'],['safeop','SAFEOP'],['op','OP'],['preop_safeop','PREOP + SAFEOP'],['safeop_op','SAFEOP + OP']].flatMap(([token,label]) => [option(`rd_${token}`, `在 ${label} 允许读`), option(`wr_${token}`, `在 ${label} 允许写`)]),
]
const valueOptions = [option('100 / 0x0064', '整数按 DataType 范围填写，例：UINT16 为 0…65535'), option('-10', '仅适用于允许负数的有符号类型'), option('TRUE / FALSE / 0 / 1', 'BOOL 的模板写法，按布尔值填写'), option('1.25', 'REAL / LREAL 等浮点类型'), option('Device01', 'STRING(n) 的文本内容，受字节长度限制')]

export const applicationFieldSpecs = {
  B: spec('Index', '格式 / 地址', '对象头行；成员行归属于上一个对象头', '成员行留空以使用所属对象的 Index；不能把空对象头当作有效索引。', '13.4.2 / 13.3', [
    option('0xZZZZ', '0x 前缀加 4 位十六进制，例如 0x6000'), option('0x2000–0x5FFF', '厂家自定义对象常用区间'), option('0x6000–0x9FFF', '适用 Profile 的对象区间'), option('0x1600… / 0x1A00… / 0x1C12 / 0x1C13', '手工 PDO Mapping / Assignment 专用描述，按 §13.3'), option('0xF000 / 0xF030', 'MDP 专用对象，按模块模型定义'),
  ], ['0x2000', '0x6000', '0x7000'], ['16 位地址的格式正确不等于该索引允许用于当前 Profile。', '0x1000、0x1018、0x1C00、0x1C32、0x1C33 等 SSC 内置对象不要重复定义。']),
  C: spec('ObjectCode', '枚举', '对象头行', 'V1.10 可依据条目推断；建议明确填写以便核对结构。', '13.4.3', [option('VARIABLE','单值对象，值通过 :00 访问'),option('ARRAY','同类型成员集合'),option('RECORD','逐成员描述，允许不同类型')], ['RECORD'], ['成员行不重复填写 ObjectCode。', 'ARRAY / RECORD 的 :00 由工具补充。']),
  D: spec('SI / SubIndex', '整数 / 范围', 'ARRAY / RECORD 的成员行', 'VARIABLE 一般不另写成员行；其 :00 是变量值。', '13.4.4', [option('1…255','十进制子索引'),option('0x01…0xFF','十六进制子索引'),option('n..m','连续范围，例如 1..15')], ['1','0x02','1..15'], ['不要手工增加 ARRAY / RECORD 的 SI=0 业务成员行。', '稀疏子索引的最高值与有效成员数分别判断。']),
  E: spec('DataType', '类型 / 参数化语法', 'VARIABLE 对象行或复合对象的成员行', 'RECORD 对象头可留空；真正的业务值需要相应类型。', '13.4.5 / 13.5', applicationDataTypes, ['BOOL','UINT16','STRING(16)','ARRAY [0..7] OF BYTE','pad_7'], ['表23列出标准基本类型名；UINT16 等 SSC 写法见官方示例及模板。', 'STRING(n) 的长度是字节数；ARRAY [0..n] 的长度是 n+1，不等同于 ObjectCode=ARRAY。', 'SSC §7.1：≤8 bit成员不能跨字节，且组成从WORD起点开始、完全填满的16 bit块。', 'SSC §7.1：>8 bit成员须从相对对象起点的整WORD偏移开始；这是本地对象默认访问假设，不是PDO通用限制。']),
  F: spec('Name', '文本 / 名称模板', '对象名或 RECORD 成员名', 'ARRAY 成员可按工具规则生成名称；对象应有可识别名称。', '13.4.4', [option('ActualPosition','用途明确的对象或成员名称'),option('Channel{_SI_:d}','范围 SI 的名称占位符，按子索引生成名称')], ['Inputs','OutputEnable','Channel{_SI_:d}'], ['建议使用便于生成 C 符号的英文名称；生成器的字符转换需核对。', '名称不是对象地址，改名不应被理解为改 Index / SI。']),
  G: spec('Default Value', '按类型填写', 'VARIABLE 或成员；F030 成员另表示默认模块', '未显式指定，不把空白当作已配置 0；核对生成和初始化结果。', '13.4.7 / 6.4.1', valueOptions, ['100','FALSE','0x4711'], ['这是“数值”列，不等同于其他模板的 Default 原始字节列。', '默认值不等于运行时当前值；备份恢复和主站 Startup 可能覆盖。']),
  H: spec('Min Value', '按类型填写', '参数或成员的下限描述', '未显式提供下限。', '13.4.7', valueOptions.filter(item => !item.syntax.includes('Device01')), ['0','-100','-1.25'], ['与 DataType 的可表示范围一起核对；描述下限不替代固件写入校验。']),
  I: spec('Max Value', '按类型填写', '参数或成员的上限描述', '未显式提供上限。', '13.4.7', valueOptions.filter(item => !item.syntax.includes('Device01')), ['1000','0xFFFF','1.25'], ['Min / Max 与当前字段类型相容；元数据不是运行时自动限幅。']),
  J: spec('M/O/C', '枚举', '一般条目；PDO Mapping 对象头有专用含义', '普通条目未显式分类；PDO Mapping 对象的空白按必选处理。', '13.4.8 / 13.3.2', [option('M','Mandatory：在适用 Profile 下必选'),option('O','Optional：可选'),option('C','Conditional：满足规定条件时必选')], ['M','O'], ['一般条目的该属性主要用于 ESI 描述，不自动执行固件状态校验。', 'PDO Mapping 对象头的 O 表示可选 PDO，M 或空白表示必选 PDO。']),
  K: spec('B/S', '枚举', '参数 / 成员属性', '未声明 Backup 或 Setting 属性。', '13.4.8', [option('B','Backup：备份参数'),option('S','Setting：设置参数')], ['B','S'], ['标为 B 不会自动实现非易失存储；仍需 SSC 备份功能和应用保存逻辑。']),
  L: spec('Access', '枚举 / 组合', '对象或成员的 CoE / SDO 访问权限', '未显式指定；不要靠空白推断最终权限，核对模板和生成结果。', '13.4.9', applicationAccessOptions, ['ro','rw','ro,wr_preop','rd_preop_safeop,wr_preop'], ['多个权限用英文逗号组合；例如 ro,wr_preop 表示各状态可读、仅 PREOP 可写。', 'RECORD / ARRAY 对象头的权限作用于 :00；成员行各自定义。', '这里的权限与 rx/tx 的 PDO 可映射性独立。']),
  M: spec('rx/tx', '枚举', '允许进入 PDO 的数据成员', '不声明该成员可映射到 PDO；SDO 访问权限另外判断。', '13.4.8', [option('rx','从站接收：主站输出 → RxPDO'),option('tx','从站发送：TxPDO → 主站输入')], ['rx','tx'], ['这列表示可映射能力，不表示已有活动 Mapping / Assignment。', 'rx,tx 组合写法未在此依据中列为支持格式。']),
  N: spec('CoeRead', '函数名称', '对象行的专用读取处理', '使用协议栈默认读取路径。', '13.4.10', [option('mySdoRead','填写处理函数名称，工具生成对应声明')], ['ReadActualValue','mySdoRead'], ['填函数名，不填 true/false、函数调用、参数列表或整段函数体。', '按生成的 Objects.h 函数原型实现；读权限仍由 Access 等规则检查。']),
  O: spec('CoeWrite', '函数名称', '对象行的专用写入处理', '使用协议栈默认写入路径。', '13.4.10', [option('mySdoWrite','填写处理函数名称，工具生成对应声明')], ['WriteConfiguration','mySdoWrite'], ['函数名不是“是否允许写”；仍需实现校验、写入和必要的挂起流程。', '返回值遵守生成器/SSC 的 ABORTIDX 接口；不要把返回值填写在此列。']),
  P: spec('Description', '文本 / 结构注解', '对象或成员；槽位注解用于基础表 F030', '没有补充说明；F030 未写 Slotname 时使用工具规则命名。', '6.4.1.1', [option('单位 ms；0 表示关闭','普通用途、单位、限制等说明文本'),option('[Slotname: Input Slot]','F030 成员：槽位名称'),option('[ModuleIds: 0x4711;0x4712]','F030 成员：允许的十六进制模块 ID，以分号分隔'),option('[ModuleIds: 0x4711] [ModuleIds: 0x4712]','也可重复 ModuleIds 注解')], ['Digital input 1','[Slotname: Input Slot] [ModuleIds: 0x4711]'], ['槽位默认 Module Ident 位于 Default Value，不位于 Slotname。', '普通说明不会自动生成应用逻辑。']),
  'header:Device Profile': spec('Device Profile','16 位编号','设备 / 基础应用表头','未显式指定；正式项目按适用 Profile 填写。','6.4 / 6.4.1',[option('5001','Modular Device Profile 示例'),option('402','CiA402 示例；不是所有 I/O 设备都应使用')],['5001'],['Profile 编号与是否存在模块模板、Slot 关系分别判断。']),
  'header:Modul Profile': spec('Modul Profile','16 位编号','表头附加 Profile 信息','未显式指定。','6.4.1',[option('0','未指定具体附加模块 Profile 的示例'),option('按适用 Profile 编号','不是模块数量')],['0']),
  'header:Module Ident': spec('Module Ident','模块类型标识','模块模板表头；基础表不填写','该表不被该字段标识为模块模板。','6.4.1.2',[option('0x4711','32 位模块标识示例'),option('0x4712','另一个模块类型的标识示例')],['0x4711'],['同一应用中模块类型标识应唯一；Slot 的允许列表与默认值引用该标识。']),
  'header:IndexIncrement': spec('IndexIncrement','增量 / 依赖设置','普通/单实例模板也保留；模块化时按表角色解释','未填写与显式0不同；不能凭字段出现推断有Slot。','6.4.1',[option('0','零增量示例；普通模板可显式保留0'),option('0x10','对象索引步长示例'),option('0x800','多轴对象布局中的步长示例')],['0','0x10'],['实例索引按模板索引、槽位序号和基础表步长计算，仅适用于 DependOnSlot 对象。', '模块表中的增量值不取代基础表的实际增量。']),
  'header:PdoIndexIncrement': spec('PdoIndexIncrement','增量 / 依赖设置','普通/单实例模板也保留；模块化时分别解释PDO增量与依赖','未填写与显式0不同；不据此推定生成的PDO索引。','6.4.1',[option('0','零增量示例；普通模板可显式保留0'),option('0x1','PDO 索引步长示例'),option('0x10','另一种 PDO 间隔示例')],['0','0x1'],['PDO 索引与业务对象索引是不同地址空间，不能套用同一个步长。']),
}

export function applicationFieldSpec(key) { return applicationFieldSpecs[key] || applicationFieldSpecs.B }
