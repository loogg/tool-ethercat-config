# EtherCAT Atlas

面向 EtherCAT 从站开发的纯前端配置查阅工作台。SSC Tool、应用定义文件（Excel）、ESI 设备描述文件和 CoE/ESC 概念统一检索，带双向配置关系、可追溯资料和五类交互计算。

## v1.5.1 技术内容修正

- 模块化 ESI 的 F000 改为复合对象，索引距离和最大模块数与默认槽位、应用定义示例一致。
- 修订 2 的 32 bit 输出采用 4 Byte SM 默认长度，未使用的输入 SM 长度为 0 且关闭；双轴和默认模块组合也有语义检查。
- ESI 的 RT/TR 同时显示 Rx/Tx 两种可映射能力，未知标志保留为未解析。补充首次输出、看门狗路径和状态转换时限的 SSC 版本条件。
- 增加针对实际示例和关联图的语义回归，保留官方规则、实现差异与教学输入的适用范围。

[审查与修复验收](docs/acceptance/content-audit-v1.5.0.md)

## v1.5 首页与基础概念

- 首次进入打开独立首页，品牌与“首页”按钮均可返回。基础概念位于导航第一组，四个主入口并列展示基础概念、SSC Tool、应用对象字典、ESI。
- 首页使用现有集合、学习主题、计算器及真实本地最近记录派生内容，不重复维护知识正文，不显示虚构设备统计。
- 六个基础主题、29个术语、11种教学场景与33个讲解步骤，分别采用角色、对象结构、位段、引用链、通道、FMMU、缓冲、时序、状态灯和文件关系图。
- 配置页内点击点线术语即可查看短解释、前置知识、完整场景及相关配置。关闭恢复焦点，返回恢复原字段；学习参数和步骤可通过URL保留。
- 18个旧概念条目保留深链接、技术要点、示例、关系及原有公开依据；FreeRun、SM Sync、DC可分别比较。
- SYNC/LATCH新增共用时间轴模型，可带入当前教学参数；看门狗可带入当前场景和游标。灯态可播放/暂停并尊重减少动画。

[本轮验收](docs/acceptance/concept-learning.md) · [首页与概念展示模型](docs/architecture/concept-learning.md)

## v1.4 ESI 条目工作页

- ESI 默认使用身份、通信、字典、PDO、模块/轴、SII 的配置导航，可切换原始 XML 树。
- 字段、原文值、含义与 SSC/应用对应同行显示；选中字段后原位展开写法、当前文件引用和来源规则。
- 复杂关系按需展开为当前字段的局部图。协议位宽、活动位宽求和、Byte换算、容量约束分步表达；对象与PDO步长分开显示。
- 原文和文件内引用以窗口打开，不离开当前条目。保留历史链接、Device/Revision、Module作用域与本地只读文件恢复。
- ESI按需加载，移除固定第三栏和七个并列页签。SSC与应用定义保持原有界面。

[本轮验收](docs/acceptance/esi-item-display.md) · [显示方案与UML](docs/ui-prototype/esi-display-review.md)

## v1.3 XML 与时序工作台

- ESI 按文档 → Device/Revision → XML 节点查阅；保留属性原始词形、完整源文本、路径和行号。未知字段可见，XML 语法可解析与完整 XSD 有效性分开表达。
- 对象/类型、PDO/Entry、Slots/Modules 与实例预览分别建模。字典引用仅在当前 Device 或 Module 内解析，步长来源可定位到真实父级；复杂组/重复实例不猜测地址。
- Profile 402 提供轴对象、控制/状态字与默认模式能力位；Profile 5001 兼容直接 Device 与模块化结构。轴分组只在明确的教学假设下预览。
- 本地 ESI 只读入浏览器内存，不上传、不写回。刷新后需重新打开文件，损坏/超限文件不替换当前文档。支持 UTF-8 及浏览器 TextDecoder 可识别的 XML 声明编码。
- 时序改为统一刻度的信号、倒计时、状态轨道；支持播放/暂停、逐事件推进、事件解释、游标拖动、缩放、平移、A/B 测量、参数校验与计算器带入。
- 七类教学模型：PDI/SM 看门狗、周期预算、物理 I/O 延迟、AL 等待条件、SDO 异步回调、三缓冲交接、CiA402 PDS。缓冲和 PDS 使用逻辑步骤，其他图的数值均为教学输入。

[本轮验收](docs/acceptance/esi-and-timing-workbench.md) · [架构与边界](docs/architecture/esi-timing-workbench.md) · [逐项时序判断](docs/architecture/timing-model-inventory.md) · [参考案例取舍](docs/ui-prototype/timing-reference-cases.md)

## v1.1 图式查阅

- 标题、搜索与重复说明区已收敛到紧凑顶栏；左侧配置树直接展开字段，搜索结果按需显示。
- 以当前配置的局部关系图为主；可选自动/横向/纵向排列、缩放、定位当前项和文字关系视图。窄屏默认文字关系视图，保留图切换。
- CoE 对象与子索引分层；选择子项可查看 Index 高低字节、独立的 SubIndex 及适用的数值位段。
- PDO容量示例联动显示活动位长、实际Length、单缓冲跨度、1/3缓冲占用和按最大容量预留，支持内部字宽及起始地址取整。
- 每个正式配置项有显式模型判断，见[103项判断清单](docs/architecture/config-model-inventory.md)。位域、权限、回调、对象结构、地址窗口、时序、容量与缓冲等采用对应结构；未确认成因果的资料关系用参考虚线区分。
- 完整计算器带入关系图的相关初值，其他通道/范围仍以示例明确标注。

