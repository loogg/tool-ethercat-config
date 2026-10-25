// Domain knowledge, teaching scenes and view choices stay separate from XML values.
// All examples are generic and local. No project identity or private source links.
export const learningEvidence = {
  esc: { title: 'Beckhoff ESC · Technology V2.5', url: 'https://download.beckhoff.com/download/document/io/ethercat-development-products/ethercat_esc_datasheet_sec1_technology_v2.5.pdf', scope: 'ESC功能原理；具体PDI、缓冲与DC能力按型号手册。' },
  ssc: { title: 'Beckhoff ET9300 · SSC V1.10', url: 'https://download.beckhoff.com/download/Document/io/ethercat-development-products/an_et9300_v1i10.pdf', scope: 'SSC应用接口、对象布局、同步与生成流程。' },
  alignment: { title: 'ET9300 §7.1 / §7.2 · 对象本地布局', url: 'https://download.beckhoff.com/download/Document/io/ethercat-development-products/an_et9300_v1i10.pdf#page=61', scope: 'SSC默认对象访问层的本地内存假设；自定义访问层需另外核对。' },
  mapping: { title: 'ET9300 §13.3 · PDO Mapping / Assignment', url: 'https://download.beckhoff.com/download/Document/io/ethercat-development-products/an_et9300_v1i10.pdf#page=120', scope: 'CoE映射与SM分配；本页采用典型带邮箱从站的教学布局。' },
  led: { title: 'Novanta · EtherCAT LED signals reference', url: 'https://drives.novantamotion.com/den-safe-net/led-signals-reference', scope: '常见EtherCAT灯态与节奏示例；设备可能另有专用灯和覆盖行为。' },
  mdp: { title: 'ET9300 §6.4.1 · Modules and Slots', url: 'https://download.beckhoff.com/download/Document/io/ethercat-development-products/an_et9300_v1i10.pdf#page=48', scope: 'ETG.5001模块化设备定义；单/多实例和模块可选性分别配置。' },
  drive: { title: 'TI · CiA402 drive example', url: 'https://software-dl.ti.com/processor-industrial-sw/esd/ind_comms_sdk/am243x/latest/docs/am243x/ethercat_subdevice/example2.html', scope: '驱动控制与通信状态的分工，具体行为按设备Profile实现。' },
}

