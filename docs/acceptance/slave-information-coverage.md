# SlaveInformation 配置补全与图标工具入口

2026-10-27，基线v1.7.0。用户要求核对截图中的SlaveInformation缺项，并在图标配置中附上现有EtherCAT Image工具。

## 范围与依据

- 按截图顺序列出13个真实字段：VENDOR_ID、VENDOR_NAME、VENDOR_IMAGE、GROUP_NAME、GROUP_IMAGE、DEVICE_IMAGE、PRODUCT_CODE、REVISION_NUMBER、SERIAL_NUMBER、DEVICE_PROFILE_TYPE、DEVICE_NAME、DEVICE_HW_VERSION、DEVICE_SW_VERSION。
- 已核对Microchip官方DS70005377A图6-7（正文29页）的同名13项。AN1920图9包含部分旧版本的`*_LEN`项；长度字段作为名称/版本项中的版本相关说明，不假定所有SSC都显示相同选项。
- 保留现有CoE名称/版本与Identity深链接。导航显示实际字段名；Identity四字段对照作为关联参考，不冒充一个可配置的Identity参数。
- 图片字段采用ESI元数据模型，分别对应Vendor、Group和Device图标；不关联为CoE对象或写入SII身份区。工具链接为 https://loogg.github.io/tool-ethercat-image/ 。只修改本工具仓库。
- 数字身份、名称、图片和Device Type分别建模。0x1000为32bit Device Type；区分Profile号5001（0x1389）、402（0x0192）、高16位附加信息和固件版本。
- 示例保持通用；不保存截图中的公司、工程名称、Vendor ID或图片数据。

```text
SlaveInformation 13字段
  ├─ 数字身份 ─> CoE 0x1018各SI / ESI匹配字段 / SII核对
  ├─ 名称版本 ─> CoE 0x1008/9/A / 对应描述（按版本）
  ├─ 目录图标 ─> ESI相应层级 + 图标转换工具
  └─ Device Type ─> CoE 0x1000位段 / 应用与ESI Profile核对
```

## 实施前验收标准

| 检查 | 预期 | 状态 |
| --- | --- | --- |
| 导航与搜索 | 13项按截图顺序；宏名直接搜索命中；旧名称/版本/Identity链接仍可用 | 通过；列表和搜索/路由语义测试，实际导航显示13项 |
| 模型与内容 | 逐项说明类型、用途、关联及边界；图片无虚构CoE/SII数据；5001/402十进制十六进制区分 | 通过；逐SI地址、图片父级、Profile位段及旧版本长度说明分别检查 |
| 图片入口 | 三个IMAGE字段均有明显的工具链接，目标正确，新标签打开并保留当前查阅页 | 通过；实际点开新标签，三页头部与检查器链接正确，目标HTTP 200 |
| 验证与交付 | 内容/图关系回归、lint/build、实际桌面/窄屏、提交推送及线上版本核验 | 通过；206项回归、lint/build、实际界面、CI部署和线上39文件校验均完成 |

## 公开依据

- [Microchip DS70005377A，图6-7](https://ww1.microchip.com/downloads/aemDocuments/documents/OTH/ProductDocuments/UserGuides/LAN9252-SAME54-EtherCAT-Application-Quick-StartGuide-70005377A.pdf#page=29)
- [Microchip AN1920，图9](https://ww1.microchip.com/downloads/en/AppNotes/00001920A.pdf)
- [Beckhoff ET9300 V1.10](https://download.beckhoff.com/download/document/io/ethercat-development-products/an_et9300_v1i10.pdf)
- [EtherCAT Image 工具](https://loogg.github.io/tool-ethercat-image/)；已只读核对该独立仓库README的输出说明，兼容性仍按实际SSC确认。

## 本地验证

- 206项测试通过，包含本轮4项覆盖/地址/图标/Device Type专项语义回归，以及653种不同关系模型的横纵正交路由回归。lint与生产构建通过。
- 左侧13项顺序与截图相同，Identity只保留关联和旧链接，不增加第14个虚构参数。宏名精确检索及旧URL均能解析。
- VENDOR_IMAGE、GROUP_IMAGE、DEVICE_IMAGE各自保留ESI父级，没有CoE对象或SII身份数据关联。点击外链实际打开新标签，来源页保持原配置；目标URL不附加当前工程数据，使用noreferrer。
- 四个数字身份字段均能打开跨文件规则；实际核对VENDOR_ID的UINT32、0x1018:01、输入范围和工程值未载入状态。
- 原图卡保留精简事实，当前配置检查器补齐输入格式、ESI位置、长度及版本边界，避免只显示前两项事实。
- 1280×1000桌面与390×900窄屏实际检查，页面无横向溢出，窄屏默认关系列表，图标工具按钮可见。
- SSC静态内容拆成独立缓存模块；主入口448.86kB，无500kB告警。不修改toolbox或图标工具仓库。

## 界面证据

- [13项导航与图标工具](images/slave-information/desktop.png)
- [Device Type位段说明](images/slave-information/profile.png)
- [390px图标入口](images/slave-information/mobile.png)
- [线上v1.7.1](images/slave-information/published.png)

## 发布核验

- 功能提交`d647e2e52e2017f8494ca07581111ae9dc0988b3`已推送；[CI 40447194411](https://github.com/loogg/tool-ethercat-config/actions/runs/40447194411)的verify与deploy均成功。
- [线上入口](https://loogg.github.io/tool-ethercat-config/?v=1.7.1#/entry/vendor-image?collection=SSC&group=SlaveInformation&pane=detail)实际显示v1.7.1、13个原名字段与正确的新标签图标链接；已保存公开页面截图。
- Pages子路径构建的39个文件逐一下载并比较SHA-256，全部一致。
- [Release v1.7.1](https://github.com/loogg/tool-ethercat-config/releases/tag/v1.7.1)含ZIP与校验文件。ZIP共43文件（39个dist文件及4个预览/说明文件）、1,105,566Byte，打包逐项比较与ZIP完整性检查通过。
- ZIP SHA-256为`c84a024479941fba0463c4cf254fef7c2f462caff7b62151e2f641f753d7f534`，GitHub资产摘要一致。

当前阶段：v1.7.1修改、测试、提交推送、Pages部署、Release与验收归档完成。只修改当前工具仓库。
