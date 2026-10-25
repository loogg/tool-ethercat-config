# 时序呈现判断清单 · v1.3.0

以配置的语义判断是否需要时间轴；未列物理执行假设时不生成波形。时序数值都是独立教学输入。

| 入口 | 配置 | 模型 | 时序决定 |
|---|---|---|---|
| SSC | Device name | identity | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | Hardware version | identity | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | Software version | identity | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | Vendor / Product / Revision / Serial | identity | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | SYSTEM_HEADER_FILE | include | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | EXPLICIT_DEVICE_ID | feature | 能力开关本身不是事件；关系图说明启用条件。 |
| SSC | ESC_SM_WD_SUPPORTED | watchdog | 看门狗：触发、倒计时与超时 |
| SSC | STATIC_OBJECT_DIC | organization | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | ESC_EEPROM_ACCESS_SUPPORT | feature | 能力开关本身不是事件；关系图说明启用条件。 |
| SSC | HW_ACCESS_FILE | include | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | MEMORY_UNIT_16BIT | access-model | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | ESC_16BIT_ACCESS | access-model | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | ESC_32BIT_ACCESS | access-model | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | MBX_16BIT_ACCESS | access-model | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | UC_SET_ECAT_LED | hardware-owner | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | ESC_SUPPORT_ECAT_LED | hardware-owner | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | ESC_EEPROM_EMULATION | hardware-owner | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | CREATE_EEPROM_CONTENT | hardware-owner | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | ESC_EEPROM_SIZE | storage-size | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | BOOTSTRAPMODE_SUPPORTED | state | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | OP_PD_REQUIRED | state | AL 状态切换与等待条件 |
| SSC | PREOPTIMEOUT | timeout | AL 状态切换与等待条件 |
| SSC | SAFEOP2OPTIMEOUT | timeout | AL 状态切换与等待条件 |
| SSC | CHECK_SM_PARAM_ALIGNMENT | access-model | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | AL_EVENT_ENABLED | feature | 能力开关本身不是事件；关系图说明启用条件。 |
| SSC | DC_SUPPORTED | feature | 周期预算与数据更新 |
| SSC | ECAT_TIMER_INT | timebase | 描述本地计时入口和时基；与总线周期分开，当前用关系/说明解释。 |
| SSC | MIN_PD_CYCLE_TIME | timing | 周期预算与数据更新 |
| SSC | MAX_PD_CYCLE_TIME | timing | 周期预算与数据更新 |
| SSC | PD_OUTPUT_CALC_AND_COPY_TIME | timing | 周期预算与数据更新 |
| SSC | PD_INPUT_CALC_AND_COPY_TIME | timing | 周期预算与数据更新 |
| SSC | PD_OUTPUT_DELAY_TIME | delay | 物理 I/O 延迟描述 |
| SSC | PD_INPUT_DELAY_TIME | delay | 物理 I/O 延迟描述 |
| SSC | MIN_PD_WRITE_ADDRESS | address-range | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | DEF_PD_WRITE_ADDRESS | sm-address | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | MAX_PD_WRITE_ADDRESS | address-range | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | MIN_PD_READ_ADDRESS | address-range | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | DEF_PD_READ_ADDRESS | sm-address | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | MAX_PD_READ_ADDRESS | address-range | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | MAX_PD_INPUT_SIZE | pdo-capacity | 三缓冲：写入、发布与读取 |
| SSC | MAX_PD_OUTPUT_SIZE | pdo-capacity | 三缓冲：写入、发布与读取 |
| SSC | MAILBOX_QUEUE | organization | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | COE_SUPPORTED | feature | 能力开关本身不是事件；关系图说明启用条件。 |
| SSC | COMPLETE_ACCESS_SUPPORTED | feature | 能力开关本身不是事件；关系图说明启用条件。 |
| SSC | SEGMENTED_SDO_SUPPORTED | feature | 能力开关本身不是事件；关系图说明启用条件。 |
| SSC | SDO_RES_INTERFACE | feature | SDO 请求与异步回调 |
| SSC | BACKUP_PARAMETER_SUPPORTED | persistence | 存储触发、延期与写入完成依固件策略；保留配置/回调关系，不虚构 Flash 时序。 |
| SSC | STORE_BACKUP_PARAMETER_IMMEDIATELY | persistence | 存储触发、延期与写入完成依固件策略；保留配置/回调关系，不虚构 Flash 时序。 |
| SSC | FOE_SUPPORTED | feature | 能力开关本身不是事件；关系图说明启用条件。 |
| SSC | DIAGNOSIS_SUPPORTED | diagnostics | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | EMERGENCY_SUPPORTED | diagnostics | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | AOE_SUPPORTED | feature | 能力开关本身不是事件；关系图说明启用条件。 |
| SSC | VOE_SUPPORTED | feature | 能力开关本身不是事件；关系图说明启用条件。 |
| SSC | SOE_SUPPORTED | feature | 能力开关本身不是事件；关系图说明启用条件。 |
| SSC | EOE_SUPPORTED | feature | 能力开关本身不是事件；关系图说明启用条件。 |
| SSC | STATIC_ETHERNET_BUFFER | organization | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | DEF_MBX_WRITE_ADDRESS | sm-address | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | DEF_MBX_READ_ADDRESS | sm-address | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | DEF_MBX_SIZE | mailbox-capacity | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| SSC | MAX_MBX_SIZE | mailbox-capacity | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| APP | Index | object-address | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| APP | ObjectCode | object-shape | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| APP | SI / SubIndex | object-address | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| APP | DataType | data-type | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| APP | Name | metadata | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| APP | Default Value | initial-value | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| APP | Min Value / Max Value | range | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| APP | M/O/C | selection | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| APP | B/S | persistence | 存储触发、延期与写入完成依固件策略；保留配置/回调关系，不虚构 Flash 时序。 |
| APP | Access | permissions | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| APP | rx/tx | pdo-direction | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| APP | CoeRead | callback | SDO 请求与异步回调 |
| APP | CoeWrite | callback | SDO 请求与异步回调 |
| APP | Description | metadata | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| APP | Padding / Bit alignment | alignment | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| APP | Modular device / Index distance | module-address | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | EtherCATInfo | xml-structure | 按 XML 包含与引用查阅，无固有时间轴。 |
| ESI | Vendor / Id | identity | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | Groups / GroupType | metadata | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | Devices / Device | xml-structure | 按 XML 包含与引用查阅，无固有时间轴。 |
| ESI | Type / ProductCode / RevisionNo | identity | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | Name | identity | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | Fmmu | logical-map | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | Sm | sm-structure | 三缓冲：写入、发布与读取 |
| ESI | Sm / ControlByte | bitfield | 三缓冲：写入、发布与读取 |
| ESI | Mailbox | feature | 能力开关本身不是事件；关系图说明启用条件。 |
| ESI | Mailbox / CoE | feature | 能力开关本身不是事件；关系图说明启用条件。 |
| ESI | CoE / PdoAssign | pdo-download | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | CoE / PdoConfig | pdo-download | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | RxPdo | pdo-direction | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | TxPdo | pdo-direction | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | PDO / Entry | mapping-code | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | PDO / Fixed / Mandatory / Sm | selection | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | Dc / OpMode | sync-mode | 周期预算与数据更新 |
| ESI | AssignActivate | bitfield | 周期预算与数据更新 |
| ESI | Profile / Dictionary | xml-structure | 按 XML 包含与引用查阅，无固有时间轴。 |
| ESI | Dictionary / DataTypes | data-type | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | Dictionary / Objects | xml-structure | 按 XML 包含与引用查阅，无固有时间轴。 |
| ESI | Slots / Slot / ModuleIdent | module-address | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | Modules / Module | module-address | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | SlotIndexIncrement / SlotPdoIncrement | module-address | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | Eeprom / SII | storage-size | 静态值、结构、位域或引用；按对应数据模型查阅。 |
| ESI | Eeprom / ConfigData | hardware-owner | 静态值、结构、位域或引用；按对应数据模型查阅。 |

ESI 节点另按实际 XML 字段提供入口：Sm→三缓冲、ControlByte→看门狗、Dc/OpMode→周期预算、CoE→SDO、Profile 402→PDS 逻辑步骤。APP CoeRead/CoeWrite 字段可直接打开回调演示。

身份、地址、数据类型、访问值及非时序结构不强行画图。AL 超时、周期、SDO、看门狗等分别建模。硬件定时图与缓冲/PDS逻辑步骤的坐标单位不同。