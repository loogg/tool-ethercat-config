# 架构与数据契约

React 19 + Vite 7，JavaScript ES modules，CSS tokens，lucide-react，本地 DM Sans 字体及中文系统字体。静态数据可维护，无后端。

```text
结构化配置条目 → 搜索索引/分类 → 查阅工作台 → 详情/双向关系
                                   │           │
                              URL hash     纯函数计算器
                                   │           │
                           浏览历史/深链接  参数 → 校验 → 步骤/结果
                                   │
                             localStorage 收藏
```

## 内容契约

每条 Entry：`id, name, title, category, summary, sources, facts, details, rules, example, relations, references, calculator?, aliases?`。

- category: identity / hardware / object / pdo / sync / mailbox / state / esi
- sources: `[{kind:'SSC'|'XLSX'|'ESI'|'CoE'|'ESC',path:string}]`
- facts: `[{label,value}]`；默认值明确标注来源，不假设全局默认。
- details / rules: string[]；纯文本，禁止不可信 HTML。
- example: `{code,language,caption}`，可省略。
- relations: `[{target,type,description}]`，type 中文如“对应”“依赖”“影响”“引用”“参与计算”。反向关系由统一索引派生。
- references: `{title,url,note?}[]`，官方文件/用户笔记，具体行为有适用条件。
- calculator: mapping / layout / memory / watchdog / control，可选。
- id：SSC 宏转小写连字符（max-pd-output-size）；Excel xlsx-index 等；ESI esi-rxpdo 等；概念 sm2 / pdo-assignment / pdo-mapping / object-dictionary / sync-modes 等。

根组件拥有路由与持久化；Library 管理筛选；Article 展示内容；Calculators 将输入交给可测试纯函数。数据/计算与展示分离，避免为实现公式依赖 React。

## 实体导航修订（用户预览反馈）

主导航以 `collection`（SSC / APP / ESI / concepts）和 `group` 建模，不再以主题 category 为默认目录。collection 是条目的唯一归属，由内容模块明确赋值；一个条目引用其他来源，不因此成为其他配置实体的正式字段。SSC group 保留工具真实层级，Application/ProcessData 为嵌套路径。category 保留供标签、解释及内容维护使用。

`navigation.js` 定义实体目录、概览和组路径；`EntityNavigation` 显示可折叠层级；路由存储实体/组并校验有效性。全局搜索进入独立的 search 视图，跨实体跳转以目标归属更新目录；浏览器返回使用URL恢复上下文。

## v1.1 图式实现

`ConfigurationTree`直接显示配置叶子，取代常驻第二列结果卡片。`App`保留导航/收藏/最近记录，搜索以紧凑浮层检索，输入时保留当前图上下文。

`config-models.js`逐项定义103个正式配置的模型类别与判断依据。`config-graph.js`将配置转为局部图：对象容器/子项组成、初始化、路径选择、位域编码、条件/权限、地址窗口、数据长度及物理缓冲等按具体模型处理。没有明确因果含义的旧资料关系保留为参考虚线，不提升为公式或恒等。

React Flow 12.12.0承载可访问选择、视口与连线，Dagre 3.1.2用于自动排列。布局先按顶层实体计算，再放置子项；筛选必须保留子项的祖先容器。父容器高度随相关子项数量变化。自动方向评估画布宽高与图形尺寸；人工选择保持优先。窄屏默认可读关系列表。

PDO容量演算复用既有纯函数：活动位长求L，`planSmMemory`分别以L和容量上限规划实际及预留，保留内部字宽向外取整与Length 0/1的例外。固定/测量时间参数和物理Delay=0分别判断。完整计算器接收当前图的初始演算上下文，不读取或写入设备。

生产构建将React与图形依赖分块；现有数据、字体和计算全部本地打包。旧字段ID及旧URL保留，旧list/detail参数在新界面中定位到配置字段。

## v1.2 应用工作表实现

APP 不再复用每个配置的大图布局。`application-workbooks.js`保留通用示例的原始行列，`application-model.js`将其解析为对象、成员、字段取值、槽位与模块实例预览。`ApplicationDefinition`以表格为入口，字段说明按选择显示，局部图通过原生 dialog 展开。具体项目数据按用户要求排除。领域结构与生成边界见[应用定义模型](application-definition-model.md)。

SSC 总览移除两个演算样板的置顶卡片；裸入口与品牌首页进入正常 SSC 分类。其他 SSC/ESI 图、计算器与已保存的字段 ID 保留。

## v1.2.2 看门狗理解视图

看门狗图拆分共享Divider（0400）、PDI/PDI0 Count（0410）和Process Data Count（0420），各自计时公式不混用。`watchdog-timing.js`使用既有计算函数生成40ns时基下的名义教学轨道；`WatchdogTiming`提供触发情景、时间游标和独立禁用。该页默认时序，保留图/列表切换，不模拟SSC软件实现或硬件输出动作。

从时序进入完整计算器时带入该次参数，包括0；从普通图节点打开时清除时序输入，避免参数来源混淆。ESI的XML/Profile模型仍为后续评估方案，本轮未实施。
