# 技术内容独立复核

复核范围：`src/data/dictionary.js`、`src/data/esi.js`、`src/data/ssc.js`、`src/lib/calculations.js`。以下按发现时状态记录问题，并在每项末尾更新复验结果。

## 发现的问题与修复状态

### [P1] 内存规划遗漏 ESC 内部字宽引起的真实缓冲占用

- 定位：发现时 `src/lib/calculations.js:102–103`，`allocated = length * buffers`；以及未带模型条件的 3L 内容说明。
- 复现：输入 A=0x1003、L=0xFA、3 buffers、ESC 内部处理宽度 32 bit。旧模型计算结束地址 0x12F1；官方示例实际保留区间为 [0x1000,0x1300)。若在 0x12F4 放下一 SM，旧模型会漏掉真实缓冲重叠。
- 原因：内部宽字处理的 ESC 需要先按内部字宽 W（Byte）扩展单缓冲范围，再复制物理跨度。W 不等于 PDI/MCU 访问宽度。
- 精确算法：`base=floor(A/W)*W`，`singleEnd=ceil((A+L)/W)*W`，`stride=singleEnd-base`，完整区间 `[base,base+stride*N)`。完整扩展范围必须落在 RAM 内，且不能与其他 SM 的扩展范围重叠。
- 单字节例外：Length=1 时额外 buffer1/2 不使用；可仍生成 watchdog / interrupt（部分 ESC mailbox 模式对触发仍有交替读写条件）。Length=0 不占用缓冲，也不产生这些触发。
- 依据：[Beckhoff ESC Technology v2.5](https://download.beckhoff.com/download/document/io/ethercat-development-products/ethercat_esc_datasheet_sec1_technology_v2.5.pdf)，§8.1.2 I-51 / 图26，§8.2.2 I-53，§8.5 I-56。
- 建议：新增 8/16/32/64 bit 内部宽度模型，并显示有效数据长度与真实物理占用。不要把起始地址对齐校验误当作物理占用取整，也不要静默修改用户的 SM Length。
- 状态：已修复并独立复验。`planSmMemory` 支持 internalWidth 8/16/32/64，所有边界、重叠、空闲区都采用扩展物理区间，Length=1/0 单独处理。已检查官方反例和宽字隐藏重叠用例，`node --test tests/calculations.test.js` 的 17 项均通过。SSC、dictionary、ESI 与界面已保留一致的范围说明；12 Byte 已对齐例子在 8/16/32 bit 模型下仍成立。

### [P2] M/O/C 应补充 PDO mapping 对象的特殊用途

- 定位：`src/data/dictionary.js:63–65`，条目 `xlsx-moc`。
- 当前说明将 M/O/C 与 PDO Mandatory 完全分开，并提示不要用它控制 PDO 是否自动分配，缺少 SSC 生成器对 PDO mapping 对象的特殊处理。
- 影响：用户正在手工定义可选 PDO 时，会误以为 mapping 对象行的 M/O/C 不参与 PDO 选择约束，无法理解 XLSX 到 ESI 的关联。
- 依据：[Beckhoff ET9300 v1.10](https://download.beckhoff.com/download/document/io/ethercat-development-products/an_et9300_v1i10.pdf)，§13.3.2，印刷页 119：手工定义可变 mapping/assignment 时，可选 PDO mapping 对象标记 O，必选对象标记 M 或留空。
- 建议：保留普通对象实现类别的说明，增加“对 SSC 手工 PDO mapping 对象，M/O/C 还用于生成可选/必选 PDO 描述”的特殊规则。不要把这个标记表述成运行时已经启用或已分配；最终活动分配仍看 0x1C12/0x1C13。
- 状态：内容代理已修复；复读当前 `xlsx-moc` 与 `esi-pdo-flags`，特殊上下文和运行时活动分配已区分。

### [P2] XLSX 对齐条目缺少 SSC 的 WORD 对齐规则，现有例子容易被照抄

- 定位：`src/data/dictionary.js:96–100`，条目 `xlsx-padding`。
- 当前条目讨论 SSC 应用定义，但例子是 `3 bit BOOL + 5 bit padding + 16 bit UINT16 = 24 bit`，仅将 UINT16 对齐到第 1 字节；文中未给出 SSC 大于 8 bit 成员的 WORD 对齐要求。
- 影响：按此构造 SSC 对象内存结构时，UINT16 可能落在奇数字节偏移，与 SSC 默认对象访问实现期望不一致。PDO 线上可以紧凑排布，并不能据此推导 SSC 本地对象结构也可以相同排布。
- 依据：[Beckhoff ET9300 v1.10](https://download.beckhoff.com/download/document/io/ethercat-development-products/an_et9300_v1i10.pdf)，§7.1，印刷页 59；该节明确说明这是 SSC 特定内存布局约束，不是 EtherCAT 通用规范。
- 建议：明确区分两个例子：通用 PDO 位流的字节对齐例子、SSC 本地对象结构的 WORD 对齐例子。对于后一种，从 WORD 边界开始的 3 个 BOOL 可接 pad_5 与 pad_8，使后续 UINT16 从下一个 WORD 起点开始。不要把总计 13 bit 的补位写成跨字节的单个小成员。计算器仍可保持顺序位打包，但需要说明结果不验证 SSC 对象布局。
- 状态：内容代理已修复；复读当前 `xlsx-padding`，WORD 相对对象偏移、16 bit 块填充、跨字节条件与 PDO 位流区别均明确。

### [P2] ControlByte bit7 的保留位判断缺少 ESC 型号边界

- 定位：`src/lib/calculations.js:160–164`，`decodeSmControl()` 的 `reservedBit` 与警告字符串；ESI 同类说明生成后也应检查。
- 当前行为：所有 bit7=1 都提示“bit 7 是保留位，写入时必须为 0”。
- 影响：会将 ET1150 或支持新功能的 IP core 的合法 Sequential Mode 配置误判为必须清除的保留位。例如 0xE4 在支持该功能的 ESC 上，bit7 表示顺序写模式，并非一概非法。
- 依据：[Beckhoff ESC Register Description v3.3（2025-07-28）](https://download.beckhoff.com/download/Document/io/ethercat-development-products/ethercat_esc_datasheet_sec2_registers_v3.3.pdf)，§2.14.3（II-101）；§2.1.8 中 0x0008:0x0009 bit12 声明支持能力（ET1150，以及 IP core 自 V4.0.0）。v3.0 表格里的 bit7 保留规则只适用于该文档覆盖的旧模型。
- 建议：可以保留经典模型，但必须明确模型范围，并把未知型号的 bit7 提示改成条件性说明；或允许选择 classic / sequential-capable 解码模型。UI 标签和 ESI 条目也需相同范围。不要对所有输入给出“必须为 0”的指示。
- 状态：已修复并独立复验。ESI 有型号条件，`decodeSmControl` 增加 `sequentialSupported`，UI 有能力选择；0xE4 在支持模型中解出 Sequential Mode，传统模型中保留条件性提醒。17 项计算测试中包含此用例。已建议 UI 进一步写明它只作用于 ECAT 写入侧。

## 已检查且未发现具体错误的规则

- RxPDO 为主站到从站，TxPDO 为从站到主站；Input/Output 对应主站过程映像；Access 与 rx/tx 分别约束 SDO 与 PDO 可映射性。
- PDO mapping 使用 16 bit Index + 8 bit SubIndex + 8 bit BitLength，编码计算避免 JavaScript 有符号 32 位溢出；0x10 / 0x20 对应 16 / 32 bit。
- SM2 / SM3 在主要标题和说明中标明常见四 SM 配置；assignment 引用 mapping 的方向正确。
- 在经典 8 bit 模型、Length>1 时三缓冲区间为 [A, A + 3L)；主站配置的 SM Length 仍是 L。结束地址采用不包含的上界。新实现已扩展宽内部数据模型，但硬件型号及其内部字宽仍由用户按手册确认。
- ControlByte 的 mode bits 1:0、direction bits 3:2、ECAT event bit4、AL event bit5、watchdog trigger bit6 位运算正确；0x64 为三缓冲主站写方向且带 AL event 与 watchdog trigger。bit7 的型号边界问题另列于待修复项。
- Watchdog 在采用 40 ns 基础周期的 ESC 模型下，计算 `(Divider + 2) × 40 ns × Count` 正确，整数最大乘积未超过 JavaScript 安全整数范围。依据：[Beckhoff Watchdog 说明](https://infosys.beckhoff.com/content/1033/ej28x9/1036979339.html)。设备型号与关闭功能的适用条件应在最终工具界面和条目保留。
- 新 SM 规划器将起始地址与可选 Length 对齐校验标记为 SSC/硬件模板条件，与 ESC 内部字宽的分配取整分开；没有将工具结果表述为完整硬件验收。
- ESI 27 条已读取，PdoAssign / PdoConfig、外层 PDO Index 与 Entry Index、默认描述与在线配置、模块定义与活动实例均有清晰区分；未发现新的独立工程错误。SM 物理占用和 ControlByte 型号边界按上面两项统一修正。

本次未修改其他代理的业务代码。已在自己负责的 `ssc.js` 修正内存模型适用范围，并通过 `node --check`；没有把用户工程数值重新解释为通用默认。

复核结论：本轮发现的 1 项 P1、3 项 P2 均已修复并复读/复测。没有剩余阻断性技术内容问题。真实设备联调、完整 ETG schema/CTT 验证及目标 SSC 厂商移植源码检查不在本次静态查阅工具复核范围内。
