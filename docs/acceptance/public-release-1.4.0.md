# v1.4.0 测试、提交与公开发布

日期：2026-10-25。用户明确要求测试、提交、推送并发布；仅操作本工具仓库。

## 发布前标准

- 确认仓库根目录与提交范围；不修改 toolbox 或其他工具仓库。
- 从干净依赖安装执行 lint、全部测试、生产构建，再检查实际界面。
- 发布物不包含用户本地输入、私有笔记地址、凭据、研究缓存或设备工程。公开内容保留官方出处与示例边界；移除的私有出处在忽略目录留档。
- GitHub Actions 对 main / PR 执行校验，只从 main 向本仓库的 GitHub Pages 发布。
- 验证 /tool-ethercat-config/ 基路径与懒加载、深链接、移动布局、源文件窗口和计算工具。
- 首次提交后正常推送，不强推；等待远程校验与部署成功，验证实际公开页面。
- 发布v1.4.0标签与本地可独立运行的ZIP；版本来自package.json，校验包内容与SHA256。

## 已确认

- 本地Git已初始化但没有提交、分支或远程内容需要覆盖；当前版本1.4.0。
- 已登录GitHub账户loogg，SSH身份验证成功；同名远程仓库不存在。
- 执行npm ci：0漏洞。首次全量校验：133项测试、lint、构建通过。
- 现有工作流仅检查，需补齐独立Pages发布步骤。

## 执行结果

### 本地验收

- `npm ci`完成，审计0漏洞；`npm run lint`、134项测试及生产构建全部通过。新增公开引用检查，防止私人笔记链接回到发布内容。
- 建立独立公开仓库`loogg/tool-ethercat-config`，默认分支main；Pages采用GitHub Actions发布。
- 在`/tool-ethercat-config/`基路径构建并启动预发布服务，验证首页、懒加载ESI、深链接刷新及资源路径。
- 实际操作：全局检索SSC配置；周期时序逐事件与A/B测量（0→120µs）；ESI Entry/BitLen的原位说明、局部关系图、XML L100原文、到SSC输出容量和应用DataType的跳转、返回后的字段恢复；应用列手册可填写值。
- 实际操作计算器：`#x70000101`解码为`0x7000:01 / 1 bit`；超过32位时显示错误；PDI Count=0显示禁用，SM侧保持100ms；Divider超16位提示错误，重置可恢复。
- 390×844窄屏没有页面横向溢出，字段和值、对应入口均可阅读；恢复默认视口。发布前控制台无warning/error。
- 私人Notion出处已从运行内容和公开文档移除，原件保存在被忽略的`temp/release-private-provenance/`；保留官方依据。不包含用户设备工程和原始xlsx。
- 离线包包含dist、预览脚本和启动说明，不需要安装npm依赖；25个dist文件逐一与ZIP内内容核对一致，解压后单独启动验证。
- ZIP：`ethercat-atlas-v1.4.0.zip`，557768字节；SHA256：`7dafcf4520bf2fea53c1b50f085b726422089c05288aec0e64f789c65e7910b3`。

实际界面：[预发布ESI字段工作页](images/release-1.4.0-preflight.png)。

### 远程发布

- 功能代码提交：`45972be9d7549433b985c5a6d1c8ff782be52740`，已正常推送main。
- 首次远程校验与部署：[Verify and publish #40165866749](https://github.com/loogg/tool-ethercat-config/actions/runs/40165866749)，verify、deploy均成功。远程重新执行npm ci、lint、测试、构建并发布本仓库Pages。
- [公开站点](https://loogg.github.io/tool-ethercat-config/)返回HTTP 200；逐一下载全部25个公开文件，其SHA256均与已验收的Pages子路径构建一致。
- 对提交后的源码重新构建，25个文件均与离线ZIP使用的dist一致；解压包独立启动后，首页与JavaScript返回HTTP 200，没有node_modules。
- 线上首页、ESI懒加载页面及Entry/BitLen深链接均实际渲染正常，见[线上ESI字段截图](images/release-1.4.0-online.png)。
- 线上浏览器的DOM/可访问性读取多次超时，改用同一浏览器的截图复查。完整交互回归以发布前相同子路径构建的结果为准，不把超时读取计为通过。

### 交付位置与结论

- 在线查阅：https://loogg.github.io/tool-ethercat-config/
- v1.4.0版本与ZIP下载位置：https://github.com/loogg/tool-ethercat-config/releases/tag/v1.4.0
- 用户要求的发布范围为本独立工具。运行内容、静态产物与界面验收通过，远程校验与Pages部署成功。未修改toolbox或其他工具仓库；没有进行硬件联调或完整XSD验证。
