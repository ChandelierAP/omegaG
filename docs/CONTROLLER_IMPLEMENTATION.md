# 第一轮交付

本轮为计划第 27 节指定的审计 + Issue 1。Fork：ChandelierAP/omegaG；master 保持上游，main 为定制稳定基线，开发在 codex/controller-semantic-layer，提交通过 draft PR 审阅。

调用链与边界见 [审计](../OMEGAG_AUDIT.md)。代码改动仅涉及 config.rs 与 codex_micro.rs 的交互层。mapper.rs 只修正旧测试的模式初始化及独立滑动连续性断言；virtual_dualsense.rs 仅添加 Linux 测试编译条件。CI 增 Windows 任务，覆盖原来 Linux 不编译的 Codex 模块。

| 按住 PS 后的控制 | 行为 |
|---|---|
| L1 / R1 | 上一个 / 下一个六槽会话 |
| Cross / Circle | 批准 / 拒绝当前选中会话 armed approval |
| Triangle | 发送 runtime composer |
| Square | commands.review |
| Share / Options | 新建 / fork 会话 |
| 十字键上 / 下 | 增加 / 减少已公布 reasoning effort 的 index |
| 十字键左 / 右 | commands.status / commands.tests |
| L3 / R3 | favorites.primary_command / primary_skill；未设置时按配置 key 排序 |
| 右摇杆上 / 右 / 下 / 左 | progress / checks / diff / blocker prompts |
| Touchpad | 选中；350 ms 内第二次按下读取并恢复 |
| L2 | 保留 PTT 行为；需自行配置 voice adapter |

按键是上升沿 one-shot；PS 松开后继续消耗输入直到中立。审批身份关联、epoch、重连门控和唯一 HID 输出循环未修改。
Favorite 显式指定不存在的 key 时不执行；只有 favorite 未指定才沿用排序回退。primary_skill 不预设为不存在的 test skill，示例给出配置位置。
commands / cardinal_actions 表未提供时使用新默认值；显式提供的旧表完全保留，不注入新键。如果旧表无 review/status/tests，对应按键不执行；请按示例补齐所需 key。

新增四个回归测试：三组新 binding / one-shot / PS gate；favorites 实际派发和无效 key；旧 TOML 与显式 favorites 解析；示例 TOML 解析。原有 approval identity、epoch、neutral、reasoning、reducer、fake server 测试继续运行。

版本验收边界：本机 CLI 为 0.146.0，仍保留 upstream 的 0.145.0-alpha.24 pin。Windows 当前设备列表可见 Status=OK 的 DualSense Wireless Controller，但设备枚举不等于端到端验收。
CLI app-server 使用自己的 runtime composer 与会话状态，并不读取此 Codex 桌面聊天输入框；不要将 Triangle 描述为发送桌面未发送内容。

下一步先验证当前 CLI 的协议兼容性或配置隔离的 pinned CLI，再做实际按键、thread、approval 与反馈验收。完成第一轮稳定验收后才考虑第二轮 rumble/更多 slots；当前不加入 GUI 或 mode system。

上游合并风险主要为 config 默认值和 update_input 相邻按键分派的冲突；核心传输与 reducer 没有分叉。priority toggle 保留语义实现，因 Touchpad 冲突取消默认绑定。
