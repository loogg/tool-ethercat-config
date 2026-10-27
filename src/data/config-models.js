// Explicit review inventory. Adding a configuration requires a model decision;
// a source label or a free-text relation does not decide its structure.
const decisions = [
  ['identity', '身份字段映射', '配置字段连接到 CoE / ESI / SII 身份，不把对象索引作为配置名。', ['coe-device-name', 'coe-hardware-version', 'coe-software-version', 'coe-identity', 'esi-vendor', 'esi-type', 'esi-name']],
  ['include', '头文件引用', '表达公共声明或硬件适配头文件的代码引用；不假设有同值 ESI 字段。', ['system-header-file', 'hw-access-file']],
  ['callback', 'SDO回调流程', '函数名绑定对象读写处理路径；权限校验、完成/Abort和版本支持的Pending机制分别判断。', ['xlsx-coe-read', 'xlsx-coe-write']],
  ['access-model', '访问宽度与对齐', '区分 MCU 最小寻址单位、PDI 访问宽度、本地缓冲访问及对齐条件。', ['memory-unit-16bit', 'esc-16bit-access', 'esc-32bit-access', 'mbx-16bit-access', 'check-sm-param-alignment']],
  ['feature', '功能前提与能力', '展示开启条件、相关声明与应用接入；开关不表示业务已经实现。', ['explicit-device-id', 'esc-eeprom-access-support', 'al-event-enabled', 'dc-supported', 'coe-supported', 'segmented-sdo-supported', 'sdo-res-interface', 'foe-supported', 'aoe-supported', 'voe-supported', 'soe-supported', 'eoe-supported', 'esi-mailbox', 'esi-coe']],
  ['sdo-access', 'SDO访问与占位', '能力声明、对象组织、SI0协议类型、默认本地占位与CA前缀分层；实际参数在当前来源工作台核对。', ['complete-access-supported']],
  ['organization', '组织与缓冲策略', '表达静态/动态组织或资源分配策略，不与读写权限或协议容量混为一谈。', ['static-object-dic', 'mailbox-queue', 'static-ethernet-buffer']],
  ['hardware-owner', '硬件职责选择', '先区分 MCU / ESC / EEPROM 的实现职责，再连接相应硬件接口和生成物。', ['uc-set-ecat-led', 'esc-support-ecat-led', 'esc-eeprom-emulation', 'create-eeprom-content', 'esi-configdata']],
  ['storage-size', '非易失存储容量', 'EEPROM 容量及 SII 内容预算；不套用 PDO 三缓冲公式。', ['esc-eeprom-size', 'esi-eeprom']],
  ['state', '状态路径与条件', '按 EtherCAT 状态迁移和前置条件解释，避免与普通功能开关混用。', ['bootstrapmode-supported', 'op-pd-required']],
  ['timeout', '状态转换时限', '描述特定迁移路径的等待时限与单位，不把状态超时当过程数据周期。', ['preoptimeout', 'safeop2optimeout']],
  ['watchdog', '看门狗路径与计时', '选择硬件状态/本地计时路径；独立展示 Divider、Count、触发条件及公式。', ['esc-sm-wd-supported']],
  ['timebase', '时基来源', '确定 1ms 服务来自中断还是其他调用路径，区别于控制周期本身。', ['ecat-timer-int']],
  ['timing', '周期与处理耗时', '区分固定能力值、运行测量值、周期上下限；CoE 关联定位到具体子项。', ['min-pd-cycle-time', 'max-pd-cycle-time', 'pd-output-calc-and-copy-time', 'pd-input-calc-and-copy-time']],
  ['delay', '物理延迟描述', '描述物理输出/采集延迟；描述值不是自动补偿动作。', ['pd-output-delay-time', 'pd-input-delay-time']],
  ['address-range', '物理地址窗口', 'Min/Max 约束起点；结束边界由 Length、缓冲模式和内部字宽共同计算。', ['min-pd-write-address', 'max-pd-write-address', 'min-pd-read-address', 'max-pd-read-address']],
  ['sm-address', '默认与实际 SM 地址', '连接 SSC 默认地址、ESI StartAddress、主站实际寄存器与物理占用；分工依设备而定。', ['def-pd-write-address', 'def-pd-read-address', 'def-mbx-write-address', 'def-mbx-read-address']],
  ['pdo-capacity', 'PDO 容量与缓冲', '活动位长→字节长度→容量约束；单缓冲跨度、三缓冲和最大容量预留分别计算。', ['max-pd-input-size', 'max-pd-output-size']],
  ['mailbox-capacity', '邮箱容量与单缓冲', '默认/最大 mailbox 长度和协议头负载分别表达；典型 mailbox 用单缓冲。', ['def-mbx-size', 'max-mbx-size']],
  ['persistence', '参数保存策略', '区分运行值、备份标志、保存触发及存储实现，不能从标记推断已经落盘。', ['backup-parameter-supported', 'store-backup-parameter-immediately', 'xlsx-bs']],
  ['diagnostics', '诊断记录与事件', '区别可查询的历史记录与主动异常消息；不当作应用保护或急停。', ['diagnosis-supported', 'emergency-supported']],
  ['object-address', '对象与子索引', '分别表示 16bit Index 和 8bit SubIndex；高低字节仅属于 Index 自身。', ['xlsx-index', 'xlsx-si']],
  ['object-shape', '对象结构', 'VARIABLE、ARRAY、RECORD 的成员结构与 SubIndex 0 需按对象模型判断。', ['xlsx-object-code']],
  ['data-type', '类型与位宽', '协议数据类型、值域和 PDO BitLen 相关，但不等于 MCU 的 sizeof。', ['xlsx-data-type', 'esi-datatypes']],
  ['metadata', '名称与语义描述', '名称、说明及目录分类不改变协议地址，不制造计算或因果关系。', ['xlsx-name', 'xlsx-description', 'esi-groups']],
  ['initial-value', '默认与实际值', '默认值参与初始化；备份、Startup和应用处理可能覆盖，不能等同运行值。', ['xlsx-default']],
  ['range', '值域与写入校验', '元数据范围与实际应用校验职责分开；默认值需处于允许范围。', ['xlsx-min-max']],
  ['selection', '必选与选择约束', '普通实现类别、可选PDO映射及实际活动分配有不同语义。', ['xlsx-moc', 'esi-pdo-flags']],
  ['permissions', '状态权限矩阵', 'CoE/SDO 的读写与 PREOP/SAFEOP/OP 状态相关，不等同 PDO 方向。', ['xlsx-access']],
  ['pdo-direction', 'PDO 方向与映射', '从站 Rx/Tx 与主站 Output/Input 对照；可映射性和活动分配分别表达。', ['xlsx-rx-tx', 'esi-rxpdo', 'esi-txpdo']],
  ['alignment', '本地布局与位流', 'SSC 对象成员 WORD/字节条件和线上 PDO 位布局分开，填充需显式定义。', ['xlsx-padding']],
  ['module-address', '模块实例与索引展开', '模块定义、插槽选择及索引/PDO步长是不同层；实例地址由基址和位置推导。', ['xlsx-modular', 'esi-slots', 'esi-modules', 'esi-slot-increments']],
  ['xml-structure', 'ESI 层级与引用', '按 XML 父级/子项表达文件结构及引用，不把容器当作数值配置。', ['esi-root', 'esi-device', 'esi-dictionary', 'esi-objects']],
  ['logical-map', '逻辑与物理映射', 'FMMU 连接主站逻辑过程映像与 ESC 物理存储，不等同 CoE PDO 对象映射。', ['esi-fmmu']],
  ['sm-structure', 'SyncManager 资源模型', '地址、Length、Control、方向、模式及激活分层；占用以实际 ESC 资源为准。', ['esi-sm']],
  ['bitfield', '位域与能力条件', '逐位解释控制字节/位图，保留位和支持能力按目标硬件限定。', ['esi-control-byte', 'esi-assign-activate']],
  ['pdo-download', '映射与分配下载', 'PdoAssign 指向分配表，PdoConfig 指向成员映射；能力声明不等于实际下载成功。', ['esi-pdoassign', 'esi-pdoconfig']],
  ['mapping-code', '32bit 映射编码', '明确 Index16 / SubIndex8 / BitLen8 三段，并区分映射对象自身地址和被映射成员。', ['esi-entry']],
  ['sync-mode', '同步模式与事件', '主站可选模式、AssignActivate与实际SYNC事件配合，不与最小应用周期能力恒等。', ['esi-dc']],
]

export const configModelProfiles = Object.fromEntries(decisions.flatMap(([kind, label, rationale, ids]) => ids.map(id => [id, { kind, label, rationale }])))
export const reviewedConfigurationIds = decisions.flatMap(([, , , ids]) => ids)
export function getConfigModel(entry) {
  return configModelProfiles[entry.id] || { kind: entry.nodeKind === 'object' ? 'object-reference' : 'reference', label: entry.nodeKind === 'object' ? '对象结构参考' : '协议参考', rationale: '辅助说明不进入普通配置目录；地址与技术关系按其具体对象解释。' }
}