const step = (label, question, explanation, bindings = []) => ({ label, question, explanation, bindings })
export const learningTopics = [
  { id: 'roles', entryId: 'learn-roles', number: '01', title: '通信角色', question: '主站、ESC、PDI 和应用，谁在做什么？', summary: '先认清通信两端，再进入从站内部。', visual: 'roles', icon: 'Network', evidence: ['esc', 'ssc'], terms: ['master', 'slave', 'esc', 'pdi'],
    scenes: [{ id: 'roles', label: '从主站到应用', steps: [
      step('两端', '数据是谁发给谁的？', '主站组织EtherCAT通信，从站按配置接收或提供过程数据。输入/输出先看主站视角，Rx/Tx同时标明从站视角。', ['rx-tx']),
      step('ESC', '谁处理经过从站的报文？', 'ESC负责EtherCAT通信侧的数据处理。FMMU处理地址映射，SyncManager管理共享数据区的一致访问。', ['esi-sm', 'esi-fmmu']),
      step('PDI', '应用怎样访问ESC的数据？', 'PDI是过程数据接口，连接ESC与本地应用控制器。可能是SPI、并行接口或片内总线，取决于芯片。', ['hw-access']),
      step('应用', '谁把通信数据变成实际动作？', '应用读取接收的数据、执行业务，再准备发送的数据。ESC和应用控制器可以集成在同一芯片中。', ['output-copy', 'input-copy']),
    ] }] },
  { id: 'objects', entryId: 'learn-objects', number: '02', title: '对象与地址', question: '0x7000:01 是哪一种地址？', summary: '区分对象成员、ESC寄存器与本地变量。', visual: 'objects', icon: 'Boxes', evidence: ['ssc', 'alignment'], terms: ['dictionary', 'index', 'subindex', 'word'],
    scenes: [{ id: 'objects', label: '对象的三种观察角度', steps: [
      step('地址', '相似的十六进制，表示同一种位置吗？', '对象地址定位网络可访问的数据；ESC寄存器地址定位控制器资源；应用变量在本地内存中。三种地址空间各有含义。', ['object-index', 'object-si', 'esi-sm']),
      step('结构', '一个对象是单值，还是包含多个成员？', 'VARIABLE通过SI0访问单值；ARRAY组织同类型成员；RECORD允许分别定义成员。复合对象的SI0通常描述最高子索引。', ['object-code', 'object-type']),
      step('布局', '为什么协议位长与C结构体大小可能不同？', 'SSC默认本地访问层有字节/WORD布局要求；PDO则按活动映射连续累计位长。本地padding是否进入PDO，取决于映射。', ['object-type', 'padding', 'memory-unit']),
    ] }] },
  { id: 'process', entryId: 'learn-process', number: '03', title: 'SM 与 PDO', question: '一个应用成员，怎样进入过程数据？', summary: '沿方向、分配、映射与容量逐步查阅。', visual: 'process', icon: 'GitBranch', evidence: ['mapping', 'esc', 'ssc'], terms: ['pdo', 'rxpdo', 'txpdo', 'assignment', 'mapping', 'sm', 'fmmu', 'sdo'],
    scenes: [
      { id: 'pdo', label: 'PDO 引用链', steps: [
        step('方向', 'Outputs 和 RxPDO 为什么是同一个方向？', '主站的输出进入从站，因此从站把它称为RxPDO。反向则是主站输入、从站TxPDO。这里演示已选定的活动分配。', ['rx-tx', 'esi-rxpdo']),
        step('分配', '这个SM通道分配了哪一个PDO？', 'Assignment对象保存PDO Mapping对象的索引。典型输出通道SM2对应0x1C12；输入SM3对应0x1C13。', ['esi-sm', 'esi-pdoassign']),
        step('映射', 'PDO里每段数据引用哪个成员？', 'Mapping条目的32位数值编码16位Index、8位SubIndex和8位BitLength。点选成员或位段查看它的含义。', ['object-index', 'object-si', 'object-type', 'esi-entry']),
        step('容量', '选了这些成员，需要多少字节和RAM？', '先求活动映射的总位长，再向上取整为Byte；SM缓冲占用还要考虑模式、内部字宽与Length例外。容量上限单独检查。', ['output-capacity', 'input-capacity', 'esi-sm-control']),
      ] },
      { id: 'channels', label: '邮箱与过程数据', steps: [
        step('通道', '参数访问与周期数据走哪条通道？', '典型带邮箱设备用SM0/1交换邮箱消息，用SM2/3管理过程数据。这是教学分配，实际编号按设备声明。', ['esi-sm', 'esi-mailbox']),
        step('访问', 'SDO怎样读到一个参数？', 'CoE的SDO服务通过邮箱携带对象Index/SubIndex进行访问，适合参数与诊断；PDO按已经确定的映射交换过程数据。', ['coe', 'object-access', 'esi-coe']),
        step('一致性', '两侧速度不一样，怎样读到完整的一份数据？', 'Mailbox采用握手交接，过程数据可使用缓冲交接。SM负责一致访问；具体模式与控制位以硬件和组态为准。', ['esi-sm-control', 'output-capacity']),
      ] },
      { id: 'fmmu', label: 'FMMU 地址映射', steps: [
        step('逻辑地址', '主站的过程映像怎样找到从站内存？', 'FMMU把EtherCAT逻辑地址区间映射到ESC物理内存，可处理位级起止位置。对象字典索引是另一个地址空间。', ['esi-fmmu']),
        step('本地范围', 'FMMU和SM分别负责什么？', 'FMMU回答映射到哪里，SM管理相应数据区如何一致交接。它们协作，但不是同一个资源，也没有简单的编号一一相等关系。', ['esi-fmmu', 'esi-sm']),
      ] },
      { id: 'buffer', label: '缓冲交接', steps: [
        step('一份数据', '三缓冲是在传三份PDO吗？', '写入、读取和待交换缓冲在交接点轮换角色。目的是让一侧处理时，另一侧仍能获取一致的数据。', ['esi-sm-control']),
        step('物理占用', '为什么RAM会大于PDO长度？', '多个缓冲在ESC内占存储空间，线上一次过程数据仍按活动长度描述。Length=1有额外缓冲不使用的例外，地址范围还会按内部字宽向外取整。', ['output-capacity', 'input-capacity']),
      ] },
    ] },
  { id: 'sync', entryId: 'learn-sync', number: '04', title: '同步与事件', question: 'SYNC在发脉冲，LATCH在记录什么？', summary: '在同一时间轴上区分动作与时间戳。', visual: 'sync', icon: 'Timer', evidence: ['esc', 'ssc'], terms: ['dc', 'sync', 'latch', 'watchdog'],
    scenes: [{ id: 'sync', label: '同步输出与事件捕获', steps: [
      step('时基', '多个设备怎样使用可比较的时间？', 'DC提供分布式时钟同步机制。时钟同步、应用处理完成和物理输出生效是不同条件，应分别核对。', ['dc-support', 'esi-dc']),
      step('SYNC', '到达指定时刻，谁通知应用动作？', '主站配置周期和启动条件后，ESC按DC时间产生SYNC事件。SYNC0/SYNC1的引脚输出或内部通知由硬件配置决定。', ['esi-activate', 'min-cycle']),
      step('LATCH', '外部事件发生时，怎样知道它的原始时刻？', '外部边沿让ESC捕获DC时间戳。应用稍后获知或读取它，不会把读取时刻变成捕获时刻。', ['esi-dc', 'input-delay']),
    ] }, { id: 'modes', label: 'FreeRun / SM Sync / DC', steps: [
      step('FreeRun', 'FreeRun由什么触发应用处理？', '应用按本地主循环或定时调度运行，与EtherCAT过程数据触发没有固定相位关系；SM的一致访问和周期能力仍需满足。', ['min-cycle']),
      step('SM Sync', 'SM事件怎样与应用处理联系？', '应用按所用SM事件组织执行。事件生成、PDI通知和固件处理共同决定实际时序，不能仅凭一个中断宏判断全部行为。', ['al-event', 'output-copy', 'input-copy']),
      step('DC', '使用DC后，哪些时间仍需分别核对？', 'DC同步事件可触发应用或外设；通信周期、数据就绪、应用处理与物理延迟分别核对。选择事件图可以继续看SYNC与LATCH。', ['dc-support', 'esi-activate', 'min-cycle']),
    ] }] },
  { id: 'state', entryId: 'learn-state', number: '05', title: '状态与指示灯', question: '灯在闪，意味着通信走到了哪一步？', summary: '结合能力、灯态和错误信息判断状态。', visual: 'state', icon: 'CircleDot', evidence: ['ssc', 'esc', 'led', 'drive'], terms: ['al', 'led', 'watchdog', 'cia402'],
    scenes: [{ id: 'state', label: 'AL状态与指示灯', steps: [
      step('INIT', '设备刚开始，哪些通信还没有准备好？', 'INIT阶段初始化通信资源。此教学设备尚未开放正常邮箱与过程数据通信，RUN灯为灭。', ['esi-sm']),
      step('PREOP', '为什么能读参数，却还没有正常PDO？', '邮箱通信已可用于参数和配置，过程数据配置仍需检查。典型RUN指示为Blinking。', ['object-access', 'esi-coe']),
      step('SAFEOP', '有输入了，输出为什么仍保持安全值？', '典型设备可更新输入过程数据，输出保持安全状态；进入OP还需满足映射、同步、有效输出及应用条件。', ['op-required', 'safeop-timeout']),
      step('OP', '进入OP是否代表驱动已经使能？', 'OP说明通信层进入运行态。CiA402驱动还具有自己的控制状态机；RUN常亮也不能代替驱动状态字判断。', ['op-required', 'esi-dictionary']),
    ] }, { id: 'watchdog', label: 'PDI / SM 看门狗', steps: [
      step('触发来源', 'PDI和过程数据看门狗，分别在监视谁？', 'PDI看门狗监视规定的本地PDI访问；过程数据看门狗监视启用触发的SM访问。两侧共享Divider，但分别计数。', ['watchdog-method', 'hw-access', 'esi-sm-control']),
      step('超时条件', '停止访问以后，为什么没有立即超时？', '每次有效触发会重新计时。停止后仍需等到最后一次触发的标称期限；本地实现和故障处理按ESC与固件。', ['watchdog-method', 'esi-sm-control']),
    ] }] },
  { id: 'startup', entryId: 'learn-startup', number: '06', title: '描述与启动', question: 'ESI、SII、EEPROM和固件，各放在哪里？', summary: '沿使用方和启动关系区分文件与设备信息。', visual: 'startup', icon: 'Files', evidence: ['ssc', 'esc', 'mdp'], terms: ['esi', 'sii', 'eeprom', 'firmware', 'mdp', 'cia402'],
    scenes: [{ id: 'startup', label: '资料、设备与启动', steps: [
      step('分工', '同一台设备为什么有几份不同资料？', 'ESI供主站工程理解设备能力；SII是ESC可读取的设备信息；EEPROM是常见存储介质；固件实现应用与协议栈行为。', ['esi-eeprom', 'eeprom-content', 'esi-type']),
      step('启动', '上电后，设备信息从哪里来？', 'ESC按其支持方式加载SII，主站读取在线身份并选择匹配描述。EEPROM仿真是另一种实现，具体引导与时序按ESC/固件。', ['eeprom-emulation', 'esi-eeprom', 'identity']),
      step('Profile', '5001和402描述的是同一类功能吗？', 'ETG.5001关注模块化设备的组织；CiA402关注驱动控制行为。两种规则关注不同方面，不能仅凭“普通I/O/伺服”标签推断设备结构。', ['app-modular', 'esi-modules', 'esi-dictionary']),
    ] }] },
]

