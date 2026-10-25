# 配置图式查阅的参考案例

2026-10-24，针对用户提出的局部节点图、父级上下文、短说明与可追踪计算关系进行研究。下述是官方资料研究，不是对三个产品的登录后实机审计；UI组合方案属于本项目的设计判断。

## 首选：OpenMetadata 字段级血缘

- [官方关系图探索](https://docs.open-metadata.org/v2.0.x/how-to-guides/data-lineage/explore)
- [官方字段级血缘](https://docs.open-metadata.org/v2.0.x/how-to-guides/data-lineage/column)

官方说明包含按选中资产展开上下游、在表节点内展开列、点击边查看来源/目标/说明/转换信息，以及限制探索深度和每层节点数。适合借鉴“实体容器内字段行 + 字段级连接”，用来表示应用定义中的某字段与ESI的具体属性、CoE对象条目之间的关系。

项目应用：父级放进节点头，具体字段放在行中；点边显示关系条件和计算规则。默认当前配置的一跳，按需展开更多。

差异：本工具的连线不全是数据流。必须区分初始化、引用、容量约束、能力依赖和离线描述；不能把同一风格箭头解释成同一种因果。

## 节点内容：DBeaver ER Diagrams

- [官方图交互](https://dbeaver.com/docs/dbeaver/How-to-use-Diagrams/)
- [官方图功能与显示配置](https://dbeaver.com/docs/dbeaver/ER-Diagrams/)
- [官方选择实体截图](https://dbeaver.com/docs/dbeaver/images/erd/erd-select-elements.png)

官方说明支持选择字段高亮相关键/连线、选择边高亮端点、按需要控制属性可见度和显示完整限定名称。适合借鉴紧凑卡片、字段行和选择高亮，而非文章卡片。

项目应用：节点只保留父级路径、字段名、单位/类型和短值，其他说明放右侧。连线落到字段行，避免只连一个笼统的“ESI”大框。

差异：不照搬数据库外键、基数符号或SQL编辑工具；本工具默认查阅模式，缩放与折叠服务于解释。

## 整体布局：Node-RED 工作台

- [官方编辑器结构](https://nodered.org/docs/user-guide/editor/)
- [官方信息侧栏](https://nodered.org/docs/user-guide/editor/sidebar/info)
- [官方完整编辑器截图](https://nodered.org/docs/user-guide/editor/images/editor-default.png)
- [官方信息栏截图](https://nodered.org/docs/user-guide/editor/images/editor-sidebar-info.png)

官方结构为工作区及可调整侧栏；信息栏根据当前选中项显示属性、摘要和帮助。适合借鉴“窄目录 + 中央图 + 简短检查器”，把说明和关联放在同一个上下文内。

项目应用：右栏随着节点/连线选择变化，首先显示一句作用和必要条件；计算位于选中关系的下方面板，帮助按需展开。

差异：不需要部署流程、运行日志或让用户自由拖线修改工程关系。连线是有依据的查阅知识，不是用户任意建立的连接。

## 推荐组合

内容表达以OpenMetadata字段级血缘为主；节点密度借鉴DBeaver；工作区分配借鉴Node-RED。三者组合比寻找一个视觉上相似的“白色卡片后台”更贴近本项目的任务。

## 证据范围

本轮读取了上述官方页面正文和截图链接。OpenMetadata图片CDN经Web读取返回403；Node-RED官方PNG在内置浏览器已出现页面元数据，但两次读取超时，未成功接受图片像素。因此本文件不声称视觉核验了这些外部产品；用户可通过官方链接查看原图。当前工具的审查截图另在本轮验收记录中，已经真实捕获并查看。
