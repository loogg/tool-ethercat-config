import { attr, esiBool, esiNumber } from '../lib/esi-model.js'

const SSC={title:'Beckhoff ET9300 V1.10 · 应用与模块描述',url:'https://download.beckhoff.com/download/Document/io/ethercat-development-products/an_et9300_v1i10.pdf'}
const GUIDE={title:'ETG.2200 · EtherCAT Implementation Guide',url:'https://www.ethercat.org/download/documents/ETG2200_V3i2i2_G_R_EtherCATImplementationGuide.pdf'}
const ESC={title:'Beckhoff ESC · Register description',url:'https://download.beckhoff.com/download/document/io/ethercat-development-products/ethercat_esc_datasheet_sec2_registers_v3.3.pdf'}
const rule=(title,meaning,syntax,examples,extra={})=>({title,meaning,syntax,examples,references:[SSC,GUIDE],...extra})
const unsigned=(title,meaning,max=65535,extra={})=>rule(title,meaning,`非负十进制或 #x 十六进制 · 0–${max}`,['0',String(Math.min(max,16)),'#x'+Math.min(max,16).toString(16).toUpperCase()],{kind:'unsigned',max,...extra})
const boolean=(title,meaning,extra={})=>rule(title,meaning,'XML boolean · 区分大小写',['0','1','false','true'],{kind:'boolean',...extra})
const common={
  EtherCATInfo:rule('ESI 文档根','包含厂商、设备与可选模块模板。一个文件可以包含多个 Device。','元素结构',['Vendor','Descriptions']),
  Vendor:rule('厂商作用域','厂商信息属于文档，设备信息属于所选 Device。','Id 与 Name',['<Id>#x00000000</Id>']),
  Descriptions:rule('描述集合','Groups 用于分类；Devices 描述设备；Modules 保存可选模板。','结构节点',['Groups','Devices','Modules']),
  Devices:rule('设备集合','切换 Device 后，字典、PDO、SM 与 DC 重新限定到所选设备。','一个或多个 Device',['Device']),
  Device:rule('设备 / 修订作用域','主站按厂商、ProductCode、RevisionNo 等信息匹配设备；多个 Device 不是多个轴。','Type、Name、通信与 Profile 等子结构',['Type','Profile','Sm','RxPdo','TxPdo']),
  Profile:rule('设备 Profile','功能约定层，与是否采用 Slots / Modules 是两个维度。402 面向驱动；5001 与 MDP 相关。','ProfileNo 与可选 Dictionary',['<ProfileNo>402</ProfileNo>','<ProfileNo>5001</ProfileNo>']),
  ProfileNo:unsigned('Profile 编号','先按 Profile 选择解释规则，再分析对象；不根据 6xxx 地址统一判断输入方向。',65535),
  Sm:rule('SyncManager 描述','声明默认地址、大小、模式和触发能力。按 Sm 元素顺序定位；最终硬件行为还需核对 ESC。','文本标识与属性',['MBoxOut','MBoxIn','Outputs','Inputs'],{lesson:'buffer',entryId:'esi-sm'}),
  Fmmu:rule('FMMU 用途','描述逻辑到物理地址映射所用的 FMMU 类型；不是 PDO 字典条目。','用途标识',['Outputs','Inputs','MBoxState'],{entryId:'esi-fmmu'}),
  Mailbox:rule('邮箱协议能力','声明设备实际支持的邮箱协议；单独添加 XML 不会实现固件协议。','协议子元素',['CoE','FoE','EoE'],{entryId:'esi-mailbox'}),
  CoE:rule('CANopen over EtherCAT','SDO 信息、PDO 分配与映射可配置能力分别声明。','能力属性',['SdoInfo','PdoAssign','PdoConfig','CompleteAccess'],{lesson:'sdo',entryId:'esi-coe'}),
  Dictionary:rule('对象字典描述','DataTypes 定义类型布局；Objects 实例引用类型。只连接同一设备或模板中的定义。','DataTypes 与 Objects',['DataTypes','Objects'],{entryId:'esi-dictionary'}),
  DataTypes:rule('类型定义集合','类型布局与对象实例分开；BitOffs 属于字典类型布局，不等于 PDO 位偏移。','DataType 列表',['USINT','UINT','DT6000'],{entryId:'esi-datatypes'}),
  DataType:rule('字典数据类型','Name 被对象 Type 引用。结构的 SubItem 可含显式 SubIdx；未显式展开的数组保持原文。','Name、BitSize、可选 SubItem / ArrayInfo',['Name','BitSize','SubItem','ArrayInfo'],{entryId:'esi-datatypes'}),
  Objects:rule('对象实例集合','Index + SubIndex 定位对象和成员，成员布局来自当前作用域中的 DataType。','Object 列表',['Object'],{entryId:'esi-objects'}),
  Object:rule('字典对象','对象 Index 与 Type 关联类型定义，访问与映射能力仍须由固件实现。','Index、Name、Type、BitSize 等',['Index','Type','Flags'],{entryId:'esi-objects'}),
  SubItem:rule('类型成员','SubIdx 是字典成员子索引；BitOffs 是类型内偏移。不要与 PDO Entry 的 SubIndex / 连续位偏移混淆。','显式成员或数组集合',['SubIdx','Type','BitSize','BitOffs']),
  RxPdo:rule('RxPDO · 从站接收','数据从主站输出，进入从站。列表展示的是可用描述，不能把所有备选 PDO 视作同时活动。','Index、Name、Entry 与可选约束',['Index','Entry','Exclude'],{entryId:'esi-rxpdo'}),
  TxPdo:rule('TxPDO · 从站发送','数据从从站输入方向回到主站。方向按 PDO 描述确认，不能按地址前缀推断。','Index、Name、Entry 与可选约束',['Index','Entry','Exclude'],{entryId:'esi-txpdo'}),
  Entry:rule('PDO 映射项','Index / SubIndex 引用字典；BitLen 决定本 PDO 中的连续位占用。Index=0 表示填充位。','Index、SubIndex、BitLen、Name、DataType',['<Index>#x6040</Index>','<SubIndex>0</SubIndex>','<BitLen>16</BitLen>'],{entryId:'esi-entry'}),
  Index:unsigned('16 bit 对象 / PDO 索引','Index 高低字节组成一个 16 bit 索引；SubIndex 是独立字段。模板偏移属性写在 Index 元素上。',65535,{entryId:'esi-entry'}),
  SubIndex:unsigned('PDO 项的子索引','选择被映射对象的成员；不会作为 Index 的低字节。',255),
  SubIdx:unsigned('字典类型成员子索引','与 PDO 的 SubIndex 对应；缺失时保留类型集合，不擅自编造 SI。',255),
  BitLen:unsigned('PDO 映射位宽','按同一 PDO 的 Entry 顺序连续累积；没有自动插入对齐填充。',255),
  BitSize:unsigned('字典位宽','属于字典对象或类型描述，不自动等于 SSC 内存跨度或 ESC 三缓冲占用。',4294967295),
  BitOffs:unsigned('字典类型位偏移','描述 SubItem 在类型内的位置；不能直接当 PDO 流的位偏移。',4294967295),
  Dc:rule('分布式时钟模式集合','OpMode 是同步工作方式；不同于 CiA402 对象 0x6060 的驱动运行模式。','OpMode 列表',['OpMode'],{lesson:'cycle',entryId:'esi-dc'}),
  OpMode:rule('DC 同步方式','包含激活字、周期和相位描述。实际执行顺序由固件和同步配置决定。','Name、AssignActivate、周期和相位等',['AssignActivate','CycleTimeSync0','ShiftTimeSync0'],{lesson:'cycle',entryId:'esi-dc'}),
  AssignActivate:unsigned('DC 激活字','声明主站写入的同步激活相关位，需与 ESC 能力、SSC 同步实现一致。',65535,{lesson:'cycle',entryId:'esi-assign-activate'}),
  CycleTimeSync0:rule('SYNC0 周期描述','文本值与 Factor 等属性一起解释。0 不能在没有上下文时被理解为无时钟。','周期值 / Factor 语义依模式与版本',['0','1000000'],{lesson:'cycle'}),
  ShiftTimeSync0:rule('SYNC0 相位偏移','相对参考时刻的偏移，可为有符号数；需结合选定模式。','有符号十进制时间值',['0','-100000','100000'],{lesson:'cycle'}),
  Slots:rule('槽位集合','允许模块、默认选择、重复数量和索引步长属于不同字段。模板不是已安装实例。','Slot 与步长属性',['Slot','SlotIndexIncrement','SlotPdoIncrement'],{entryId:'esi-slots'}),
  Slot:rule('一个槽位描述','ModuleIdent 列出允许模板，Default 指定默认选择；Min/MaxInstances 描述实例数量约束。','Name / ModuleIdent 或版本支持的分类结构',['ModuleIdent','MinInstances','MaxInstances'],{entryId:'esi-slots'}),
  Modules:rule('模块模板库','每个 Module 拥有自己的字典与 PDO，不能混入 Device 本体字典。','Module 列表',['Module'],{entryId:'esi-modules'}),
  Module:rule('模块模板','ModuleIdent 匹配 Slot 的候选项。实例地址只在规则与实例号确定后预览。','Type、Name、Profile、PDO 等',['Type','Profile','RxPdo','TxPdo'],{entryId:'esi-modules'}),
  ModuleIdent:unsigned('模块标识','Slot 内是允许安装的类型；Default 属性属于此元素。标识与对象索引是不同概念。',4294967295),
  Eeprom:rule('SII / EEPROM 内容描述','XML 设备描述与 EEPROM/SII 是不同载体。配置字节须按 ESC 型号核对。','大小、配置数据等',['ByteSize','ConfigData'],{entryId:'esi-eeprom'}),
  ConfigData:rule('ESC 配置字节序列','逐字节数据，不能把所有字节串作为普通整数解读。具体位含义依 ESC。','偶数个十六进制字符',['8000000000000000000000000000'],{entryId:'esi-configdata'}),
  Access:rule('对象访问权限','权限、状态条件与固件回调都可能影响实际访问。','基础权限值',['ro','rw','wo'],{kind:'enum'}),
  PdoMapping:rule('对象可映射方向','声明类型/对象是否可用于接收或发送 PDO，不代表已经分配进活动 PDO。','方向标志，组合须核对版本',['R','T','RT']),
  DefaultData:rule('默认原始数据','这是 ESI 默认字节，不能当作在线读取结果。数值解码需先确认类型与字节序。','十六进制字节串',['92010200','80030000']),
}
const attributes={
  Version:rule('ESI 声明版本','记录文档声称的格式版本；不是已经通过该版本 XSD 验证。','版本字符串',['1.3','1.6']),
  ProductCode:unsigned('产品码','与 VendorId、RevisionNo 一起用于设备匹配。',4294967295,{entryId:'esi-type'}),
  RevisionNo:unsigned('修订号','同产品不同修订可能有不同字典、PDO 和 SM 配置。',4294967295,{entryId:'esi-type'}),
  ModuleIdent:unsigned('模块模板标识','Module / Type 的标识与 Slot / ModuleIdent 的允许值匹配。',4294967295,{entryId:'esi-modules'}),
  StartAddress:unsigned('SM 默认起始地址','ESC RAM 字节地址；完整物理占用还需考虑缓冲模式和内部处理字宽。',65535),
  DefaultSize:unsigned('默认 SM 长度','单个 SM 的可见长度，单位 Byte。三缓冲物理存储另算。',65535,{lesson:'buffer'}),
  MinSize:unsigned('最小 SM 长度','允许的长度下界；不是无条件生效的当前长度。',65535),
  MaxSize:unsigned('最大 SM 长度','允许的长度上界；不要把它当活动 PDO 长度。',65535),
  ControlByte:unsigned('SM 控制字节','bits 1:0 模式、3:2 方向；bit6 允许触发过程数据看门狗。其它位按 ESC 核对。',255,{lesson:'watchdog',entryId:'esi-control-byte',references:[ESC,SSC]}),
  Enable:boolean('默认 SM 启用声明','还需结合主站配置和 ESC 激活状态。'),
  SdoInfo:boolean('SDO Info 能力','主站可查询对象字典描述；固件必须实际支持。',{lesson:'sdo'}),
  PdoAssign:boolean('PDO 分配可配置能力','影响分配对象 0x1C12 / 0x1C13；不等于修改映射内容。',{entryId:'esi-pdoassign'}),
  PdoConfig:boolean('PDO 映射可配置能力','影响 0x160x / 0x1A0x 的映射内容修改。',{entryId:'esi-pdoconfig'}),
  CompleteAccess:boolean('Complete Access 能力','按一个服务访问多个子项；访问权限与布局约束仍需检查。'),
  Fixed:boolean('固定 PDO 内容','约束映射内容，独立于 Mandatory 与默认 Sm 分配。',{entryId:'esi-pdo-flags'}),
  Mandatory:boolean('必选 PDO','是否必须纳入配置；不表示所有备选 PDO 都应活动。',{entryId:'esi-pdo-flags'}),
  Sm:unsigned('默认分配的 SM 序号','存在时表示默认归属；最终活动分配由有效配置决定。',255),
  DependOnSlot:boolean('按槽位实例偏移 Index','对象 / Entry 的 Index 使用 SlotIndexIncrement；PDO 的 Index 使用 SlotPdoIncrement。',{entryId:'esi-slot-increments'}),
  DependOnSlotGroup:boolean('按槽位组偏移 Index','使用组实例号与对应 Group 步长，不能当普通 Slot 展开。'),
  SlotIndexIncrement:unsigned('对象索引步长','仅用于声明 DependOnSlot 的对象与 PDO Entry Index。',65535,{entryId:'esi-slot-increments'}),
  SlotPdoIncrement:unsigned('PDO 索引步长','仅用于声明 DependOnSlot 的 PDO Index；不改变 Entry 位宽。',65535,{entryId:'esi-slot-increments'}),
  Default:boolean('默认安装选择','Slot / ModuleIdent 的默认选择；缺省状态保留，不能自动补 0。'),
  MinInstances:unsigned('最少实例数量','结合 MaxInstances 与默认选择检查；允许 0 可表示可选槽位。',65535),
  MaxInstances:unsigned('最多实例数量','重复实例需要展开实例号。本工具不对未覆盖的重复/组结构猜测地址。',65535),
  LcId:unsigned('语言标识','同一个元素可有多种语言名称。',4294967295),
}
export function esiFieldRule(node,attribute){
  const parent=node?.id.split('/').at(-2)?.replace(/\[\d+\]$/,'')
  let result=attribute?attributes[attribute]:common[node?.name]
  if(node?.name==='Type')result=rule('类型 / 标识','Device / Type 用于设备身份；Object / Type 引用字典类型。必须结合父级解释。','字符串或类型引用',['Teaching_IO','UINT','DT6000'],{entryId:parent==='Device'?'esi-type':'esi-datatypes'})
  if(node?.name==='Type'&&parent==='Module')result=rule('模块类型名称','Type 文本描述模块类型，ModuleIdent 属性标识模块模板；槽位按标识引用允许的模板。','名称字符串与 ModuleIdent 属性',['Digital_Input','Digital_Output'],{entryId:'esi-modules'})
  if(node?.name==='Id'&&parent==='Vendor')result=unsigned('Vendor ID','厂商标识，不以项目示例代替真实分配的 ID。',4294967295,{entryId:'esi-vendor'})
  if(node?.name==='Name')result=rule('显示名称','保留 LcId 语言属性，名称不等于对象索引或设备匹配身份。','文本',['Digital inputs','Axis 1'],{entryId:'esi-name'})
  if(node?.name==='DataType'&&parent==='Entry')result=rule('PDO 基础数据类型','解释这一条映射的值类型，BitLen 决定实际位占用。此处不是 Dictionary / DataTypes 中的类型定义。','基础类型名称，需匹配位宽与所用版本',['BOOL','USINT','UINT','UDINT','SINT','INT','DINT'],{entryId:'esi-entry'})
  return result?{...result,covered:true,scope:'公开资料字段参考；已核对本地 ESI Schema 1.3 相关结构。未执行完整 XSD 验证。'}:{title:attribute?`@${attribute}`:node?.name||'XML 节点',meaning:'当前规则库尚未覆盖此字段；保留 XML 原文和结构，供按文档版本查阅。',syntax:'未收录规则',examples:[],references:[GUIDE],covered:false,scope:'未知字段不代表 XML 错误。'}
}
export function checkEsiField(node,attribute){
  if(!attribute&&node?.children.length)return {state:'structure',label:`结构元素 · ${node.children.length} 个子元素`,value:null}
  const r=esiFieldRule(node,attribute),raw=attribute?attr(node,attribute):node?.value
  if(raw===undefined)return {state:'missing',label:'未显式声明',value:null}
  if(r.kind==='boolean')return {state:esiBool(raw)===null?'unparsed':'explicit',label:esiBool(raw)===null?'无法按 boolean 解读':`显式 ${esiBool(raw)?'true':'false'}`,value:esiBool(raw)}
  if(r.kind==='unsigned'){const v=esiNumber(raw);return{state:v===null||v>r.max?'unparsed':'explicit',label:v===null||v>r.max?'数值需核对':`显式 ${v}`,value:v}}
  return{state:'explicit',label:raw===''?'显式空文本':'显式值',value:raw}
}