const conceptEvidence = { watchdog: ['esc', 'ssc'], led: ['led'], al: ['ssc'], cia402: ['drive', 'ssc'], mdp: ['mdp'], word: ['alignment'] }
const concept = (id, label, aliases, definition, topic, entryId, scene, stepIndex, prerequisites = [], misconception = '') => ({ id, label, aliases: [label, ...aliases], definition, topic, entryId, scene, step: stepIndex, prerequisites, misconception, evidence: conceptEvidence[id] || learningTopics.find(item => item.id === topic).evidence })
export const learningConcepts = [
  concept('master', '主站', ['Master', 'MainDevice'], '组织EtherCAT通信、配置从站，并读写过程数据的一端。', 'roles', 'learn-roles', 'roles', 0, [], '输入/输出通常以主站为参照。'),
  concept('slave', '从站', ['Slave', 'SubDevice'], '在EtherCAT网络中提供输入、输出或其他设备功能的一端。', 'roles', 'learn-roles', 'roles', 0, ['master']),
  concept('esc', 'ESC', ['EtherCAT Slave Controller'], '负责从站EtherCAT通信侧处理的控制器功能。', 'roles', 'learn-roles', 'roles', 1, ['slave'], 'ESC与应用控制器可以集成，图中的逻辑角色不一定是独立芯片。'),
  concept('pdi', 'PDI', ['过程数据接口'], 'ESC与本地应用控制器之间的接口，例如SPI、并行接口或片内总线。', 'roles', 'learn-roles', 'roles', 2, ['esc'], '具体接口类型、访问宽度和中断能力由芯片决定。'),
  concept('dictionary', '对象字典', ['Object Dictionary'], '按Index和SubIndex组织的应用数据及其类型、权限等描述。', 'objects', 'object-dictionary', 'objects', 0, [], '对象索引不等于ESC寄存器地址或MCU RAM地址。'),
  concept('index', 'Index', ['对象索引'], '对象字典中定位一个对象的16位编号，例如0x7000。', 'objects', 'object-dictionary', 'objects', 0, ['dictionary']),
  concept('subindex', 'SubIndex', ['子索引'], '对象内部的8位成员编号；VARIABLE的SI0访问单值。', 'objects', 'object-dictionary', 'objects', 1, ['index'], '复合对象SI0通常是最高子索引；不总等于有效成员数量。'),
  concept('word', 'WORD', ['字对齐', 'WORD对齐'], '16 bit的字。在SSC默认本地布局中，部分成员起点与块需要按WORD组织。', 'objects', 'object-dictionary', 'objects', 2, ['dictionary'], 'SSC本地布局规则和PDO连续位流分别核对。'),
  concept('pdo', 'PDO', ['过程数据'], '按已确定的映射组织的过程数据，适合周期交换。', 'process', 'learn-process', 'pdo', 0, ['dictionary']),
  concept('rxpdo', 'RxPDO', ['RxPdo'], '从站接收的过程数据，对应主站输出方向。', 'process', 'rxpdo', 'pdo', 0, ['pdo'], 'Rx/Tx以从站为参照，不能只看变量名Input/Output猜方向。'),
  concept('txpdo', 'TxPDO', ['TxPdo'], '从站发送的过程数据，对应主站输入方向。', 'process', 'txpdo', 'pdo', 0, ['pdo']),
  concept('assignment', 'PDO Assignment', ['Assignment', '分配表'], '记录某个SM通道分配了哪些PDO Mapping对象。', 'process', 'pdo-assignment', 'pdo', 1, ['sm', 'pdo'], '分配表保存PDO索引，具体成员由Mapping条目描述。'),
  concept('mapping', 'PDO Mapping', ['Mapping', '映射表'], '描述PDO引用哪些对象成员、各占多少bit。', 'process', 'pdo-mapping', 'pdo', 2, ['dictionary', 'pdo'], '可映射属性、候选PDO与当前活动分配是不同信息。'),
  concept('sm', 'SyncManager', ['SM'], '管理ESC内一个通信数据区的一致交接，也可产生事件或看门狗触发。', 'process', 'sm2', 'channels', 0, ['esc'], '典型SM0/1邮箱、SM2/3过程数据的编号不代表所有设备。'),
  concept('fmmu', 'FMMU', ['Fieldbus Memory Management Unit'], '把EtherCAT逻辑地址范围映射到ESC内存，支持位级映射。', 'process', 'fmmu', 'fmmu', 0, ['esc'], 'FMMU是地址映射资源，SM是数据交接资源。'),
  concept('sdo', 'SDO', ['SDO Upload', 'SDO Download'], '通过CoE邮箱服务，按对象Index/SubIndex读取或写入参数。', 'process', 'sdo', 'channels', 1, ['dictionary', 'coe']),
  concept('coe', 'CoE', ['CANopen over EtherCAT'], '在EtherCAT上使用CANopen应用层机制，例如对象字典、SDO和PDO配置。', 'process', 'sdo', 'channels', 1, ['esc'], 'SDO是服务，CoE是承载相应应用机制的协议；过程数据不必作为邮箱消息发送。'),
  concept('dc', 'DC', ['Distributed Clocks', '分布式时钟'], '同步设备的时钟，为周期触发与事件时间戳提供可比较的时基。', 'sync', 'sync-modes', 'modes', 2, ['esc']),
  concept('sync', 'SYNC', ['SYNC0', 'SYNC1'], 'ESC按DC时间产生的同步事件，可通知应用或触发外设动作。', 'sync', 'sync-latch', 'sync', 1, ['dc'], '引脚、事件通知及SYNC1用法由硬件和组态决定。'),
  concept('latch', 'LATCH', ['LATCH0', 'LATCH1'], '外部边沿到来时，在ESC中捕获DC时间戳。', 'sync', 'sync-latch', 'sync', 2, ['dc'], '捕获时刻与MCU随后读取时间戳的时刻应分别表达。'),
  concept('al', 'AL 状态', ['EtherCAT状态', 'SAFEOP', 'PREOP', 'SAFE-OP', 'PRE-OP'], '表示从站通信资源和过程数据当前处于哪一个运行阶段。', 'state', 'ethercat-state', 'state', 0, ['esc'], 'EtherCAT OP与CiA402驱动使能属于不同状态机。'),
  concept('led', 'RUN / ERR', ['RUN LED', 'ERR LED', '指示灯'], '用颜色与闪烁节奏提示通信状态或错误类别，需要结合AL状态码和设备手册。', 'state', 'learn-state', 'state', 1, ['al']),
  concept('watchdog', '看门狗', ['Watchdog', 'PDI看门狗', 'SM看门狗', '过程数据看门狗'], '监视规定的访问或数据触发是否持续，在超时后产生相应状态。', 'state', 'learn-state', 'watchdog', 0, ['pdi', 'sm'], 'PDI与过程数据看门狗有各自触发来源、计数与处理；不是判断业务数值是否正确。'),
  concept('esi', 'ESI', ['设备描述文件'], '供主站工程读取的XML设备描述，包含身份、通信资源和过程数据等能力。', 'startup', 'learn-startup', 'startup', 0, ['slave'], '静态描述、已选择的活动配置与设备当前值分别核对。'),
  concept('sii', 'SII', ['Slave Information Interface'], 'ESC提供设备信息访问的接口及相应信息内容，常由EEPROM或仿真实现提供。', 'startup', 'learn-startup', 'startup', 1, ['esc', 'esi']),
  concept('eeprom', 'EEPROM', [], '可非易失保存信息的存储介质；EtherCAT设备常用它保存SII数据。', 'startup', 'learn-startup', 'startup', 1, ['sii'], 'SII是设备信息，EEPROM是存储介质，ESI则供主站工程使用。'),
  concept('firmware', '固件', ['Firmware'], '运行在设备控制器上的程序，实现协议栈适配和应用行为。', 'startup', 'learn-startup', 'startup', 0, ['pdi']),
  concept('mdp', 'ETG.5001', ['5001', 'MDP', 'Modular Device Profile'], '模块化设备Profile，组织模块、槽位及实例的相关规则。', 'startup', 'learn-startup', 'startup', 2, ['dictionary'], '单实例也可有步长配置；模块化组织不等于必须插两个模块。'),
  concept('cia402', 'CiA402', ['CiA 402', '402'], '面向驱动与运动控制的设备Profile，包含控制字、状态字及驱动状态机等。', 'state', 'learn-state', 'state', 3, ['al', 'dictionary'], '通信进入OP之后，驱动仍需满足自己的使能条件。'),
]

