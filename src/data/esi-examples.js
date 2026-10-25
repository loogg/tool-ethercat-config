// Generic teaching documents. They are not the user's project or a production ESI.
const datatype=(name,bits,body='')=>`<DataType><Name>${name}</Name><BitSize>${bits}</BitSize>${body}</DataType>`
const object=(index,name,type,bits,access='ro',mapping='',data='')=>`<Object><Index>#x${index}</Index><Name>${name}</Name><Type>${type}</Type><BitSize>${bits}</BitSize>${data?`<Info><DefaultData>${data}</DefaultData></Info>`:''}<Flags><Access>${access}</Access>${mapping?`<PdoMapping>${mapping}</PdoMapping>`:''}</Flags></Object>`
const entry=(index,name,type,bits,si=0,attrs='')=>`<Entry><Index ${attrs}>#x${index}</Index><SubIndex>${si}</SubIndex><BitLen>${bits}</BitLen><Name>${name}</Name><DataType>${type}</DataType></Entry>`
const pdo=(direction,index,name,body,attrs='',indexAttrs='')=>`<${direction}Pdo Fixed="1" Mandatory="1" ${attrs}><Index ${indexAttrs}>#x${index}</Index><Name>${name}</Name>${body}</${direction}Pdo>`
const dictionary=(profile,extra,types='')=>`<Profile><ProfileNo>${profile}</ProfileNo><Dictionary><DataTypes>${datatype('USINT',8)}${datatype('UINT',16)}${datatype('UDINT',32)}${datatype('INT',16)}${datatype('SINT',8)}${datatype('DINT',32)}${types}</DataTypes><Objects>${object('1000','Device type','UDINT',32,'ro','',profile===402?'92010200':'89130000')}${extra}</Objects></Dictionary></Profile>`
const sm=(outputBytes=2,inputBytes=2)=>`<Fmmu>Outputs</Fmmu><Fmmu>Inputs</Fmmu>
      <Sm StartAddress="#x1000" DefaultSize="128" ControlByte="#x26" Enable="1">MBoxOut</Sm>
      <Sm StartAddress="#x1080" DefaultSize="128" ControlByte="#x22" Enable="1">MBoxIn</Sm>
      <Sm StartAddress="#x1100" DefaultSize="${outputBytes}" MinSize="0" MaxSize="64" ControlByte="#x64" Enable="${outputBytes>0?1:0}">Outputs</Sm>
      <Sm StartAddress="#x1200" DefaultSize="${inputBytes}" MinSize="0" MaxSize="64" ControlByte="#x20" Enable="${inputBytes>0?1:0}">Inputs</Sm>
      <Mailbox DataLinkLayer="1"><CoE SdoInfo="1" PdoAssign="1" PdoConfig="0" CompleteAccess="0"/></Mailbox>`
const dc=`<Dc><OpMode><Name>DC SYNC0</Name><Desc>Teaching synchronous mode</Desc><AssignActivate>#x0300</AssignActivate><CycleTimeSync0 Factor="1">0</CycleTimeSync0><ShiftTimeSync0>0</ShiftTimeSync0></OpMode></Dc>`
const device=(name,product,rev,body)=>`<Device Physics="YY"><Type ProductCode="#x${product}" RevisionNo="#x${rev}">${name.replaceAll(' ','_')}</Type><Name LcId="1033">${name}</Name><GroupType>Teaching</GroupType>${body}<Eeprom><ByteSize>2048</ByteSize><ConfigData>8000000000000000000000000000</ConfigData></Eeprom></Device>`
const wrap=(devices,modules='')=>`<?xml version="1.0" encoding="utf-8"?>
<!-- Generic teaching ESI. Public-field reference only; no full XSD validation. -->
<EtherCATInfo Version="1.6">
  <Vendor><Id>#x00000000</Id><Name>Teaching examples</Name></Vendor>
  <Descriptions><Groups><Group><Type>Teaching</Type><Name>Teaching devices</Name></Group></Groups>
    <Devices>${devices}</Devices>${modules?`<Modules>${modules}</Modules>`:''}
  </Descriptions>
</EtherCATInfo>`.replace(/></g,'>\n<')
const ioObjects=object('7000','Digital outputs','UINT',16,'rw','R')+object('6000','Digital inputs','UINT',16,'ro','T')
const directPdos=pdo('Rx','1600','Outputs',entry('7000','Digital outputs','UINT',16),'Sm="2"')+pdo('Tx','1A00','Inputs',entry('6000','Digital inputs','UINT',16),'Sm="3"')
const moduleType=datatype('DT6000',32,'<SubItem><SubIdx>0</SubIdx><Name>SubIndex count</Name><Type>USINT</Type><BitSize>8</BitSize><BitOffs>0</BitOffs></SubItem><SubItem><SubIdx>1</SubIdx><Name>Value</Name><Type>UINT</Type><BitSize>16</BitSize><BitOffs>16</BitOffs><Flags><Access>ro</Access><PdoMapping>T</PdoMapping></Flags></SubItem>')
const module=(ident,name,index,pdoIndex,direction)=>`<Module><Type ModuleIdent="#x${ident}">${name}</Type><Name>${name}</Name><Profile><Dictionary><DataTypes>${direction==='Rx'?moduleType.replace('<Access>ro</Access><PdoMapping>T</PdoMapping>','<Access>rw</Access><PdoMapping>R</PdoMapping>'):moduleType}</DataTypes><Objects><Object><Index DependOnSlot="1">#x${index}</Index><Name>${name} channel</Name><Type>DT6000</Type><BitSize>32</BitSize></Object></Objects></Dictionary></Profile>${pdo(direction,pdoIndex,name,entry(index,'Value','UINT',16,1,'DependOnSlot="1"'),'','DependOnSlot="1"')}</Module>`
const slots=`<Slots DownloadModuleIdentList="true" SlotPdoIncrement="#x1" SlotIndexIncrement="#x10">
        <Slot MinInstances="1" MaxInstances="1"><Name>FirstSlot</Name><ModuleIdent Default="1">#x00004711</ModuleIdent><ModuleIdent>#x00004712</ModuleIdent></Slot>
        <Slot MinInstances="0" MaxInstances="1"><Name>SecondSlot</Name><ModuleIdent Default="1">#x00004712</ModuleIdent><ModuleIdent>#x00004711</ModuleIdent></Slot>
      </Slots>`
