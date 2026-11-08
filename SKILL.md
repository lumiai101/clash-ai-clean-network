---
name: clash-ai-clean-network
description: >
  [CRITICAL TRIGGER] MUST be invoked when the user encounters AI IP risk detection warnings (such as ip.net.coffee, ipinfo, scamalytics), Claude AI trust score drops, Claude/OpenAI account bans or access denials, DNS leaks (exposing domestic ISP DNS like China Mobile/Telecom/Unicom), WebRTC/STUN UDP leaks, fake residential IP detection, or needs to configure FlClash / Clash Verge / Mihomo (Clash Meta) for a 100% clean, leak-free AI network environment.
  TRIGGER KEYWORDS: "clash", "flclash", "dns 泄露", "dns leak", "webrtc leak", "claude ip", "ip 纯净度", "ip 风险", "家庭住宅 ip", "stun leak", "nameserver-policy", "纯净网络".
  NEGATIVE TRIGGER: DO NOT invoke for general application coding, frontend design, database operations, or non-network-proxy tasks. Near-miss exclusions: "npm install proxy-agent" (write code directly), "python crawler request" (use scraping skills).
  Trigger examples:
  - "Claude 报 IP 风险，检测显示 DNS 和 WebRTC 泄露怎么修？"
  - "优化一下 FlClash 和 Mihomo 配置，把 Claude IP 纯净度拉到 100 分"
---

# Clash AI 纯净网络加固指南 (Clash AI Clean Network)

本技能沉淀了针对 Anthropic Claude、OpenAI、ChatGPT 等严格审查客户端网络指纹的 AI 平台，在客户端代理（Mihomo / Clash.Meta / FlClash / Clash Verge）层面的**深度诊断、全链路防泄漏与环境纯净化**最佳实践。

通过本指南的工程化方案，可将综合网络风险检测平台（如 `https://ip.net.coffee/claude/`）的评测指标提升至 **100 极度纯净**（真实住宅 IP、DNS 零泄漏、WebRTC UDP 零裂解、国内探针准确隔离）。

---

## 配套资源索引

- 完整核心配置代码片段: [mihomo-clean-network-snippet.yaml](references/mihomo-clean-network-snippet.yaml)
- 客户端预处理持久化脚本: [flclash-profile-script.js](references/flclash-profile-script.js)

## 核心痛点与底层原理

现代风控系统（尤其 Anthropic Claude 防爬与防跨区检测）并不单看 HTTP 访问 IP，而是基于综合指纹判定：

```
                    ┌───────────────────────────┐
                    │  AI 综合网络指纹多维检测  │
                    └─────────────┬─────────────┘
                                  │
    ┌──────────────┬──────────────┼──────────────┬──────────────┐
    ▼              ▼              ▼              ▼              ▼
出口 IP 属性    DNS 递归泄露    WebRTC UDP     国内探针分离    时区与指纹
[真住宅 vs 机房] [中国运营商暴露] [STUN 出口裂解] [国内 IP 错判] [时区与语言偏差]
```

### 1. 假原生与假住宅欺诈（BGP/ASN 陷阱）
- **现象**：机场节点常命名为 `[新谷歌]` 或 `US 住宅原生`，但实际在 MaxMind、IPinfo 或 BGP 查询时显示为机房托管（Hosting / Datacenter），例如 Akile (AS61112)、Amazon AWS (AS16509)、Linode 等。
- **后果**：Claude 识别到数据中心 IP，信任分（Trust Score）立刻压低至 60-70 分区间，甚至直接返回 HTTP 403 / 触发账号封禁。
- **根治**：剔除机房托管假节点，锁定在真实的 ISP 住宅宽带节点（如 Frontier Communications / Verizon / AT&T Residential）。

### 2. Mihomo/Clash `nameserver-policy` 通配符缺陷（多级子域名泄露）
- **现象**：虽然在配置中加入了 `*.net.coffee: https://1.1.1.1/dns-query`，但在访问检测站时，DNS 泄露项依然标红，显示为本地运营商（如中国移动 `117.135.x.x`）。
- **底层根因**：
  - 在 Mihomo / Clash.Meta 核心中，通配符语法 `*.domain.com` **仅匹配单级子域名**（如 `a.net.coffee`），**无法递归匹配多级子域名**！
  - 防泄漏检测站点（如 `ip.net.coffee`、`browserleaks.com`）为了击穿本地缓存，会动态生成随机多级子域名（如 `token-1.d.ip.net.coffee`）。
  - 这些多级子域名无法命中 `*.net.coffee`，导致查询回退到默认的国内 `nameserver`，从而向检测服务汇报了国内真实 DNS！