const device = '/EtherCATInfo[1]/Descriptions[1]/Devices[1]/Device[1]'
const binding = (id, surface, title, path, entryId, role, route = {}, condition = '') => ({ id, surface, title, path, entryId, role, route, condition })
export const learningBindings = [
  binding('hw-access', 'SSC', 'HW_ACCESS_FILE', 'Hardware / 硬件访问适配', 'hw-access-file', '适配PDI访问'),
  binding('output-copy', 'SSC', 'PD_OUTPUT_CALC_AND_COPY_TIME', 'Synchronisation / 输出处理耗时', 'pd-output-calc-and-copy-time', '描述输出映射耗时'),
  binding('input-copy', 'SSC', 'PD_INPUT_CALC_AND_COPY_TIME', 'Synchronisation / 输入处理耗时', 'pd-input-calc-and-copy-time', '描述输入映射耗时'),
  binding('memory-unit', 'SSC', 'MEMORY_UNIT_16BIT', 'Hardware / MCU寻址单位', 'memory-unit-16bit', '本地访问移植条件'),
  binding('output-capacity', 'SSC', 'MAX_PD_OUTPUT_SIZE', 'Application / ProcessData / 输出容量', 'max-pd-output-size', '约束活动RxPDO长度'),
  binding('input-capacity', 'SSC', 'MAX_PD_INPUT_SIZE', 'Application / ProcessData / 输入容量', 'max-pd-input-size', '约束活动TxPDO长度'),
  binding('object-index', 'APP', 'B · Index', 'Profile / 对象字典 / B列', 'xlsx-index', '定义对象编号', { workbook: 'direct-io', sheet: 'Profile', field: 'B', row: '12', appPane: 'table' }),
  binding('object-si', 'APP', 'D · SI', 'Profile / 对象成员 / D列', 'xlsx-si', '定义子索引', { workbook: 'direct-io', sheet: 'Profile', field: 'D', row: '13', appPane: 'table' }),
  binding('object-code', 'APP', 'C · ObjectCode', 'Profile / 对象结构 / C列', 'xlsx-object-code', '定义对象组织', { workbook: 'direct-io', sheet: 'Profile', field: 'C', row: '12', appPane: 'table' }),
  binding('object-type', 'APP', 'E · DataType', 'Profile / 成员类型 / E列', 'xlsx-data-type', '定义协议类型', { workbook: 'direct-io', sheet: 'Profile', field: 'E', row: '13', appPane: 'table' }),
  binding('object-access', 'APP', 'L · Access', 'Profile / SDO访问权限 / L列', 'xlsx-access', '约束对象访问', { workbook: 'direct-io', sheet: 'Profile', field: 'L', row: '13', appPane: 'table' }),
  binding('rx-tx', 'APP', 'M · rx/tx', 'Profile / PDO可映射方向 / M列', 'xlsx-rx-tx', '声明可映射性', { workbook: 'direct-io', sheet: 'Profile', field: 'M', row: '18', appPane: 'table' }, '可映射性不等于已加入活动PDO。'),
  binding('padding', 'APP', 'DataType / pad_x', 'Profile / 对象成员 / 显式填充', 'xlsx-padding', '解释填充边界'),
  binding('app-modular', 'APP', 'IndexIncrement / PdoIndexIncrement', '基础设备或模块 / 表头 / 两类步长', 'xlsx-modular', '组织模块实例', { workbook: 'mdp-io', sheet: 'Profile', appPane: 'table' }),
  binding('esi-sm', 'ESI', 'Sm[Outputs]', 'Device / Sm[Outputs] / 地址与长度', 'esi-sm', '描述SM初始配置', { esi: 'io', esiNode: `${device}/Sm[3]`, esiAttr: 'DefaultSize' }),
  binding('esi-sm-control', 'ESI', 'Sm / @ControlByte', 'Device / Sm[Outputs] / 控制位', 'esi-control-byte', '描述模式与看门狗触发', { esi: 'io', esiNode: `${device}/Sm[3]`, esiAttr: 'ControlByte' }),
  binding('esi-fmmu', 'ESI', 'Fmmu', 'Device / Fmmu / 用途', 'esi-fmmu', '声明FMMU用途', { esi: 'io', esiNode: `${device}/Fmmu[1]` }),
  binding('esi-rxpdo', 'ESI', 'RxPdo', 'Device / RxPdo / 可用PDO', 'esi-rxpdo', '描述PDO与映射项', { esi: 'io', esiNode: `${device}/RxPdo[1]` }),
  binding('esi-entry', 'ESI', 'Entry / BitLen', 'Device / RxPdo / Entry / BitLen', 'esi-entry', '描述映射位宽', { esi: 'io', esiNode: `${device}/RxPdo[1]/Entry[1]/BitLen[1]` }),
  binding('esi-pdoassign', 'ESI', 'CoE / @PdoAssign', 'Device / Mailbox / CoE / 能力', 'esi-pdoassign', '声明动态分配能力'),
  binding('esi-mailbox', 'ESI', 'Mailbox', 'Device / Mailbox / 协议能力', 'esi-mailbox', '描述邮箱协议'),
  binding('esi-coe', 'ESI', 'Mailbox / CoE', 'Device / Mailbox / CoE', 'esi-coe', '描述CoE能力'),
  binding('coe', 'SSC', 'COE_SUPPORTED', 'Mailbox / CoE协议支持', 'coe-supported', '启用相应固件支持'),
  binding('mailbox-size', 'SSC', 'DEF_MBX_SIZE', 'Mailbox / 默认邮箱长度', 'def-mbx-size', '配置邮箱数据区长度'),
  binding('bootstrap', 'SSC', 'BOOTSTRAPMODE_SUPPORTED', 'EtherCAT State Machine / Bootstrap支持', 'bootstrapmode-supported', '配置升级分支支持'),
  binding('watchdog-method', 'SSC', 'ESC_SM_WD_SUPPORTED', 'Generic / 过程数据看门狗实现方式', 'esc-sm-wd-supported', '选择SSC的SM看门狗处理路径', {}, '该宏不配置PDI看门狗的完整行为。'),
  binding('dc-support', 'SSC', 'DC_SUPPORTED', 'Synchronisation / DC能力', 'dc-supported', '支持DC同步'),
  binding('al-event', 'SSC', 'AL_EVENT_ENABLED', 'Synchronisation / ESC事件处理', 'al-event-enabled', '配置事件处理支持', {}, '事件中断支持与完整同步方式分别核对。'),
  binding('min-cycle', 'SSC', 'MIN_PD_CYCLE_TIME', 'Synchronisation / 最小处理周期', 'min-pd-cycle-time', '描述处理能力', {}, '最小处理周期与SYNC0设定周期分别核对。'),
  binding('input-delay', 'SSC', 'PD_INPUT_DELAY_TIME', 'Synchronisation / 物理输入延迟', 'pd-input-delay-time', '描述相关触发到物理事件'),
  binding('esi-dc', 'ESI', 'Dc / OpMode', 'Device / Dc / 同步模式', 'esi-dc', '描述支持的同步配置'),
  binding('esi-activate', 'ESI', 'AssignActivate', 'Device / Dc / OpMode / 激活位', 'esi-assign-activate', '描述同步激活设置'),
  binding('op-required', 'SSC', 'OP_PD_REQUIRED', 'EtherCAT State Machine / OP条件', 'op-pd-required', '配置有效输出条件'),
  binding('safeop-timeout', 'SSC', 'SAFEOP2OPTIMEOUT', 'EtherCAT State Machine / 等待时限', 'safeop2optimeout', '约束状态等待'),
  binding('esi-dictionary', 'ESI', 'Profile / Dictionary', 'Device / Profile / 对象与类型', 'esi-dictionary', '描述对象接口'),
  binding('esi-type', 'ESI', 'Type / ProductCode / RevisionNo', 'Device / Type / 身份属性', 'esi-type', '参与设备匹配'),
  binding('esi-eeprom', 'ESI', 'Eeprom / ConfigData', 'Device / Eeprom / SII描述', 'esi-eeprom', '描述生成信息'),
  binding('eeprom-content', 'SSC', 'CREATE_EEPROM_CONTENT', 'Hardware / SII初始内容', 'create-eeprom-content', '配置生成条件'),
  binding('eeprom-emulation', 'SSC', 'ESC_EEPROM_EMULATION', 'Hardware / SII EEPROM仿真', 'esc-eeprom-emulation', '配置固件实现路径'),
  binding('identity', 'SSC', 'Vendor / Product / Revision / Serial', 'SlaveInformation / 设备身份', 'coe-identity', '核对描述与设备身份'),
  binding('esi-modules', 'ESI', 'Slots / Modules', 'Descriptions / 模块模板与槽位', 'esi-modules', '描述模块组织', { esi: 'modules' }),
]