## 打开最终版

在线站点：[EtherCAT Atlas](https://loogg.github.io/tool-ethercat-config/)。

已构建的项目可双击 `Start-Tool.cmd`，再访问 <http://127.0.0.1:4181/>。需要本机安装 Node.js 22.12+（当前开发/验证为 Node 24）。该预览仅监听 127.0.0.1。关闭命令窗口或按 Ctrl+C 停止服务。

也可以执行 `node scripts/preview.mjs`。静态产物在 `dist/`，可部署到静态 HTTP 服务；不要通过 file:// 直接打开 ES module 页面。ZIP 交付包包含 dist、无额外依赖的 Node 预览脚本和启动文件。

## 开发与验证

所有命令在本仓库执行：

```powershell
npm ci
npm run dev
npm run lint
npm test
npm run build
```

生产构建使用相对资源路径；GitHub Actions 构建时会根据 `GITHUB_REPOSITORY` 设置站点 base。GitHub Actions 会在校验通过后将 main 发布到本仓库的 GitHub Pages；PR 仅检查。工具为独立仓库，不依赖或修改 toolbox。

## 使用

- 搜索宏名、中文用途、索引或 XML 字段；例如 `MAX_PD_OUTPUT_SIZE`、`0x1C12`、`ControlByte`。多词会组合匹配；忽略下划线、连字符和大小写。
- 主目录按真实工具/文件组织：SSC Tool、应用定义文件（Excel）、ESI 设备描述文件。SSC 保留原配置树，包括 Application → ProcessData；概念性资料位于“基础概念”。跨入口关联会同步切换目录位置。
- 条目展示配置位置、规则、示例、适用范围与来源；“关联关系”展示主动关系及反向引用。链接可直接分享，浏览器返回可回到上一条目。
- 书签保存常用条目，最近查阅保留20项；均仅保存在当前浏览器。
- `Ctrl/Cmd+K` 聚焦搜索，`Esc` 收起浮层，搜索框内 `Enter` 打开首个结果。
- 计算工具：PDO 32 位映射编解码、连续位布局、SM 内存规划、SM/PDI 看门狗、ControlByte 字段解析。条目内可打开相关计算器。

## 内容与边界

知识数据随应用打包，搜索和计算在本地执行，不调用 Notion、AI 或其他远程服务。参考链接在用户点击时打开外部资料。内容基于用户 EtherCAT 笔记与官方 Beckhoff 等资料，各条目保留出处与版本条件。

区分工程示例、SSC 生成行为、ESC 能力与主站实际配置。支持只读查看本地 ESI XML；文件只在浏览器内存中保留。没有设备通信、XLSX 导入生成、ESI 编辑生成或设备一致性验证功能。数值和描述需结合实际器件、SSC版本、设备profile复核。

## 维护

- `src/data/ssc.js`：SSC 宏与设备身份。
- `src/data/dictionary.js`：XLSX 字段、对象字典及协议概念。
- `src/data/esi.js`：ESI 结构、属性、模块化设备。
- `src/lib/calculations.js`：纯计算和输入校验。
- `src/lib/library.js`：搜索、反向关系、路由、存储。
- `src/data/config-models.js`：正式配置项的模型判断与用途边界。
- `src/lib/config-graph.js`：局部图、对象层级、条件关系、演算与自适应排列。
- `src/components/ConfigGraph.jsx`：图画布、选中项检查器和演算区。
- `tests/`：真实规则与边界测试、内容引用完整性检查。

新增条目按[数据契约](docs/architecture/frontend.md)编写。引用目标必须存在；内容测试会验证重复ID、缺失来源、悬空关系及关键搜索。

设计：[Cap参考](docs/ui-prototype/cap-style-reference.md)、[Refactoring UI九章应用](docs/ui-prototype/refactoring-ui-notes.md)。

交付：[需求](docs/requirement/product.md)、[验收记录](docs/acceptance/initial-delivery.md)、[技术复核](docs/acceptance/technical-review.md)。

图式改版：[本轮验收](docs/acceptance/graph-redesign-review.md)、[模型方案](docs/architecture/configuration-graph-model.md)。

应用工作表改版（v1.2）：[数据模型](docs/architecture/application-definition-model.md)、[本轮验收](docs/acceptance/application-workbook-redesign.md)。APP 按基础设备、模块工作表和对象/成员表格查阅，说明及局部图跟随选中字段；仅内置通用示例。SSC 首页按原分组进入，移除了两个置顶演算入口。

应用入口覆盖普通单体、模块化单实例和双实例；对象/成员共用一个核心模型，模块/Slot为可选层。点击B–P列标题或“列填写手册”查看支持值、参数化语法、范围、空白含义、组合与范例；类型和权限按ET9300 V1.10核对。具体项目数据不在运行包中。

v1.2.1保留普通模板的IndexIncrement/PdoIndexIncrement=0。在DataType手册的“SSC对象边界”页可切换原排布/补齐示例，查看字节与WORD界限。该规则用于SSC默认对象本地内存，PDO连续位流单独计算。

v1.2.2看门狗页补齐0410 PDI/PDI0分支，与0420过程数据看门狗独立计数、共享0400分频。默认时序教学支持四种触发情景、观察时间和单侧禁用；图和列表保留。公式为40ns ESC模型下的标称估算，不是实际采样波形。

跨来源规则层：[模型评估与三版UML](docs/architecture/cross-source-model.md)。SSC、应用字段与ESI均可进入“跨文件对应”，共用带条件和出处的规则。未绑定同工程文件时不把独立示例认作已核对的生成产物。