- **根治**：必须使用 Mihomo 专用的**递归通配前缀 `+.` 语法**：
  ```yaml
  nameserver-policy:
    '+.net.coffee': 'https://1.1.1.1/dns-query'
    '+.d.ip.net.coffee': 'https://1.1.1.1/dns-query'
  ```
  `+.` 会递归接管该域名下的所有单级与多级子域名，彻底拦截向国内 DNS 的溢出。

### 3. WebRTC / STUN UDP 裂解泄露
- **现象**：HTTP 流量走住宅节点，但检测报告显示 WebRTC UDP 泄露为另一台机房 IP 或提示“异常”。
- **底层根因**：浏览器 WebRTC 通过 STUN 协议发送 UDP 探测请求来获取公网端点。如果代理规则集漏掉了 STUN 探测域名/端口，或者 STUN 流量被分流到了直连或其他全局中继节点，导致 **HTTP 出口 IP 与 UDP 出口 IP 不一致**（裂解），立刻被标记为代理伪装。
- **根治**：在规则链顶端将 STUN 协议与常用探测服务强制绑定到同一个 AI 出口：
  ```yaml
  rules:
    - DOMAIN-KEYWORD,stun,AI固定家宽出口
    - DOMAIN-SUFFIX,stun.cloudflare.com,AI固定家宽出口
    - DOMAIN-SUFFIX,stun.l.google.com,AI固定家宽出口
  ```

### 4. 国内探针被误代理（中国出口 IPv4 异常）
- **现象**：测试页面中的“中国出口 IPv4”被显示为美国家宽或 AWS IP，导致测试平台判定“环境混杂”。
- **底层根因**：探针站点（如 `ip138.com`、`ip.cn`）被规则集里的 `GEOIP,CN` 延迟分流误伤，或者被全局代理模式劫持。
- **根治**：显式置顶 `DOMAIN-SUFFIX,ip138.com,DIRECT` 和 `DOMAIN-SUFFIX,ip.cn,DIRECT`。

### 5. GUI 客户端覆写与配置持久化
- **现象**：手动修改了 `config.yaml`，但一旦点击 FlClash / Clash Verge 的“刷新配置”或重启客户端，自定义规则和策略全被覆盖清空。
- **根治**：通过客户端脚本引擎（Profile Pre-processor / Mixin Script）在配置构建时动态注入，辅以 SQLite 选中节点持久化与快照备份。

---

## 落地配置最佳实践

### 一、Mihomo / Clash DNS 配置加固模板

完整参考文件：[mihomo-clean-network-snippet.yaml](references/mihomo-clean-network-snippet.yaml)

```yaml
dns:
  enable: true
  listen: 0.0.0.0:1053
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - '*.lan'
    - 'localhost.ptlogin2.qq.com'
    - '+.stun.*'
    - '+.stun.*.*'
    - '+.stun.*.*.*'
  nameserver:
    - 223.5.5.5
    - 119.29.29.29
  fallback:
    - 'https://1.1.1.1/dns-query'
    - 'https://8.8.8.8/dns-query'
  fallback-filter:
    geoip: true
    geoip-code: CN
    ipcidr:
      - 240.0.0.0/4
  nameserver-policy:
    # 核心：使用 +. 语法递归匹配所有层级子域名，杜绝泄露
    '+.net.coffee': 'https://1.1.1.1/dns-query'
    '+.d.ip.net.coffee': 'https://1.1.1.1/dns-query'
    '+.browserleaks.com': 'https://1.1.1.1/dns-query'
    '+.anthropic.com': 'https://1.1.1.1/dns-query'
    '+.claude.ai': 'https://1.1.1.1/dns-query'
    '+.openai.com': 'https://1.1.1.1/dns-query'
    '+.chatgpt.com': 'https://1.1.1.1/dns-query'

tun:
  enable: true
  stack: mixed
  dns-hijack:
    - 'any:53'
    - 'tcp://any:53'
  auto-route: true
  auto-detect-interface: true
  # 核心：防止 Windows 多物理网卡并发解析导致的 DNS 泄露
  strict-route: true
```

---

### 二、分流规则链（Rules）最佳实践

规则匹配遵循“自上而下、先命中先放行”原则，必须严格按照以下优先级编排：