export const legacyLearningTargets = {
  'object-dictionary': { topic: 'objects', scene: 'objects', step: 0 },
  'pdo-mapping': { topic: 'process', scene: 'pdo', step: 2 },
  'pdo-assignment': { topic: 'process', scene: 'pdo', step: 1 },
  rxpdo: { topic: 'process', scene: 'pdo', step: 0, direction: 'rx' },
  txpdo: { topic: 'process', scene: 'pdo', step: 0, direction: 'tx' },
  'sm-type': { topic: 'process', scene: 'channels', step: 0 },
  sm0: { topic: 'process', scene: 'channels', step: 0, channel: 0 }, sm1: { topic: 'process', scene: 'channels', step: 0, channel: 1 },
  sm2: { topic: 'process', scene: 'pdo', step: 1 }, sm3: { topic: 'process', scene: 'pdo', step: 1, direction: 'tx' },
  fmmu: { topic: 'process', scene: 'fmmu', step: 0 },
  'sync-modes': { topic: 'sync', scene: 'modes', step: 0 }, 'sync-parameters': { topic: 'sync', scene: 'sync', step: 1 },
  'sync-latch': { topic: 'sync', scene: 'sync', step: 1 },
  'ethercat-state': { topic: 'state', scene: 'state', step: 0 }, 'al-status': { topic: 'state', scene: 'state', step: 2 },
  sdo: { topic: 'process', scene: 'channels', step: 1, channel: 0 }, 'identity-object': { topic: 'startup', scene: 'startup', step: 1 },
}

