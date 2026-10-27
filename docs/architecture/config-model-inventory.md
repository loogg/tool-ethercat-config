# 配置模型逐项判断清单

日期：2026-10-27。共113个已审查配置/兼容参考（Identity对照不作为目录配置项显示），依据已有项目技术资料与用户最新评审明确分类。模型定义在src/data/config-models.js；新增正式配置无分类时测试失败。

分类决定应采用字段映射、分支、位域、权限、时序、地址或容量/缓冲结构。工程连线的具体条件与来源仍单独保存；旧资料中的不确定关联保留为参考虚线，不自动解释成同值或公式。

v1.2：APP 字段在[工作表与领域关联模型](application-definition-model.md)中呈现，说明结合对象头、成员或模块表头语境；不再把列定义作为孤立配置页展示。

| 配置 | 所属位置 | 模型 | 判断依据 |
|---|---|---|---|
| VENDOR_ID / PRODUCT_CODE / REVISION_NUMBER / SERIAL_NUMBER | SSC / SlaveInformation | 身份字段映射 | 逐项对应0x1018:01/02/03/04，核对适用的ESI与SII；不复用示例厂商值。 |
| VENDOR_NAME / GROUP_NAME | SSC / SlaveInformation | 目录显示元数据 | 厂商显示名称与分组标识/引用单独处理，不虚构CoE对象。 |
| VENDOR_IMAGE / GROUP_IMAGE / DEVICE_IMAGE | SSC / SlaveInformation | 图标数据与生成目标 | 各自的ESI父级、完整BMP HEX与外部转换工具，区别于CoE或SII身份数据。 |
| DEVICE_PROFILE_TYPE | SSC / SlaveInformation | Device Type与Profile位段 | 0x1000全32bit、低16bit Profile号与高16bit附加信息分别核对；5001=0x1389、402=0x0192。 |
| DEVICE_NAME / DEVICE_HW_VERSION / DEVICE_SW_VERSION | SSC / SlaveInformation | 名称与版本字段映射 | 保留原深链接；对应0x1008/9/A，说明版本相关*_LEN，不混用固件版本与数字Revision。 |
| Identity字段对照 | SSC / SlaveInformation · 兼容参考 | 身份字段映射 | 通过关联/旧链接查阅四字段对照，不显示为独立可填写参数。 |
| SYSTEM_HEADER_FILE | SSC / Generic | 头文件引用 | 表达公共声明或硬件适配头文件的代码引用；不假设有同值 ESI 字段。 |
| EXPLICIT_DEVICE_ID | SSC / Generic | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| ESC_SM_WD_SUPPORTED | SSC / Generic | 看门狗路径与计时 | 选择硬件状态/本地计时路径；独立展示 Divider、Count、触发条件及公式。 |
| STATIC_OBJECT_DIC | SSC / Generic | 组织与缓冲策略 | 表达静态/动态组织或资源分配策略，不与读写权限或协议容量混为一谈。 |
| ESC_EEPROM_ACCESS_SUPPORT | SSC / Generic | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| HW_ACCESS_FILE | SSC / Hardware | 头文件引用 | 表达公共声明或硬件适配头文件的代码引用；不假设有同值 ESI 字段。 |
| MEMORY_UNIT_16BIT | SSC / Hardware | 访问宽度与对齐 | 区分 MCU 最小寻址单位、PDI 访问宽度、本地缓冲访问及对齐条件。 |
| ESC_16BIT_ACCESS | SSC / Hardware | 访问宽度与对齐 | 区分 MCU 最小寻址单位、PDI 访问宽度、本地缓冲访问及对齐条件。 |
| ESC_32BIT_ACCESS | SSC / Hardware | 访问宽度与对齐 | 区分 MCU 最小寻址单位、PDI 访问宽度、本地缓冲访问及对齐条件。 |
| MBX_16BIT_ACCESS | SSC / Hardware | 访问宽度与对齐 | 区分 MCU 最小寻址单位、PDI 访问宽度、本地缓冲访问及对齐条件。 |
| UC_SET_ECAT_LED | SSC / Hardware | 硬件职责选择 | 先区分 MCU / ESC / EEPROM 的实现职责，再连接相应硬件接口和生成物。 |
| ESC_SUPPORT_ECAT_LED | SSC / Hardware | 硬件职责选择 | 先区分 MCU / ESC / EEPROM 的实现职责，再连接相应硬件接口和生成物。 |
| ESC_EEPROM_EMULATION | SSC / Hardware | 硬件职责选择 | 先区分 MCU / ESC / EEPROM 的实现职责，再连接相应硬件接口和生成物。 |
| CREATE_EEPROM_CONTENT | SSC / Hardware | 硬件职责选择 | 先区分 MCU / ESC / EEPROM 的实现职责，再连接相应硬件接口和生成物。 |
| ESC_EEPROM_SIZE | SSC / Hardware | 非易失存储容量 | EEPROM 容量及 SII 内容预算；不套用 PDO 三缓冲公式。 |
| BOOTSTRAPMODE_SUPPORTED | SSC / EtherCAT State Machine | 状态路径与条件 | 按 EtherCAT 状态迁移和前置条件解释，避免与普通功能开关混用。 |
| OP_PD_REQUIRED | SSC / EtherCAT State Machine | 状态路径与条件 | 按 EtherCAT 状态迁移和前置条件解释，避免与普通功能开关混用。 |
| PREOPTIMEOUT | SSC / EtherCAT State Machine | 状态转换时限 | 描述特定迁移路径的等待时限与单位，不把状态超时当过程数据周期。 |
| SAFEOP2OPTIMEOUT | SSC / EtherCAT State Machine | 状态转换时限 | 描述特定迁移路径的等待时限与单位，不把状态超时当过程数据周期。 |
| CHECK_SM_PARAM_ALIGNMENT | SSC / EtherCAT State Machine | 访问宽度与对齐 | 区分 MCU 最小寻址单位、PDI 访问宽度、本地缓冲访问及对齐条件。 |
| AL_EVENT_ENABLED | SSC / Synchronisation | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| DC_SUPPORTED | SSC / Synchronisation | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| ECAT_TIMER_INT | SSC / Synchronisation | 时基来源 | 确定 1ms 服务来自中断还是其他调用路径，区别于控制周期本身。 |
| MIN_PD_CYCLE_TIME | SSC / Synchronisation | 周期与处理耗时 | 区分固定能力值、运行测量值、周期上下限；CoE 关联定位到具体子项。 |
| MAX_PD_CYCLE_TIME | SSC / Synchronisation | 周期与处理耗时 | 区分固定能力值、运行测量值、周期上下限；CoE 关联定位到具体子项。 |
| PD_OUTPUT_CALC_AND_COPY_TIME | SSC / Synchronisation | 周期与处理耗时 | 区分固定能力值、运行测量值、周期上下限；CoE 关联定位到具体子项。 |
| PD_INPUT_CALC_AND_COPY_TIME | SSC / Synchronisation | 周期与处理耗时 | 区分固定能力值、运行测量值、周期上下限；CoE 关联定位到具体子项。 |
| PD_OUTPUT_DELAY_TIME | SSC / Synchronisation | 物理延迟描述 | 描述物理输出/采集延迟；描述值不是自动补偿动作。 |
| PD_INPUT_DELAY_TIME | SSC / Synchronisation | 物理延迟描述 | 描述物理输出/采集延迟；描述值不是自动补偿动作。 |
| MIN_PD_WRITE_ADDRESS | SSC / Application/ProcessData | 物理地址窗口 | Min/Max 约束起点；结束边界由 Length、缓冲模式和内部字宽共同计算。 |
| DEF_PD_WRITE_ADDRESS | SSC / Application/ProcessData | 默认与实际 SM 地址 | 连接 SSC 默认地址、ESI StartAddress、主站实际寄存器与物理占用；分工依设备而定。 |
| MAX_PD_WRITE_ADDRESS | SSC / Application/ProcessData | 物理地址窗口 | Min/Max 约束起点；结束边界由 Length、缓冲模式和内部字宽共同计算。 |
| MIN_PD_READ_ADDRESS | SSC / Application/ProcessData | 物理地址窗口 | Min/Max 约束起点；结束边界由 Length、缓冲模式和内部字宽共同计算。 |
| DEF_PD_READ_ADDRESS | SSC / Application/ProcessData | 默认与实际 SM 地址 | 连接 SSC 默认地址、ESI StartAddress、主站实际寄存器与物理占用；分工依设备而定。 |
| MAX_PD_READ_ADDRESS | SSC / Application/ProcessData | 物理地址窗口 | Min/Max 约束起点；结束边界由 Length、缓冲模式和内部字宽共同计算。 |
| MAX_PD_INPUT_SIZE | SSC / Application/ProcessData | PDO 容量与缓冲 | 活动位长→字节长度→容量约束；单缓冲跨度、三缓冲和最大容量预留分别计算。 |
| MAX_PD_OUTPUT_SIZE | SSC / Application/ProcessData | PDO 容量与缓冲 | 活动位长→字节长度→容量约束；单缓冲跨度、三缓冲和最大容量预留分别计算。 |
| MAILBOX_QUEUE | SSC / Mailbox | 组织与缓冲策略 | 表达静态/动态组织或资源分配策略，不与读写权限或协议容量混为一谈。 |
| COE_SUPPORTED | SSC / Mailbox | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| COMPLETE_ACCESS_SUPPORTED | SSC / Mailbox | SDO访问与占位 | 能力声明、对象组织、SI0协议8bit、默认本地16bit与CA0/1前缀分层；当前来源的真实字段另在工作台核对。 |
| SEGMENTED_SDO_SUPPORTED | SSC / Mailbox | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| SDO_RES_INTERFACE | SSC / Mailbox | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| BACKUP_PARAMETER_SUPPORTED | SSC / Mailbox | 参数保存策略 | 区分运行值、备份标志、保存触发及存储实现，不能从标记推断已经落盘。 |
| STORE_BACKUP_PARAMETER_IMMEDIATELY | SSC / Mailbox | 参数保存策略 | 区分运行值、备份标志、保存触发及存储实现，不能从标记推断已经落盘。 |
| FOE_SUPPORTED | SSC / Mailbox | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| DIAGNOSIS_SUPPORTED | SSC / Mailbox | 诊断记录与事件 | 区别可查询的历史记录与主动异常消息；不当作应用保护或急停。 |
| EMERGENCY_SUPPORTED | SSC / Mailbox | 诊断记录与事件 | 区别可查询的历史记录与主动异常消息；不当作应用保护或急停。 |
| AOE_SUPPORTED | SSC / Mailbox | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| VOE_SUPPORTED | SSC / Mailbox | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| SOE_SUPPORTED | SSC / Mailbox | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| EOE_SUPPORTED | SSC / Mailbox | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| STATIC_ETHERNET_BUFFER | SSC / Mailbox | 组织与缓冲策略 | 表达静态/动态组织或资源分配策略，不与读写权限或协议容量混为一谈。 |
| DEF_MBX_WRITE_ADDRESS | SSC / Mailbox | 默认与实际 SM 地址 | 连接 SSC 默认地址、ESI StartAddress、主站实际寄存器与物理占用；分工依设备而定。 |
| DEF_MBX_READ_ADDRESS | SSC / Mailbox | 默认与实际 SM 地址 | 连接 SSC 默认地址、ESI StartAddress、主站实际寄存器与物理占用；分工依设备而定。 |
| DEF_MBX_SIZE | SSC / Mailbox | 邮箱容量与单缓冲 | 默认/最大 mailbox 长度和协议头负载分别表达；典型 mailbox 用单缓冲。 |
| MAX_MBX_SIZE | SSC / Mailbox | 邮箱容量与单缓冲 | 默认/最大 mailbox 长度和协议头负载分别表达；典型 mailbox 用单缓冲。 |
| Index | APP / fields | 对象与子索引 | 分别表示 16bit Index 和 8bit SubIndex；高低字节仅属于 Index 自身。 |
| ObjectCode | APP / fields | 对象结构 | VARIABLE、ARRAY、RECORD 的成员结构与 SubIndex 0 需按对象模型判断。 |
| SI / SubIndex | APP / fields | 对象与子索引 | 分别表示 16bit Index 和 8bit SubIndex；高低字节仅属于 Index 自身。 |
| DataType | APP / fields | 类型与位宽 | 协议数据类型、值域和 PDO BitLen 相关，但不等于 MCU 的 sizeof。 |
| Name | APP / fields | 名称与语义描述 | 名称、说明及目录分类不改变协议地址，不制造计算或因果关系。 |
| Default Value | APP / fields | 默认与实际值 | 默认值参与初始化；备份、Startup和应用处理可能覆盖，不能等同运行值。 |
| Min Value / Max Value | APP / fields | 值域与写入校验 | 元数据范围与实际应用校验职责分开；默认值需处于允许范围。 |
| M/O/C | APP / fields | 必选与选择约束 | 普通实现类别、可选PDO映射及实际活动分配有不同语义。 |
| B/S | APP / fields | 参数保存策略 | 区分运行值、备份标志、保存触发及存储实现，不能从标记推断已经落盘。 |
| Access | APP / fields | 状态权限矩阵 | CoE/SDO 的读写与 PREOP/SAFEOP/OP 状态相关，不等同 PDO 方向。 |
| rx/tx | APP / fields | PDO 方向与映射 | 从站 Rx/Tx 与主站 Output/Input 对照；可映射性和活动分配分别表达。 |
| CoeRead | APP / fields | SDO回调流程 | 函数名绑定对象读写处理路径；权限校验、完成/Abort和版本支持的Pending机制分别判断。 |
| CoeWrite | APP / fields | SDO回调流程 | 函数名绑定对象读写处理路径；权限校验、完成/Abort和版本支持的Pending机制分别判断。 |
| Description | APP / fields | 名称与语义描述 | 名称、说明及目录分类不改变协议地址，不制造计算或因果关系。 |
| Padding / Bit alignment | APP / fields | 本地布局与位流 | SSC 对象成员 WORD/字节条件和线上 PDO 位布局分开，填充需显式定义。 |
| Modular device / Index distance | APP / device | 模块实例与索引展开 | 模块定义、插槽选择及索引/PDO步长是不同层；实例地址由基址和位置推导。 |
| EtherCATInfo | ESI / identity | ESI 层级与引用 | 按 XML 父级/子项表达文件结构及引用，不把容器当作数值配置。 |
| Vendor / Id | ESI / identity | 身份字段映射 | 配置字段连接到 CoE / ESI / SII 身份，不把对象索引作为配置名。 |
| Groups / GroupType | ESI / identity | 名称与语义描述 | 名称、说明及目录分类不改变协议地址，不制造计算或因果关系。 |
| Devices / Device | ESI / identity | ESI 层级与引用 | 按 XML 父级/子项表达文件结构及引用，不把容器当作数值配置。 |
| Type / ProductCode / RevisionNo | ESI / identity | 身份字段映射 | 配置字段连接到 CoE / ESI / SII 身份，不把对象索引作为配置名。 |
| Name | ESI / identity | 身份字段映射 | 配置字段连接到 CoE / ESI / SII 身份，不把对象索引作为配置名。 |
| Fmmu | ESI / communication | 逻辑与物理映射 | FMMU 连接主站逻辑过程映像与 ESC 物理存储，不等同 CoE PDO 对象映射。 |
| Sm | ESI / communication | SyncManager 资源模型 | 地址、Length、Control、方向、模式及激活分层；占用以实际 ESC 资源为准。 |
| Sm / ControlByte | ESI / communication | 位域与能力条件 | 逐位解释控制字节/位图，保留位和支持能力按目标硬件限定。 |
| Mailbox | ESI / communication | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| Mailbox / CoE | ESI / communication | 功能前提与能力 | 展示开启条件、相关声明与应用接入；开关不表示业务已经实现。 |
| CoE / PdoAssign | ESI / communication | 映射与分配下载 | PdoAssign 指向分配表，PdoConfig 指向成员映射；能力声明不等于实际下载成功。 |
| CoE / PdoConfig | ESI / communication | 映射与分配下载 | PdoAssign 指向分配表，PdoConfig 指向成员映射；能力声明不等于实际下载成功。 |
| RxPdo | ESI / communication | PDO 方向与映射 | 从站 Rx/Tx 与主站 Output/Input 对照；可映射性和活动分配分别表达。 |
| TxPdo | ESI / communication | PDO 方向与映射 | 从站 Rx/Tx 与主站 Output/Input 对照；可映射性和活动分配分别表达。 |
| PDO / Entry | ESI / communication | 32bit 映射编码 | 明确 Index16 / SubIndex8 / BitLen8 三段，并区分映射对象自身地址和被映射成员。 |
| PDO / Fixed / Mandatory / Sm | ESI / communication | 必选与选择约束 | 普通实现类别、可选PDO映射及实际活动分配有不同语义。 |
| Dc / OpMode | ESI / communication | 同步模式与事件 | 主站可选模式、AssignActivate与实际SYNC事件配合，不与最小应用周期能力恒等。 |
| AssignActivate | ESI / communication | 位域与能力条件 | 逐位解释控制字节/位图，保留位和支持能力按目标硬件限定。 |
| Profile / Dictionary | ESI / dictionary | ESI 层级与引用 | 按 XML 父级/子项表达文件结构及引用，不把容器当作数值配置。 |
| Dictionary / DataTypes | ESI / dictionary | 类型与位宽 | 协议数据类型、值域和 PDO BitLen 相关，但不等于 MCU 的 sizeof。 |
| Dictionary / Objects | ESI / dictionary | ESI 层级与引用 | 按 XML 父级/子项表达文件结构及引用，不把容器当作数值配置。 |
| Slots / Slot / ModuleIdent | ESI / modules | 模块实例与索引展开 | 模块定义、插槽选择及索引/PDO步长是不同层；实例地址由基址和位置推导。 |
| Modules / Module | ESI / modules | 模块实例与索引展开 | 模块定义、插槽选择及索引/PDO步长是不同层；实例地址由基址和位置推导。 |
| SlotIndexIncrement / SlotPdoIncrement | ESI / modules | 模块实例与索引展开 | 模块定义、插槽选择及索引/PDO步长是不同层；实例地址由基址和位置推导。 |
| Eeprom / SII | ESI / eeprom | 非易失存储容量 | EEPROM 容量及 SII 内容预算；不套用 PDO 三缓冲公式。 |
| Eeprom / ConfigData | ESI / eeprom | 硬件职责选择 | 先区分 MCU / ESC / EEPROM 的实现职责，再连接相应硬件接口和生成物。 |