```yaml
rules:
  # 1. 探针隔离层：确保国内探针走真实直连，不污染判定
  - DOMAIN-SUFFIX,ip138.com,DIRECT
  - DOMAIN-SUFFIX,ip.cn,DIRECT

  # 2. WebRTC STUN 绑定层：强制 UDP STUN 探测与 HTTP 走完全相同的出口
  - DOMAIN-KEYWORD,stun,AI固定家宽出口
  - DOMAIN-SUFFIX,stun.cloudflare.com,AI固定家宽出口
  - DOMAIN-SUFFIX,stun.l.google.com,AI固定家宽出口

  # 3. 风险测试平台专用路由：确保测试站本身经 AI 节点加载，防探测分流
  - DOMAIN-SUFFIX,net.coffee,AI固定家宽出口
  - DOMAIN-KEYWORD,net.coffee,AI固定家宽出口

  # 4. AI 核心业务层：精准覆盖 Anthropic & OpenAI 服务群
  - DOMAIN-SUFFIX,anthropic.com,AI固定家宽出口
  - DOMAIN-SUFFIX,claude.ai,AI固定家宽出口
  - DOMAIN-SUFFIX,claude.com,AI固定家宽出口
  - DOMAIN-SUFFIX,clau.de,AI固定家宽出口
  - DOMAIN-SUFFIX,claudemcpclient.com,AI固定家宽出口
  - DOMAIN-SUFFIX,claudemcpcontent.com,AI固定家宽出口
  - DOMAIN-SUFFIX,claudeusercontent.com,AI固定家宽出口
  - DOMAIN,anthropic.com.cdn.cloudflare.net,AI固定家宽出口
  - DOMAIN,anthropic.auth0.com,AI固定家宽出口
  - DOMAIN-SUFFIX,sentry.io,AI固定家宽出口
  - DOMAIN-SUFFIX,statsigapi.net,AI固定家宽出口
  - DOMAIN,browser-intake-us5-datadoghq.com,AI固定家宽出口
  - DOMAIN-SUFFIX,openai.com,AI固定家宽出口
  - DOMAIN-SUFFIX,chatgpt.com,AI固定家宽出口
  - DOMAIN-SUFFIX,oaistatic.com,AI固定家宽出口
  - DOMAIN-SUFFIX,oaiusercontent.com,AI固定家宽出口

  # 5. Anthropic 自有 IP 段 / ASN 兜底（域名失效时的最后防线）
  - IP-CIDR,160.79.104.0/21,AI固定家宽出口,no-resolve
  - IP-CIDR6,2607:6bc0::/32,AI固定家宽出口,no-resolve
  - IP-ASN,399358,AI固定家宽出口,no-resolve

  # 6. 基础分流与兜底
  - GEOIP,LAN,DIRECT,no-resolve
  - GEOIP,CN,DIRECT
  - MATCH,兜底代理
```

完整的 Claude Code 域名表（含 CDN、认证、遥测、第三方 widget）与取舍说明见
[claude-code-rules.yaml](references/claude-code-rules.yaml)。要点：

- Claude Code 不止访问 `claude.ai` 和 `api.anthropic.com`，还会请求 CDN、Auth0 认证、
  Sentry / Statsig / Datadog 遥测。任何一条漏走，遥测 IP 与主请求 IP 不一致，
  本身就是风控信号。
- 遥测域名必须精确匹配：`browser-intake-us5-datadoghq.com` 的根域用连字符，
  不是 `datadoghq.com` 的子域，后缀规则抓不到。
- 域名规则之外再叠加 `160.79.104.0/21`（Anthropic 自有 IPv4）、
  `2607:6bc0::/32`（IPv6）与 `IP-ASN,399358`，覆盖 DNS over HTTPS、ECH/ESNI
  隐藏 SNI、或客户端使用未知新域名的情况。IP 规则放在域名规则之后。
- 这些规则必须排在 `geosite:geolocation-!cn` 等通用规则之前，否则会被通用分流
  截到不同出口，造成同一会话多出口。
- NTP 不默认代理：时区由系统设置决定而非 NTP；把 NTP 塞进不支持 UDP 的节点会
  导致 Windows 时间同步失败。需要 `geosite:category-ntp` 时先确认 UDP 出口可用。

---

### 三、FlClash 预处理脚本持久化（Profile Script）

完整参考文件：[flclash-profile-script.js](references/flclash-profile-script.js)

在 FlClash 中，将订阅生成的配置通过脚本进行二次改写（位于 `scripts/372900000000000001.js`），即可保证在更新订阅时永不丢失自定义策略。

核心 JavaScript 逻辑结构：