export const learningEntries = [
  { id: 'learn-overview', name: '基础概念', title: '基础概念：从角色到配置', summary: '沿六个主题理解EtherCAT角色、对象、数据通路、同步、状态与启动。', collection: 'concepts', group: '', category: 'object', overview: true, nodeKind: 'overview', details: learningTopics.map(topic => topic.question), sources: [{ kind: 'ESC', path: '基础概念 / 总览' }], references: [learningEvidence.esc, learningEvidence.ssc], relations: [], aliases: ['入门', '新手', '学习', '概念总览'] },
  ...learningTopics.map(topic => ({ id: topic.entryId, name: topic.title, title: `${topic.title}：${topic.question}`, summary: topic.summary, collection: 'concepts', group: topic.id, category: ({ roles: 'hardware', objects: 'object', process: 'pdo', sync: 'sync', state: 'state', startup: 'esi' })[topic.id], nodeKind: 'concept', sources: [{ kind: 'ESC', path: `基础概念 / ${topic.title}` }], facts: [], details: topic.scenes.flatMap(scene => scene.steps.map(item => item.explanation)), rules: [], relations: [], references: topic.evidence.map(id => learningEvidence[id]), aliases: learningConcepts.filter(item => item.topic === topic.id).flatMap(item => item.aliases) })),
]

