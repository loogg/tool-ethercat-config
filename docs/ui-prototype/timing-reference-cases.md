# 时序图参考案例与实现取舍

用户要求查找可借鉴的实现，以下使用项目自己的手册/文档，未复制其软件源码。

| 案例 | 适合本工具的做法 | 本轮落地 | 未引入的部分 |
|---|---|---|---|
| [PulseView / sigrok](https://sigrok.org/doc/pulseview/0.4.1/manual.html) | 信号共用时间轴，游标 A/B 与差值测量，缩放后保持可读性 | 四条 PDI/SM 轨道、可拖动双标记、Δ、波形导航 | USB 采集、协议解码器、桌面 Qt 依赖 |
| [Perfetto UI](https://perfetto.dev/docs/visualization/perfetto-ui) | 点击事件查看解释，按事件推进，缩放/平移，聚焦选中事件 | 事件圆点、可键盘操作的事件表、聚焦、Shift 拖动平移、Ctrl 滚轮缩放 | 真实 Trace 导入、SQL 分析、大规模轨道虚拟化 |
| [Saleae Logic 2](https://www.saleae.com/support/logic-software/viewing-and-analyzing-data/measurements-timing-markers) | 跨轨道标记与时间差，明确测量范围 | 共用坐标与可移动标记，时间差独立于所选轨道 | 边沿频率/电气采样统计，因为当前没有采样数据 |
| [WaveDrom](https://wavedrom.com/tutorial.html) | 清楚的数字信号、状态段和事件标记 | 原生 SVG 方波、状态区间、逻辑步骤；模型与渲染分开 | 未把 WaveJSON 图片当成交互组件。输入变化、状态快照、事件解释由本工具计算 |

采用共用轨道，便于同时看见 PDI 停止后 SM 仍在触发。倒计时采用斜线复位，期限后区域标红；Count=0 保留禁用态，不能画成零秒超时。

参数是教学输入。物理时间轴以 ms/µs 标明单位；三缓冲和 CiA402 用逻辑步骤，不制造固定执行时间。播放速度只影响演示进度。

XML 界面另参考 [XML Notepad](https://microsoft.github.io/XmlNotepad/help/overview/) 的结构/值/帮助分离，以及 [esd EtherCAT Workbench 手册](https://esd.eu/fileadmin/esd/docs/manuals/en/EtherCAT_Workbench_Manual_en_20.pdf#page=49) 的槽位、模板、逻辑功能上下文。保留本工具的紧凑白底与蓝色选中态，不引入设备通信。
