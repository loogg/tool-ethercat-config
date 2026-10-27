// SSC settings, generated descriptions and protocol objects have separate roles.
// Names/order follow the reviewed SlaveInformation UI; no project values are stored.
const SSC={title:'Beckhoff ET9300 · SSC Application Note V1.10',url:'https://download.beckhoff.com/download/document/io/ethercat-development-products/an_et9300_v1i10.pdf',note:'SSC生成流程；字段与派生长度按所用SSC和Config.xml核对。'}
const FIELD_LIST={title:'Microchip DS70005377A · 图6-7 Slave Information Setting',url:'https://ww1.microchip.com/downloads/aemDocuments/documents/OTH/ProductDocuments/UserGuides/LAN9252-SAME54-EtherCAT-Application-Quick-StartGuide-70005377A.pdf#page=29',note:'官方SSC界面列出本组13个字段；图中数值仅属于该评估示例。'}
const LEGACY={title:'Microchip AN1920 · 图9 SSC Tool Slave Information',url:'https://ww1.microchip.com/downloads/en/AppNotes/00001920A.pdf',note:'较早界面还显示名称/版本的*_LEN；不是所有版本的统一字段清单。'}
const OBJECTS={title:'Beckhoff · Standard objects 0x1000–0x1FFF',url:'https://infosys.beckhoff.com/content/1033/ej252x/10364454539.html',note:'Device Type、名称、版本与Identity条目；该产品的5001高字为模块Profile，其他Profile另核对。'}
const DRIVE_TYPE={title:'Synapticon · 0x1000 Device Type',url:'https://doc-legacy.synapticon.com/software/41/documentation_html/object_htmls/1000/index.html',note:'16bit设备/应用Profile与另一16bit附加信息分别定义。'}
const link=(target,type,description)=>({target,type,description})
export const imageTool={title:'EtherCAT Image · SSC图标转换',url:'https://loogg.github.io/tool-ethercat-image/',description:'生成16×14、4bit BMP的完整HEX；核对当前SSC字段接受的图像格式。'}
const setting=({name,title,type,summary,facts=[],details,rules=[],relations=[],coe,esi,id,aliases=[],example,extra={}})=>({
  id:id||name.toLowerCase().replaceAll('_','-'),name,title,category:'identity',summary,
  sources:[{kind:'SSC',path:`SSC Tool → SlaveInformation → ${name}`},...(coe?[{kind:'CoE',path:coe}]:[]),...(esi?[{kind:'ESI',path:esi}]:[])],
  facts:[{label:'类型',value:type},...(coe?[{label:'CoE',value:coe}]:[]),...facts],details,rules,relations,references:[FIELD_LIST,SSC],aliases:[name,...aliases],
  ...(example?{example:{code:example,caption:'填写/对应示意；不是默认值或当前工程配置。',language:'text'}}:{}),...extra,
})