export const objectShapes = {
  VARIABLE: { index: '0x2000', name: 'SamplePeriodMs', caption: '一个单值', members: [{ si: '00', name: 'SamplePeriodMs', type: 'UINT16', value: '10', role: '变量值本身' }] },
  ARRAY: { index: '0x2001', name: 'ChannelFilterTimeMs', caption: '同类型成员', members: [{ si: '00', name: '最高子索引', type: 'UINT8', value: '3', role: '协议描述' }, ...[1, 2, 3].map(i => ({ si: `0${i}`, name: `Channel ${i}`, type: 'UINT16', value: String(i * 10), role: '业务成员' }))] },
  RECORD: { index: '0x7000', name: 'Outputs', caption: '分别定义的成员', members: [{ si: '00', name: '最高子索引', type: 'UINT8', value: '2', role: '协议描述' }, { si: '01', name: 'Command', type: 'UINT16', value: '0', role: '业务成员' }, { si: '02', name: 'Target', type: 'UINT32', value: '0', role: '业务成员' }] },
}

export const alStates = [
  { id: 'INIT', label: '初始化', run: 'off', mailbox: false, inputs: false, outputs: false },
  { id: 'PREOP', label: '预运行', run: 'blink', mailbox: true, inputs: false, outputs: false },
  { id: 'SAFEOP', label: '安全运行', run: 'single', mailbox: true, inputs: true, outputs: false },
  { id: 'OP', label: '运行', run: 'on', mailbox: true, inputs: true, outputs: true },
]
export const ledPatterns = {
  off: { label: '灭', period: 1200, pulses: [], text: '保持熄灭' },
  on: { label: '常亮', period: 1200, pulses: [[0, 1200]], text: '保持点亮' },
  blink: { label: 'Blinking · 闪烁', period: 400, pulses: [[0, 200]], text: '约200 ms亮 / 200 ms灭' },
  single: { label: 'Single flash · 单闪', period: 1200, pulses: [[0, 200]], text: '约200 ms亮 / 1000 ms灭' },
  double: { label: 'Double flash · 双闪', period: 1600, pulses: [[0, 200], [400, 600]], text: '亮200 / 灭200 / 亮200 / 灭1000 ms' },
  flicker: { label: 'Flickering · 快闪', period: 100, pulses: [[0, 50]], text: '约50 ms亮 / 50 ms灭' },
}
export const errorIndicators = [
  { id: 'none', label: '无错误', pattern: 'off', explanation: '此时没有由ERR灯报告的错误；仍需结合设备状态。' },
  { id: 'configuration', label: '配置无效', pattern: 'blink', explanation: '检查设备配置、SM与映射等，并读取原始AL Status Code。' },
  { id: 'local', label: '本地错误', pattern: 'single', explanation: '应用可因本地条件改变通信状态；需查固件、同步和AL错误信息。' },
  { id: 'watchdog', label: '过程数据看门狗超时', pattern: 'double', explanation: '检查有效过程数据触发与看门狗配置；灯态本身不定位唯一根因。' },
]
