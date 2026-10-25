// Field definitions and documented rules. These are NOT paired project occurrences.
const SSC={title:'Beckhoff ET9300 · SSC V1.10',url:'https://download.beckhoff.com/download/Document/io/ethercat-development-products/an_et9300_v1i10.pdf'}
const ESC={title:'Beckhoff ESC · Technology V2.5',url:'https://download.beckhoff.com/download/document/io/ethercat-development-products/ethercat_esc_datasheet_sec1_technology_v2.5.pdf'}
const field=(id,surface,title,path,entryId)=>({id,surface,title,path,entryId,role:'definition'})
const link=(source,target,kind,label,condition)=>({source,target,kind,label,condition})
const contract=(id,title,summary,fields,relations,entryIds,extra={})=>({id,title,summary,fields,relations,entryIds,evidence:[SSC],versionScope:'SSC V1.10 / 对应 ESC 与 ESI 版本需核对',...extra})
export const relationTypes={generate:'参与生成',initialize:'初始化',reference:'引用',constrain:'约束',derive:'计算',describe:'概念对应'}
export const crossSourceContracts=[
  contract('identity','设备身份','SSC 身份配置、ESI 匹配信息和 CoE Identity 需要一致；它们的作用和位置分别保留。',[
    field('ssc','SSC','Vendor / Product / Revision / Serial','SlaveInformation › Identity','coe-identity'),
    field('vendor','ESI','Vendor ID','EtherCATInfo › Vendor › Id','esi-vendor'),
    field('type','ESI','ProductCode / RevisionNo','Descriptions › Devices › Device › Type','esi-type'),
  ],[link('ssc','vendor','generate','厂商身份描述','同一 SSC 工程生成 ESI 时核对；当前未绑定工程。'),link('ssc','type','generate','设备匹配描述','按选中 Device / Revision 核对，不跨设备混合。')],['coe-identity','esi-vendor','esi-type','esi-device']),
  contract('address','对象地址与成员引用','Index 和 SubIndex 是不同字段；工作表成员继承对象头索引，PDO Entry 再引用这一地址。',[
    field('app-index','APP','B · Index','应用工作表 › 对象头 › Index','xlsx-index'),
    field('app-si','APP','D · SI','应用工作表 › 对象成员 › SI','xlsx-si'),
    field('xml-object','ESI','Object / Index · SubItem / SubIdx','Device 或 Module › Profile › Dictionary','esi-objects'),
    field('entry','ESI','Entry / Index + SubIndex','Device 或 Module › RxPdo / TxPdo › Entry','esi-entry'),
  ],[link('app-index','xml-object','generate','对象定义地址','同一生成链；成员行空 Index 继承其对象头，不能补 0。'),link('app-si','xml-object','generate','显式成员子索引','需区分显式成员、数组集合和自动生成 :00。'),link('entry','xml-object','reference','Index + SI 引用','仅在当前 Device / Module 内解析；模板地址与实例地址分开。')],['xlsx-index','xlsx-si','esi-entry','esi-objects','esi-dictionary']),
  contract('types','类型、结构与位布局','应用表的协议类型参与生成字典类型与映射位宽；本地 C 内存、字典 BitOffs、PDO 位偏移分别计算。',[
    field('app-code','APP','C · ObjectCode','对象头 › VARIABLE / ARRAY / RECORD','xlsx-object-code'),
    field('app-type','APP','E · DataType / Padding','对象或成员 › 协议类型与填充','xlsx-data-type'),
    field('xml-type','ESI','DataType / SubItem','Profile › Dictionary › DataTypes','esi-datatypes'),
    field('xml-entry','ESI','Entry / DataType + BitLen','RxPdo / TxPdo › Entry','esi-entry'),
    field('ssc-memory','SSC','MEMORY_UNIT_16BIT','Hardware › MCU 本地内存模型','memory-unit-16bit'),
  ],[link('app-code','xml-type','derive','合成对象类型','结合成员类型和对象种类；不把 RECORD 名字当作基础类型。'),link('app-type','xml-type','generate','类型/成员描述','UINT16 等工作表语法须按生成器转换，不要求原文字符串相同。'),link('app-type','xml-entry','derive','协议位宽','只有被选入映射的成员才参与该 PDO；不使用 sizeof 推算。'),link('ssc-memory','xml-type','describe','本地布局单独核对','MCU 寻址单位不等于协议 octet；不把 BitOffs 当 PDO offset。')],['xlsx-data-type','xlsx-object-code','xlsx-padding','memory-unit-16bit','esi-datatypes']),
  ...['output','input'].map(direction=>{const output=direction==='output';return contract(`pdo-${direction}`,output?'输出 PDO 与容量':'输入 PDO 与容量','可映射方向、可用 PDO、活动分配和容量上限是不同层次。',[
    field('app','APP',output?'M · rx + E · DataType':'M · tx + E · DataType','成员 › rx/tx 可映射性、协议位宽','xlsx-rx-tx'),
    field('pdo','ESI',output?'RxPdo / Entry':'TxPdo / Entry',`Device 或 Module › ${output?'RxPdo':'TxPdo'}`,output?'esi-rxpdo':'esi-txpdo'),
    field('ssc','SSC',output?'MAX_PD_OUTPUT_SIZE':'MAX_PD_INPUT_SIZE',`Application › ProcessData › ${output?'输出':'输入'}容量`,output?'max-pd-output-size':'max-pd-input-size'),
    field('sm','ESI',output?'Sm[Outputs]':'Sm[Inputs]','Device › Sm › 默认分配与长度','esi-sm'),
  ],[link('app','pdo','generate','候选映射描述','rx/tx 是可映射性，不能据此断言已经进入活动 PDO。'),link('pdo','ssc','constrain','活动长度 ≤ 容量','L=ceil(Σ活动 Entry.BitLen/8)，单位 Byte；不可把所有备选 PDO 相加。'),link('pdo','sm','reference','默认 Sm 归属','Sm 属性表示默认分配；最终活动分配还需核对主站/固件配置。')],[output?'max-pd-output-size':'max-pd-input-size',output?'esi-rxpdo':'esi-txpdo','xlsx-rx-tx','esi-sm'],{formula:'L = ceil(Σ 活动 Entry.BitLen / 8)；L ≤ MAX_PD_*_SIZE'})}),
  contract('access','对象访问权限','SDO 权限、PDO 可映射方向和状态条件分别声明。',[
    field('app','APP','L · Access','对象头或成员 › Access','xlsx-access'),
    field('xml','ESI','Flags / Access','Dictionary › Object 或 DataType › SubItem','esi-objects'),
    field('ssc','SSC','COE_SUPPORTED','Mailbox › CoE 支持','coe-supported'),
  ],[link('app','xml','generate','对象/成员权限描述','头行和成员权限独立；rwop 等状态权限需结合生成属性与固件核对。'),link('ssc','xml','constrain','固件实现应支持访问','ESI 声明权限不会生成实际对象回调；ro/rw 不自动决定 rx/tx。')],['xlsx-access','esi-coe']),
  contract('modules','模块模板、槽位和步长','基础表给实际步长，模块表声明依赖；ESI 的对象、PDO 和 Entry 索引分开展开。',[
    field('base','APP','基础表 IndexIncrement / PdoIndexIncrement','基础设备表头 › 索引步长','xlsx-modular'),
    field('module','APP','Module Ident / 模块依赖设置','模块表头 › 模块标识与增量字段','xlsx-modular'),
    field('slots','ESI','Slots / Slot / ModuleIdent','Device › Slots › 允许/默认选择','esi-slots'),
    field('index','ESI','Index / @DependOnSlot','Modules › Module › Object / PDO / Entry','esi-slot-increments'),
  ],[link('base','slots','generate','提供实际步长','Slot 可覆盖 Slots 步长；显式 0 与未声明不同。'),link('module','slots','reference','按 ModuleIdent 选择','允许类型、Default、Min/MaxInstances 分别处理。'),link('module','index','generate','设置索引依赖','属性在 Index 元素上；模块表中的非零增量用于声明依赖。'),link('slots','index','derive','按实例号展开','对象/Entry 用 SlotIndexIncrement，PDO 用 SlotPdoIncrement；组与重复实例另核对。')],['xlsx-modular','esi-slots','esi-modules','esi-slot-increments'],{formula:'对象/Entry: I = I₀ + k×IndexIncrement；PDO: P = P₀ + k×PdoIncrement，仅对相应依赖生效。'}),
  contract('profile','Profile 与设备组织','设备 Profile 是功能约定；是否有 Slots / Modules 是独立维度。',[
    field('app','APP','Device Profile','应用或基础设备工作表 › 表头','xlsx-modular'),
    field('xml','ESI','Profile / ProfileNo','Device › Profile','esi-device'),
    field('modules','ESI','Slots / Modules','Device 槽位与全局模块模板库','esi-slots'),
  ],[link('app','xml','generate','Profile 功能描述','402 驱动与 5001 的功能解释不同，不按 6xxx 一律判断输入。'),link('xml','modules','describe','独立的组织维度','单体/多模块/逻辑模块不由 ProfileNo 单独决定；多 Device 也不等于多轴。')],['esi-device']),
  contract('coe','邮箱能力与对象回调','SSC 实现协议，ESI 描述能力；应用对象回调是处理入口，XML 能力声明不会代替实现。',[
    field('ssc','SSC','COE_SUPPORTED / COMPLETE_ACCESS_SUPPORTED','Mailbox › CoE 能力开关','coe-supported'),
    field('xml','ESI','Mailbox / CoE','Device › Mailbox › 协议能力属性','esi-coe'),
    field('callbacks','APP','N · CoeRead / O · CoeWrite','对象或成员 › SDO 回调','xlsx-coe-write'),
    field('async','SSC','SDO_RES_INTERFACE','Mailbox › SDO 响应接口','sdo-res-interface'),
  ],[link('ssc','xml','constrain','声明与实现一致','PdoAssign、PdoConfig、SdoInfo、CompleteAccess 各自核对，不从 COE_SUPPORTED 推导全部为 1。'),link('callbacks','async','describe','访问处理与响应机制','普通对象回调不必然是异步；只有返回挂起并实现相应接口才使用异步推进。'),link('callbacks','xml','describe','应用对象的访问实现','回调函数名不是 ESI 对象标识，也不是 PDO 映射内容。')],['coe-supported','complete-access-supported','sdo-res-interface','xlsx-coe-read','xlsx-coe-write','esi-coe','esi-pdoassign','esi-pdoconfig','esi-mailbox']),
  contract('watchdog','看门狗触发与 SSC 处理','ESI SM 允许触发过程数据看门狗，SSC 宏选择处理路径，PDI 访问是另一条链路。',[
    field('xml','ESI','Sm / ControlByte · bit 6','Device › Sm[Outputs] › Watchdog Trigger Enable','esi-control-byte'),
    field('ssc','SSC','ESC_SM_WD_SUPPORTED','Generic › 过程数据看门狗实现方式','esc-sm-wd-supported'),
    field('register','ESC','0x0400 / 0x0420 / 0x0440','Divider / SM Count / SM Status','esc-sm-wd-supported'),
  ],[link('xml','register','constrain','允许有效 SM 写入刷新','一个过程数据看门狗服务相关 SM；具体触发规则看 ESC。'),link('ssc','register','describe','1 检查硬件状态 / 0 软件计时','此宏不选择 0x0410 PDI 看门狗；PDI 有自己的计数与触发。')],['esc-sm-wd-supported','esi-control-byte'],{evidence:[SSC,ESC]}),
  contract('synchronisation','同步能力、测量值与 DC 周期','SSC 时间描述初始化同步参数；ESI 的 DC 工作方式描述主站如何设置同步，二者分别核对。',[
    field('fixed','SSC','MIN_PD_CYCLE_TIME / 计算拷贝时间','Synchronisation › 固定值或运行测量分支','min-pd-cycle-time'),
    field('coe','CoE','0x1C32 / 0x1C33','同步参数 › :05 最小周期 / :06 计算拷贝 / :09 延迟','sync-parameters'),
    field('ssc','SSC','DC_SUPPORTED','Synchronisation › DC 能力','dc-supported'),
    field('dc','ESI','Dc / OpMode','Device › Dc › AssignActivate / CycleTimeSync0','esi-dc'),
  ],[link('fixed','coe','initialize','初始化对应同步子项','固定值按宏的语义与单位写入特定 SI；部分宏 0 选择运行测量，DelayTime 的 0 保持描述值。'),link('ssc','dc','constrain','同步能力应一致','DC 工作方式需要 ESC、固件、主站共同支持；并非只添加 XML 即生效。'),link('coe','dc','describe','按同步模式共同查阅','CoE 最小周期不是 ESI SYNC0 周期，不能当作同值字段直接复制。')],['min-pd-cycle-time','max-pd-cycle-time','pd-output-calc-and-copy-time','pd-input-calc-and-copy-time','pd-output-delay-time','pd-input-delay-time','dc-supported','esi-dc','esi-assign-activate']),
]