const numericIdentity=({name,title,si,meaning,esi,rules=[],example})=>setting({name,title,type:'UINT32 · 0…4294967295',summary:meaning,coe:`0x1018:${si}`,
  ...(esi?{esi}:{}),facts:[{label:'输入',value:'32bit无符号整数；十进制 / 0x十六进制'},{label:'当前工程值',value:'未载入'}],
  details:[meaning,'生成/初始化的CoE Identity、SII身份及适用的ESI匹配信息要按同一产品定义核对；仅修改查阅说明不会改变设备。'],
  rules,example,relations:[link('coe-identity','组成',`对应Identity的SI${si}；Identity对照本身不是另一个可填写参数。`),link('esi-eeprom','需一致','核对SII中的同一身份字段。'),...(esi?[link(name==='VENDOR_ID'?'esi-vendor':'esi-type','对应','核对对应ESI身份描述；不同文件不自动当作同一工程。')]:[])],extra:{references:[FIELD_LIST,SSC,OBJECTS]},
})
const imageSetting=(name,title,parent,target)=>setting({name,title,type:'生成元数据 · 完整BMP十六进制数据',summary:`设置ESI${title}，供组态工具显示；不增加过程数据，也不是CoE对象值。`,esi:`${parent}/ImageData16x14`,
  facts:[{label:'用途',value:`${title} · 目录显示`},{label:'ESI位置',value:`${parent}/ImageData16x14`},{label:'输入',value:'完整位图数据的HEX，不是图片路径或XML标签'}],
  details:[`${name}用于${parent}层级的图标；与另两个IMAGE字段分别配置，不能把厂商、分组与设备的图标位置混为一处。`,'常见目标为16×14像素的BMP数据。链接工具输出16×14、4bit未压缩BMP的完整HEX、BMP和ESI片段；当前SSC版本接受的格式仍须实际核对。'],
  rules:['SSC的HEX输入与ESI的<ImageData16x14>元素是两种写法；复制到SSC时使用工具的HEX输出，不把整个XML片段当作字段值。','图标只影响目录显示，不是设备身份匹配键，也不生成CoE条目或SII身份数据。'],
  relations:[link(target,'对应',`图标位于${parent}，查阅相应ESI层级。`)],aliases:['image',title,'BMP','16x14','ImageData16x14'],
  example:`${name}: 424D…\n填写完整BMP的HEX；省略号仅表示示意，不能直接粘贴。`,
  extra:{externalTools:[imageTool],imagePlacement:{parent,element:'ImageData16x14',width:16,height:14}},
})
const stringSetting=(name,id,title,coe,example,summary,rules,esi)=>setting({name,id,title,type:'字符串 · VISIBLE_STRING',summary,coe,esi,
  facts:[{label:'长度',value:'按实际编码字节与生成结果核对'},{label:'版本相关',value:`部分SSC界面显示${name}_LEN`}],
  details:[summary,`${name}_LEN在部分旧版本中可见；长度单位、末尾NUL与是否自动生成应对照当前工具和生成代码，不能把中文字符数直接作为字节数。`],
  rules,relations:[link('coe-identity','关联','名称/版本字符串不替代数字身份和产品接口Revision。'),...(esi?[link('esi-name','对应','核对适用的名称描述；不是产品码或修订号。')]:[])],
  aliases:[coe,title,name==='DEVICE_NAME'?'Device name':name==='DEVICE_HW_VERSION'?'Hardware version':'Software version',`${name}_LEN`],example:`${name}: ${example}`,
  extra:{references:[FIELD_LIST,SSC,LEGACY,OBJECTS]},
})

