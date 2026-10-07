# omegaG 审计（2026-10-07）

基线：`428cf993868b97f65f6120a58b4a5876ab267b1e`，上游 master，工作区最初干净。
审计先于实现；本轮仅实施计划 Issue 1。

| 项目 | 当前实现与决定 |
|---|---|
| DualSense 入口 | `hid.rs::find_all_controllers/open_controller`；`input.rs::parse` 分派 USB/BT，产出 UnifiedInput；`controller.rs` 定义设备类型 |
| 调用链 | `main.rs::run_input_loop` → `CodexMicro::update_input` → BoundAction / SemanticAction → Dispatcher → RuntimeTransport → supervised runtime → protocol builders |
| app-server 启动 | `codex_runtime.rs::spawn_child`，先 probe_version，启动 `app-server --stdio`；supervise 管理 epoch、退出和退避 |
| JSON-RPC | `codex_protocol.rs` 的 NDJSON framing、大小限制和请求构造；runtime 的 call/handle_frame 关联响应 |
| thread / turn | `codex_micro.rs` 六槽 reducer、generation/sequence guard；runtime 的 project_threads/notification 处理真实状态 |
| approval | runtime Approval 保存原始 RequestId、epoch、method、thread/turn/item/approval；handle_server_request 和 handle_mutation 校验；Cross/Circle 仅对 armed request 发动作 |
| command / skill | update_input 生成 Command/Skill；handle_mutation 复用 turn/start，skill 验证当前公布 name/path；不增 RPC |
| lightbar | CodexMicro::rgb / compose_rgb；main::run_output_loop 为唯一输出循环；output.rs 封装报告 |
| config | config.rs::Config/CodexMicroConfig，serde(default)，Config::load + normalize；Windows `%APPDATA%/ds4cc/config.toml` |
| Windows 边界 | main.rs 用 cfg(windows) 编译 codex_*；Linux 解析配置但不启用 Codex runtime；平台注入在 platform 下 |
| 可直接复用 | HID、USB/BT、CRC、重连、中立门控、审批身份、六槽 reducer、模型 effort discovery、PTT、command/skill dispatch、灯光 |
| 必改 | config.rs 增 favorites 和默认 prompts；codex_micro.rs 改 Square/左右 D-pad 和 favorites 解析；测试、配置示例、README |
| 不改 | HID/input/output、protocol framing、lifecycle、runtime/reducer core、模拟键盘机制 |

Touchpad 已绑定 Select / read / resume，与 priority 冲突。因此 ToggleFast 保留语义能力但取消默认物理绑定。
现有 rumble 输出存在，但本轮不加入第二阶段震动模式。
Reasoning 输入是有界 index，runtime 将 index 限制到 model/list 公布的 efforts；不添加硬编码 effort 名称。

本机 `codex --version`：`0.146.0`；仓库要求 `0.145.0-alpha.24`。
版本不匹配按现有实现 fail closed。本轮不删除 pin、不修改全局 Codex、不宣称桌面现有聊天可直接控制。
后续真实兼容性验证须先建立协议兼容测试；第一轮先运行纯测试和 fake server 测试。
