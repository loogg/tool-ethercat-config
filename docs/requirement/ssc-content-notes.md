# SSC 内容审查记录

范围：`src/data/ssc.js`，60 条。按用户 Notion 的 SSC Tool 章节完整覆盖 Generic 5、Hardware 10、State Machine 5、Synchronisation 9、ProcessData 8、Mailbox 19；另提供设备名称、硬件版本、软件版本、0x1018 身份信息 4 条。

## 依据与适用条件

- 原始内容依据为用户提供的 用户提供的内部资料（私人出处仅在本地留档），已保存在 `temp/notion-source.txt`。笔记中的配置数值均按工程示例处理，未作为 SSC 或 EtherCAT 的通用默认值。
- [Beckhoff ET9300 v1.10](https://download.beckhoff.com/download/document/io/ethercat-development-products/an_et9300_v1i10.pdf) 用于核对 SSC 框架、对象字典组织、同步时间和 Pending SDO 等关键机制。它不是每个厂商 Config.xml 的逐项规范；不声称已审查实际 SSC 5.13 源码或用户固件。
- [Beckhoff General FMMU / SM](https://infosys.beckhoff.com/content/1033/tc3_io_intro/4981170059.html) 核对三缓冲与单缓冲区别。3L 只用于实际采用三缓冲的通道；不能用过程数据的逻辑长度直接推断所有设备的完整 RAM 布局。

## 关键内容决定

1. 所有宏均给出类型、位置、具体使用建议、误用提醒、示例和关联。示例不会声称 GDSCN832 的 RAM 地址范围适用于其他 ESC。身份示例不分配真实 Vendor ID 或产品身份。
2. MIN / DEF / MAX PD 地址与 MAX_PD_*_SIZE 分开说明。MAX_PD_*_ADDRESS 的具体判定式要求核对目标 SSC，不把所有版本假设为同一实现；完整缓冲占用要独立检查。
3. ECAT_TIMER_INT 的 1 ms 服务与 PDO 周期明确区分；选择 ESC 看门狗并不授权删除其他计时服务。ESC 与 PDI 看门狗、状态转换时限分别说明。
4. 用户的 SSC 5.13 Pending SDO 观察保留为版本条件。说明回调可能反复进入、应用需管理超时，避免误导为主站 ResponseTimeout 自动取消本地异步任务。
5. ET9300 v1.10 §9.2 的测量段落将 Get Cycle Time 写为 :09，与此前 Delay Time 描述冲突。采用经 [Beckhoff 对象表](https://infosys.beckhoff.com/content/1033/ep7402/19475767563.html) 核对的 :08。只借此核对索引，不移植该产品的默认值和权限到所有 SSC 设备。
6. MIN_PD_CYCLE_TIME 与 CALC_AND_COPY_TIME 为 0 的运行测量需要对应 SSC 功能及时间测量前提，不能当作真实耗时为零；物理 Delay Time 不会自动补偿或被这一机制测出。
7. AoE / VoE / SoE / EoE 开关与完整应用实现分开。各发行包和厂商移植可提供不同实现范围，不承诺“打开宏即可使用协议”。
8. 暂不把扩展身份 ID、LED 状态、特定寄存器访问副作用当作全厂商统一实现。具体芯片依赖保留在说明中。
9. 独立复核补充：Beckhoff ESC Technology v2.5 §8.1.2/8.2.2 对内部 16/32/64 bit 数据宽度引入真实单缓冲范围的向外取整；§8.5 对 Length=1 取消额外双缓冲。因此将 SSC 地址/容量条目的 3L 示例明确限定为经典 8 bit 内部处理且 L>1 的模型，不与 ESC_16BIT_ACCESS/ESC_32BIT_ACCESS 混淆。

## 检查

- `node --check src/data/ssc.js` 通过。
- 导入统计：60 条、60 个唯一 ID；每条都有 summary、details、rules、references。
- 宏及身份内容完整性按用户笔记 SSC Tool 章节检查。跨文件关系的最终可解析性由项目合并后的统一索引检查。
