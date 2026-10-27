# SI0、完整访问与分层布局

2026-10-26，基线v1.5.4。用户要求实施已讨论的显示模型，覆盖SI0逻辑类型8bit、SSC默认本地占位16bit、单项/CA不同载荷、CA起点仅0或1以及非法起点Abort。

## 依据与边界

- Beckhoff ET9300 V1.10 §§7.2/7.3：ARRAY/RECORD的SI0协议描述UNSIGNED8，默认SSC本地以UINT16分配。[官方PDF](https://download.beckhoff.com/download/Document/io/ethercat-development-products/an_et9300_v1i10.pdf#page=62)
- Helmholz TB20 V02 §9.5.1（正文87页）：CA起点0/1；其他起点0x06010000；包含SI0时其后插入完整Byte，SI1从bit16开始。[官方PDF](https://www.helmholz.de/media/pdf/83/1f/dd/Handbuch_TB20_EtherCAT_Koppler_V2_EN.pdf#page=87)
- MathWorks官方CoE说明：SI0单项有效数据1Byte、CA包含SI0时后跟零填充Byte。[文档](https://www.mathworks.com/help/slrealtime/io_ref/configuring-the-ethercat-library-blocks.html)
- 已核对本地SSC V5.13的OBJ_GetObjectLength、OBJ_GetEntryOffset、OBJ_Read/Write及SDOS_SdoInd。私有工程代码不拷入产品；ETG原版规范条款未直接取得，证据按厂商说明和SSC实现标注。
- 不把本地sizeof、报文总长、SDO有效对象数据或PDO长度合并。VARIABLE不套用复合SI0计数头；CA能力声明与实际请求成功分别判断。

## 工程方案

```text
教学对象定义（条目/逻辑位长/明确值） ──> 协议条目视图
             ├── 默认SSC存储规则 ──> 本地占位/相对偏移
             └── SDO请求（读写/单项或CA/起始SI/访问前提）
                    └── 校验 ──> 数据载荷段/填充/字节偏移 或 Abort/输入错误

应用对象字典、基础概念、SSC/ESI入口 -> 同一工作台和纯函数模型
```

实现共享的独立教学对象，不从未绑定的XLSX、ESI或独立示例推定固件实际值、C结构或CA能力。来源入口只作查阅上下文，明确提示教学对象。支持ARRAY、RECORD、VARIABLE，输入错误与协议Abort分开；CA填充是派生段，不是对象条目。演示统一权限及允许状态，未实现设备通信或通用CA编解码器。

界面：紧凑的请求控制、校验结果、联动的协议条目/SDO载荷/本地存储；点选SI0或字节高亮对应成员。接入应用字段说明（含SI0入口）、基础概念独立场景、COMPLETE_ACCESS_SUPPORTED及ESI CompleteAccess能力字段。按需加载工作台，保留既有路由、图表和查询行为。

## 验收标准（实施前）

| 项目 | 方法与预期 | 状态 |
| --- | --- | --- |
| 三层独立 | SI0描述保持8bit；SSC本地16bit；传输占位随请求派生，不改源字段 | 本地通过 |
| 单项与CA | 单项SI0仅1Byte；CA0为SI0+零填充+SI1..n；CA1不含SI0且SI1载荷偏移0、本地偏移仍16bit | 本地通过 |
| 合法性 | CA起点2/255为0x06010000；单项SI2可成功；无效数字不伪装成SDO Abort；VARIABLE路径正确 | 本地通过 |
| 访问前提 | 读/写、CA支持、统一权限与允许状态分别校验；不作无条件成功演示 | 本地通过 |
| 数据准确性 | 已知值按协议小端展示，填充不成为新SI，不自动加入PDO或假定整结构体可memcpy | 本地通过 |
| 入口 | 应用SI0/对象、基础概念、SSC能力项、ESI能力字段都能打开共用模型，关闭恢复查阅 | 本地通过 |
| 视觉交互 | 桌面和390px窄屏，字节/成员联动、切换、错误/恢复、键盘与弹窗关闭实际验证 | 本地通过 |
| 交付 | 定向模型测试、原有回归、lint、构建、Pages子路径/静态包及发布核验 | 本地通过，待公开核验 |

## 2026-10-27 实现与本地核验

- 共享纯模型保留对象协议定义、SSC默认本地占位、请求校验和派生载荷四个子模型。3种独立教学对象，CA填充为subIndex=null的派生段，未新增对象条目。
- CA0/CA1、单项0/2、非法CA2/255、输入越界、VARIABLE、读写权限和状态均已模型测试。能力前提关闭只显示前提未满足，不编造不同设备可能不同的Abort码；VAR和非法CA起点按已核对SSC分支给出0x06010000。
- 工作台按需加载；桌面三栏同时比较，按实际容器宽度改为纵排。点条目、字节、本地成员联动。快捷场景自动选中相关SI，SI0比较明确区分1Byte有效值和1Byte填充。
- 应用生成SI0的E列仍为UINT8，协议模型为UNSIGNED8/8bit；本地16bit和CA规则通过独立入口解释。实际打开、关闭恢复字段及焦点已验证。
- 基础概念新增sdo-access场景，旧3步和旧链接保留；URL保存请求参数，CA1刷新后仍为6Byte载荷，SI1载荷偏移0、本地偏移2。恢复教学值回到CA0。
- SSC能力配置、ESI CompleteAccess（原文0保留）以及DTF000类型成员均能打开同一工作台。ESI弹窗Escape不会收起原字段，关闭回到原位置。一次连续导航后误点受到页面定位滚动影响，确认稳定AX状态后复验入口和返回通过。
- 390×844实际界面：工作台与弹窗均无横向溢出；非法CA提示、按字节点选、填充说明和关闭按钮可达。独立教学作用域与源字段位置同时标明，没有把示例当作文件或设备的实际值。

当前阶段：实现与定向界面检查完成，正在执行最终完整检查、版本与发布验证。


## v1.6.0最终候选

- lint、176项完整回归、相对路径与Pages子路径构建通过；生产依赖审计0漏洞。新增工作台代码独立按需加载，主入口493.15kB，未增加依赖。
- 最终候选再次实际核对：CA1载荷6Byte、无SI0/填充，SI1载荷偏移0而本地偏移2；390×844 CA2显示0x06010000、空成功载荷，弹窗无横向溢出，控制台无warning/error。
- [桌面三层对照](sdo-access-layout/desktop-ca1.png)、[窄屏非法CA起点](sdo-access-layout/mobile-ca2.png)。关闭恢复调用位置，普通字段类型未改变。
- ZIP候选：ethercat-config-v1.6.0.zip，1069053 Byte，38文件（35个dist文件）。完整性及逐文件内容校验通过。SHA256：22fa7d5e8e8dd9a776644051ae3fb1972c61216a3a0117e08210d9857f4d938a。

当前阶段：最终候选通过，正在核验子路径/独立静态包并提交发布；toolbox不需要变更。


子路径/静态包实际检查：4182模拟/tool-ethercat-config/，v1.6.0的动态JS/CSS加载正常，CA1为6Byte且SI1载荷/本地偏移0/2；解压目录不含node_modules，以包内脚本在4183启动，CA2中止而单项SI2为4Byte。控制台无warning/error。最终能力关闭显示“访问前提未满足”，未编造设备Abort码；同一前提下单项SI2仍可成功。
