# 概念与场景展示模型

## 数据与渲染边界

```text
概念定义（稳定ID、短解释、前置、误解、范围）
    ├─ 教学场景（输入、步骤、状态与纯函数推导）
    │       └─ 可视模型（角色/引用/位段/内存/时序/状态/文件）
    ├─ 配置对应（现有Entry ID、完整父级路径、关系角色与条件）
    └─ 依据（对应结论、官方文档版本与章节）

现有条目/全局搜索 ──> 基础概念工作台 ──> 配置字段
SSC/应用/ESI ──> 原位术语说明 ──> 完整场景
                 └─ 关闭恢复焦点 / 返回恢复URL上下文
```

领域数据不保存像素坐标，不将教学示例认作当前工程实值；配置对应引用已有稳定条目。18条原协议参考保留ID，根据主题选择专用概念视图。新概念和总览同样进入搜索、收藏和最近查阅。

## 展示方案

沿用紧凑全局栏和现有三类实体目录。基础概念提供总览与主题入口，不常驻第三栏。主题页上方为短标题和一句话，下方为可点击的步骤、当前主图和就地解释；配置对应和官方依据在同一页按需查看。

固定的小图采用DOM/SVG直接呈现，关系类型明确标注；窄屏按语义顺序转为纵向。同步与灯态提供可停止的演示。完整关系图、时序和对象布局复用既有能力，先理解的视图优先显示必要轨道和节点。

## 内容边界

- 典型SM0/1邮箱、SM2/3过程数据分配只用于带邮箱的教学示例，实际按ESI与设备配置。
- SSC对象默认本地内存布局按ET9300 §7.1，和PDO连续位流分别建模。
- 字段可映射、候选PDO、活动分配与容量约束分别表达；物理缓冲占用考虑模式、Length例外与字宽取整。
- SYNC由DC时间触发输出；LATCH记录外部边沿的时间戳，应用获知时间与捕获时间分开。
- AL状态、指示灯提示和CiA402驱动状态保留各自含义，灯态配设备/规范适用范围。
- ESI为描述、SII为设备信息内容、EEPROM为存储介质；生成与启动依具体ESC和固件。5001模块化设备规则和402驱动规则不归并为普通/伺服二选一。

## 首页视图模型（用户实施中补充）

```text
HomeSection / 主入口 ──> NavigationTarget ──> 现有collection.overview
                 基础概念 / SSC / 应用定义 / ESI
HomeSection / 主题 ────> learningTopics ────> 现有概念条目
HomeSection / 计算 ────> calculator registry ─> calculators路由
HomeSection / 最近 ────> 本地已访问Entry ID ──> 经entryMap校验的真实条目
```

首页数据是已有知识与导航的投影，不复制概念定义或字段规则，不推断设备连接状态。四个主入口保持同等级，基础概念排第一。首屏提供选择路径所需的信息，避免大幅留白的欢迎区和重复搜索框。空hash和品牌链接进入`home`，显式SSC/应用/ESI/概念深链接保留原意。

## 参考设计

- Red Blob Games：短问题与局部可操作图解：https://www.redblobgames.com/pathfinding/a-star/introduction.html
- VisuAlgo：引导讲解与自主探索：https://visualgo.net/en/list
- Wireshark：结构字段与字节高亮联动：https://www.wireshark.org/docs/wsug_html_chunked/ChUsePacketDetailsPaneSection.html
- port EtherCAT Design Tool：统一语义与多产物对应：https://www.port.de/en/products/ethercat/tools/ethercat-design-tool.html
- EC-Engineer：领域导航与所选对象上下文：https://public.acontis.com/manuals/EC-Engineer/4.1/html/Common/gui.html

这些是交互和组织参考；技术结论按官方协议/SSC/ESC文档维护，图解和文字在本工具中自行实现。
