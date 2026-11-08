# Clash AI Clean Network (纯净 AI 网络与防泄漏技能包)

针对 Anthropic Claude、OpenAI ChatGPT 等严苛风控平台的代理网络环境治理、防 DNS / WebRTC 泄露与住宅纯度优化技能。

## 痛点与解决成效

- **治理前**：
  - Claude IP 信任评分降级为 68（轻微风险，伪装住宅 / 实为 Akile 日本机房）
  - WebRTC UDP 裂解（UDP 走 AWS，HTTP 走日本机房，触发多出口标记）
  - DNS 泄露（多级随机子域名绕过 `*.` 单级通配，暴露中国移动 `117.135.x.x`）
  - 国内探针被误代理，显示中国出口为海外 IP
- **治理后**：
  - **Claude 信任评分：100 极度纯净**
  - **出口属性：家庭住宅 IP (Frontier Communications / ISP)**
  - **DNS 泄露：未检测到泄露 (Cloudflare 1.1.1.1)**
  - **WebRTC UDP 泄露：未检测到泄露 (与 HTTP 出口同源)**
  - **中国出口：正常直连中国移动**

## 目录结构

- `SKILL.md`: 完整的技能执行规范、原理剖析与排障清单。
- `references/`:
  - `flclash-profile-script.js`: FlClash 订阅配置预处理脚本（自动剔除伪装节点并注入策略）。
  - `mihomo-clean-network-snippet.yaml`: Mihomo (Clash.Meta) 核心配置代码片段（含 DoH 与 rules）。

## 快速上手

1. 将 `references/mihomo-clean-network-snippet.yaml` 中的 `dns` 与 `rules` 导入代理客户端。
2. 在 TUN 设置中开启 `strict-route: true` 杜绝 Windows 物理网卡旁路泄露。
3. 访问 `https://ip.net.coffee/claude/` 刷新验证各项指标。