export const slaveInformationEntries=[
  numericIdentity({name:'VENDOR_ID',title:'厂商ID',si:'01',meaning:'本厂商由ETG分配的EtherCAT Vendor ID；用于识别厂商，而不是ESC芯片型号或公司名称字符串。',esi:'EtherCATInfo/Vendor/Id',rules:['使用本厂商获分配的标识；评估例子的厂商号不代表当前产品可沿用。'],example:'VENDOR_ID: 本厂商已分配的EtherCAT Vendor ID'}),
  setting({name:'VENDOR_NAME',title:'厂商名称',type:'生成元数据 · 字符串',summary:'设置ESI中的厂商显示名称，与VENDOR_ID的数字标识分别管理。',esi:'EtherCATInfo/Vendor/Name',facts:[{label:'用途',value:'ESI厂商名称显示'},{label:'不是',value:'0x1018:01的数值'}],details:['名称用于可读显示；匹配设备不能只比较这个字符串。','厂商名称、注册标识和产品品牌应按实际产品管理要求填写。'],relations:[link('vendor-id','关联','厂商数字ID与显示名称是不同字段。'),link('esi-vendor','对应','核对Vendor层级的Name。')],example:'VENDOR_NAME: Example Automation'}),
  imageSetting('VENDOR_IMAGE','厂商图标','EtherCATInfo/Vendor','esi-vendor'),
  setting({name:'GROUP_NAME',title:'设备分组名称',type:'生成元数据 · 字符串',summary:'用于生成主站设备目录中的分组信息，不是应用模块名或Device Profile号。',esi:'Descriptions/Groups/Group；Device/GroupType',facts:[{label:'用途',value:'主站目录分类'},{label:'需核对',value:'Group的Type/Name与Device的GroupType引用'}],details:['ESI的Group定义分类标识和显示名称，Device通过GroupType引用该分类。具体哪些位置由GROUP_NAME生成，须查看当前生成器结果。','不能把分组显示名、Group/Type和Device/GroupType三个概念一概当成同一个字符串字段。'],rules:['目录分组不会自动建立模块/槽位，也不会改变0x1000的Profile号。'],relations:[link('esi-groups','对应','核对Group定义与GroupType引用。'),link('group-image','配套','同一目录分组的图标单独配置。')],example:'GROUP_NAME: Example IO'}),
  imageSetting('GROUP_IMAGE','分组图标','Descriptions/Groups/Group','esi-groups'),
  imageSetting('DEVICE_IMAGE','设备图标','Descriptions/Devices/Device','esi-device'),
  numericIdentity({name:'PRODUCT_CODE',title:'产品码',si:'02',meaning:'厂商为产品型号定义的32bit产品码；与Vendor ID组合区分产品，不是每台设备的序列号。',esi:'Descriptions/Devices/Device/Type/@ProductCode',rules:['同一型号按产品方案管理产品码；不要把ESC芯片料号自动当作产品码。'],example:'PRODUCT_CODE: 0x00000001（仅示意）'}),
  numericIdentity({name:'REVISION_NUMBER',title:'产品接口修订号',si:'03',meaning:'产品定义的32bit接口修订信息；需要与ESI及SII修订描述一致，区别于固件版本字符串。',esi:'Descriptions/Devices/Device/Type/@RevisionNo',rules:['修订编码与兼容性策略按产品定义；没有统一的“高16bit硬件、低16bit软件”编码可直接套用。','修改后核对主站选用的ESI与设备实际接口兼容性。'],example:'REVISION_NUMBER: 0x00000001（仅示意）'}),
  numericIdentity({name:'SERIAL_NUMBER',title:'设备序列号',si:'04',meaning:'设备序列标识的配置/初始化值；区别于产品码和现场显式设备ID。',rules:['编译常量不会自动读取MCU唯一ID；按台配置或动态初始化须有实际固件/生产流程支持。','不能从一个示例中的0或固定值推断当前设备已具备唯一序列号。'],example:'SERIAL_NUMBER: 按该台设备的生产序列方案填写'}),
  setting({name:'DEVICE_PROFILE_TYPE',title:'Device Type与Profile号',type:'UINT32 · 32bit Device Type',summary:'配置CoE 0x1000的Device Type；低16bit是Profile号，高16bit附加信息按对应Profile解释。',coe:'0x1000:00',esi:'Device/Profile/ProfileNo',facts:[{label:'低16bit',value:'Profile号；5001 = 0x1389，402 = 0x0192'},{label:'高16bit',value:'附加类型信息；含义取决于Profile'},{label:'不是',value:'固件版本或任意硬件/软件版本拼接'}],details:['5001的十六进制表示为0x1389；0x5001是另一个数值，不能把十进制Profile号直接加0x前缀。','Profile 5001的模块化设备模型和CiA402驱动应用有各自要求；只改数字不会生成模块或实现驱动状态机。','核对应用定义表头与生成ESI的Profile/ProfileNo；它们与完整32bit Device Type在职责和位宽上不同。'],rules:['保留完整32bit值；高16bit不能统一解释为模块数、轴数或版本号。','所需应用对象及实现必须满足选择的Profile；这里的示例不是设备能力验证。'],relations:[link('xlsx-modular','需一致','应用定义的Device Profile/Module Profile表头各有语义。'),link('esi-device','对应','核对当前Device的ProfileNo与实际应用。')],aliases:['Device Type','0x1000','ProfileNo','5001','402','0x1389','0x0192'],example:'低16bit示意：\n5001₁₀ = 0x1389\n402₁₀ = 0x0192\n高16bit另按适用Profile定义',extra:{references:[FIELD_LIST,SSC,OBJECTS,DRIVE_TYPE],deviceType:{bits:32,profileBits:16,examples:[{profile:5001,hex:'0x1389'},{profile:402,hex:'0x0192'}]}}}),
  stringSetting('DEVICE_NAME','coe-device-name','设备名称','0x1008:00','Example IO','配置设备名称字符串；CoE用于查询产品名称，适用ESI显示名另与生成结果核对。',['名称不等于主站用于匹配的ProductCode或RevisionNo。'],'Device/Name'),
  stringSetting('DEVICE_HW_VERSION','coe-hardware-version','硬件版本','0x1009:00','1.0','配置实际设备硬件版本字符串，独立于软件版本和数字修订号。',['硬件变化按硬件版本管理；不要把固件构建版本复制到硬件版本。']),
  stringSetting('DEVICE_SW_VERSION','coe-software-version','软件版本','0x100A:00','1.0.0','配置实际设备固件版本字符串；不是必须与SSC库或SSC Tool版本相同。',['发布时对应实际固件构建；它不等于0x1018:03的产品接口修订号。']),
]