const mdpType=datatype('DTF000',48,
  '<SubItem><SubIdx>0</SubIdx><Name>Highest subindex</Name><Type>USINT</Type><BitSize>8</BitSize><BitOffs>0</BitOffs><Flags><Access>ro</Access></Flags></SubItem>'+
  '<SubItem><SubIdx>1</SubIdx><Name>Module index distance</Name><Type>UINT</Type><BitSize>16</BitSize><BitOffs>16</BitOffs><Flags><Access>ro</Access></Flags></SubItem>'+
  '<SubItem><SubIdx>2</SubIdx><Name>Maximum number of modules</Name><Type>UINT</Type><BitSize>16</BitSize><BitOffs>32</BitOffs><Flags><Access>ro</Access></Flags></SubItem>')
const mdpObject=`<Object><Index>#xF000</Index><Name>Modular Device Profile</Name><Type>DTF000</Type><BitSize>48</BitSize><Info>
  <SubItem><Name>SubIndex 000</Name><Info><DefaultData>02</DefaultData></Info></SubItem>
  <SubItem><Name>SubIndex 001</Name><Info><DefaultData>1000</DefaultData></Info></SubItem>
  <SubItem><Name>SubIndex 002</Name><Info><DefaultData>0200</DefaultData></Info></SubItem>
</Info><Flags><Access>ro</Access></Flags></Object>`
const axisObjects=(offset)=>{
  const h=n=>(n+offset).toString(16).toUpperCase()
  return object(h(0x6040),'Controlword','UINT',16,'rw','R')+object(h(0x6041),'Statusword','UINT',16,'ro','T')+object(h(0x6060),'Modes of operation','SINT',8,'rw','R')+object(h(0x6061),'Modes of operation display','SINT',8,'ro','T')+object(h(0x607A),'Target position','DINT',32,'rw','R')+object(h(0x6064),'Position actual value','DINT',32,'ro','T')+object(h(0x6502),'Supported drive modes','UDINT',32,'ro','','80030000')
}
const axisPdos=(offset,pdoOffset,axis)=>{
  const h=n=>(n+offset).toString(16).toUpperCase()
  return pdo('Rx',(0x1600+pdoOffset).toString(16),`Axis ${axis} commands`,entry(h(0x6040),'Controlword','UINT',16)+entry(h(0x607A),'Target position','DINT',32),'Sm="2"')+pdo('Tx',(0x1A00+pdoOffset).toString(16),`Axis ${axis} feedback`,entry(h(0x6041),'Statusword','UINT',16)+entry(h(0x6064),'Position actual value','DINT',32),'Sm="3"')
}
export const esiExamples=[
  {id:'io',title:'普通 I/O · 多修订示例',filename:'Teaching_IO.xml',note:'两个 Device 分别表示修订，字典与 PDO 按当前 Device 隔离；修订2只有4 Byte输出，输入SM默认关闭。',xml:wrap(device('Teaching IO','00001001','00000001',dictionary(5001,ioObjects)+sm(2,2)+directPdos+dc)+device('Teaching IO revision 2','00001001','00000002',dictionary(5001,object('7010','Outputs revision 2','UDINT',32,'rw','R'))+sm(4,0)+pdo('Rx','1601','Revision 2 outputs',entry('7010','Outputs','UDINT',32),'Sm="2"')))},
  {id:'modules',title:'模块化 I/O · 槽位与模板',filename:'Teaching_Modules.xml',note:'F000包含索引距离与模块数；默认槽位组合的输入/输出各2 Byte。其他模块选择的活动长度另行计算。',xml:wrap(device('Teaching Modular IO','00002001','00000001',dictionary(5001,mdpObject,mdpType)+sm(2,2)+slots),module('00004711','Digital_Input','6000','1A00','Tx')+module('00004712','Digital_Output','7000','1600','Rx'))},
  {id:'drive',title:'CiA402 · 双轴解读',filename:'Teaching_Drive.xml',note:'本例显式采用 SSC 轴地址步长 0x800。不能由任意 ESI 自动断言轴数。',axisGroups:[{name:'Axis 1',offset:0},{name:'Axis 2',offset:0x800}],xml:wrap(device('Teaching Two Axis Drive','00003001','00000001',dictionary(402,axisObjects(0)+axisObjects(0x800))+sm(12,12)+axisPdos(0,0,1)+axisPdos(0x800,1,2)+dc))},
]