```javascript
/**
 * FlClash 配置预处理脚本：剔除机房假住宅，注入纯净家宽与防泄露策略
 */
function main(config) {
  // 1. 过滤机房伪装节点（黑名单剔除关键词）
  const bannedKeywords = ["新谷歌", "机房", "Hosting", "Akile", "AS61112"];
  const allProxies = config.proxies || [];
  
  const cleanResidentialProxies = allProxies.filter(p => {
    return !bannedKeywords.some(bad => p.name.includes(bad));
  });

  // 2. 注入专用代理组
  config["proxy-groups"] = config["proxy-groups"] || [];
  
  // 插入或更新 'AI固定家宽出口'
  const aiGroupName = "AI固定家宽出口";
  const existingGroupIdx = config["proxy-groups"].findIndex(g => g.name === aiGroupName);
  
  const aiGroup = {
    name: aiGroupName,
    type: "select",
    proxies: cleanResidentialProxies.map(p => p.name).filter(n => n.includes("US") || n.includes("美"))
  };

  if (existingGroupIdx >= 0) {
    config["proxy-groups"][existingGroupIdx] = aiGroup;
  } else {
    config["proxy-groups"].unshift(aiGroup);
  }

  // 3. 注入防泄露 DNS 递归策略
  config.dns = config.dns || {};
  config.dns["nameserver-policy"] = Object.assign({}, config.dns["nameserver-policy"], {
    "+.net.coffee": "https://1.1.1.1/dns-query",
    "+.d.ip.net.coffee": "https://1.1.1.1/dns-query",
    "+.browserleaks.com": "https://1.1.1.1/dns-query",
    "+.claude.ai": "https://1.1.1.1/dns-query",
    "+.anthropic.com": "https://1.1.1.1/dns-query"
  });

  // 4. 开启 strict-route 防 Windows 旁路泄露
  if (config.tun) {
    config.tun["strict-route"] = true;
  }

  // 5. 置顶防泄露规则
  const priorityRules = [
    "DOMAIN-SUFFIX,ip138.com,DIRECT",
    "DOMAIN-SUFFIX,ip.cn,DIRECT",
    "DOMAIN-KEYWORD,stun," + aiGroupName,
    "DOMAIN-SUFFIX,stun.cloudflare.com," + aiGroupName,
    "DOMAIN-SUFFIX,net.coffee," + aiGroupName,
    "DOMAIN-SUFFIX,anthropic.com," + aiGroupName,
    "DOMAIN-SUFFIX,claude.ai," + aiGroupName
  ];

  config.rules = [...priorityRules, ...(config.rules || [])];

  return config;
}
```

---

## 验证与验收清单 (Verification Checklist)

完成配置并重启/重载核心后，使用浏览器访问 `https://ip.net.coffee/claude/` 进行全项核验：

| 校验维度 | 验收标准 (PASS) | 典型异常现象与排查 |
|---|---|---|
| **CLAUDE AI 信任评分** | **100 极度纯净 (极度信誉)** | 若为 60-70 分：检查是否选到了机房 ASN，必须换成真实 ISP 住宅 IP |
| **CLAUDE AI 出口 IP 属性** | **家庭住宅 IP (ISP: Frontier / Verizon)** | 若显示 `机房 IP (Hosting)`：节点池中仍有假节点未被剔除 |
| **DNS 泄露检测** | **未检测到泄露**（出口为 Cloudflare / 1.1.1.1） | 若显示 `中国移动/电信/联通 DNS`：检查 `nameserver-policy` 是否漏写 `+.` 递归前缀 |
| **WEBRTC UDP 泄露检测** | **WebRTC 已禁用或无泄露 / 正常**（UDP 出口 IP 与 HTTP 一致） | 若显示 `可能泄露 / 异常`：检查 `DOMAIN-KEYWORD,stun` 规则是否生效，STUN 是否直连 |
| **中国出口 IPv4** | **正常显示本地公网 IP (中国运营商)** | 若显示为海外 IP：检查 `ip138.com` 或国内直连规则是否被全局代理覆盖 |
| **Claude 服务可用性** | **全部正常 (绿色)** | `claude.ai` < 400ms，`anthropic.com` 正常返回 |

---

## 应急排查速查 (Troubleshooting)

1. **DNS 泄露仍然报中国移动/电信？**
   - 检查 Windows 系统网络适配器：是否启用了 IPv6（建议在代理网卡或物理网卡上关闭 IPv6 或开启代理核心的 `ipv6: false`）。
   - 检查 TUN 模式配置：必须确认 `strict-route: true` 已生效，以阻止 Windows Smart Multi-Homed Name Resolution 从物理网卡旁路请求 DNS。
   - 刷新本地 DNS 缓存：在终端执行 `ipconfig /flushdns`。

2. **WebRTC 仍然报错？**
   - 若使用的浏览器带有第三方 WebRTC 防泄露插件，确保插件没有将 UDP 阻断为假阻断状态。
   - 确保代理核心的 UDP 转发开关已开启（`udp: true`）。

3. **客户端切换节点后配置失效？**
   - 检查客户端是否直接重写了 `config.yaml`。若使用 FlClash，请检查 `database.sqlite` 中的 `selected_map` 是否锁定了目标组。
