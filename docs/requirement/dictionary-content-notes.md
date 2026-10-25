# 字典与 ESI 内容依据

核对日期：2026-10-24（Asia/Shanghai）。本次新增 `src/data/dictionary.js` 34 条、`src/data/esi.js` 27 条，共 61 条；不包含另一内容模块的 SSC 宏条目。

## 来源与适用边界

- 用户 Notion 原文保存在 `temp/notion-source.txt`。XLSX B–P 列是用户模板位置，界面条目提示以字段名为准。
- Beckhoff [ET9300 V1.10](https://download.beckhoff.com/download/document/io/ethercat-development-products/an_et9300_v1i10.pdf)：核对对象定义、生成规则、回调、模块化以及同步术语。标明 SSC 特定规则，未把它们作为所有协议栈的强制布局。
- Beckhoff [ESC Technology V2.5](https://download.beckhoff.com/download/document/io/ethercat-development-products/ethercat_esc_datasheet_sec1_technology_v2.5.pdf)：核对 SM/FMMU、DC、SII 机制。资源数量、内部字宽、Sequential 支持等仍按具体 ESC 判断。
- ETG [实施指南 V3.2.0](https://www.ethercat.org/download/documents/ETG2200_V3i2i0_G_R_SlaveImplementationGuide.pdf)：ESI 与设备侧 SII 的角色。完整发布仍须对应版本 ETG.2000/2001 schema 和设备验证。
- Beckhoff [状态机](https://infosys.beckhoff.com/content/1033/el15xx/1036980875.html)、[SM/FMMU](https://infosys.beckhoff.com/content/1033/tc3_io_intro/4981170059.html)、[Modules/Slots](https://infosys.beckhoff.com/content/1033/ep8601-0022/17946536971.html)及 TI 官方 ESI 示例辅助核对具体概念。产品手册里的数值未提升为全设备默认值。

## 独立复核后的关键修正

1. **M/O/C 按上下文解释**：普通条目是实现类别；手工 PDO mapping 对象行的 `O` 表示可选 PDO，`M` 或空白表示必选 PDO（ET9300 §13.3.2）。已同步 `xlsx-moc` 和 `esi-pdo-flags`。
2. **对象内存和线上 PDO 位布局分离**：SSC CoE 本地对象成员的 WORD/16 bit 块约束来自 ET9300 §7.1。示例使用 3 BOOL + `pad_5` + `pad_8` 再放 UINT16，而不是仅补 5 bit。线上 PDO 仍按实际映射逐位累计。
3. **SM 占用不是无条件 3L**：ESC 内部处理字宽可能要求首尾向外取整。Length=1 不使用额外两个缓冲，Length=0 视为禁用。内部处理字宽不同于 PDI 访问宽度。12 Byte 示例明确限制在已对齐的 8/16/32 bit 内部字宽。
4. **ControlByte 型号边界**：bit7 可在支持的新 ESC 上用于 Sequential 模式，不能一概称为保留位或对任意芯片启用。
5. **默认与在线实际分离**：ESI 能力、DefaultSize 和默认地址不等于主站在线实际配置；XLSX Default Value 可能被恢复参数或 Startup 覆盖。
6. **方向与权限分离**：Rx/Tx 从从站视角，Inputs/Outputs 采用主站过程映像视角；SDO Access 与 PDO 可映射方向独立。

## 验证记录

- `node --check src/data/dictionary.js`：通过。
- `node --check src/data/esi.js`：通过。
- 与 SSC 模块合并后的内容检查：121 个 ID，无重复、无失效关系目标，所有条目具备摘要、facts、details、rules、来源与示例。
- 示例 XML 均为局部语义演示，不声称是完整、通过 schema 校验的量产 ESI 文件；工具不执行设备烧录、通信或安全功能验证。
