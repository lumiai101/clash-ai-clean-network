/**
 * FlClash / Clash Verge Profile Pre-processor Script
 * 作用：剔除假住宅/机房托管节点、注入递归防泄露 DNS 策略与置顶关键分流规则
 */
function main(config) {
  // 1. 过滤假原生与机房漂移节点关键词
  const bannedKeywords = ["新谷歌", "机房", "Hosting", "Akile", "AS61112", "直连"];
  const allProxies = config.proxies || [];
  
  const cleanProxies = allProxies.filter(p => {
    return !bannedKeywords.some(bad => p.name.includes(bad));
  });

  // 2. 注入专用住宅代理组
  config["proxy-groups"] = config["proxy-groups"] || [];
  const aiGroupName = "AI固定家宽出口";
  const existingIdx = config["proxy-groups"].findIndex(g => g.name === aiGroupName);
  
  const aiGroup = {
    name: aiGroupName,
    type: "select",
    proxies: cleanProxies.map(p => p.name).filter(n => n.includes("US") || n.includes("美") || n.includes("加州"))
  };

  if (existingIdx >= 0) {
    config["proxy-groups"][existingIdx] = aiGroup;
  } else {
    config["proxy-groups"].unshift(aiGroup);
  }

  // 3. 注入递归通配防 DNS 泄露策略
  config.dns = config.dns || {};
  config.dns["nameserver-policy"] = Object.assign({}, config.dns["nameserver-policy"], {
    "+.net.coffee": "https://1.1.1.1/dns-query",
    "+.d.ip.net.coffee": "https://1.1.1.1/dns-query",
    "+.browserleaks.com": "https://1.1.1.1/dns-query",
    "+.anthropic.com": "https://1.1.1.1/dns-query",
    "+.claude.ai": "https://1.1.1.1/dns-query",
    "+.openai.com": "https://1.1.1.1/dns-query",
    "+.chatgpt.com": "https://1.1.1.1/dns-query"
  });

  // 4. 强制启用 TUN 严格路由防多网卡泄漏
  if (config.tun) {
    config.tun["strict-route"] = true;
  }

  // 5. 置顶防泄露与探针隔离规则
  const priorityRules = [
    "DOMAIN-SUFFIX,ip138.com,DIRECT",
    "DOMAIN-SUFFIX,ip.cn,DIRECT",
    "DOMAIN-KEYWORD,stun," + aiGroupName,
    "DOMAIN-SUFFIX,stun.cloudflare.com," + aiGroupName,
    "DOMAIN-SUFFIX,stun.l.google.com," + aiGroupName,
    "DOMAIN-SUFFIX,net.coffee," + aiGroupName,
    "DOMAIN-KEYWORD,net.coffee," + aiGroupName,
    "DOMAIN-SUFFIX,anthropic.com," + aiGroupName,
    "DOMAIN-SUFFIX,claude.ai," + aiGroupName,
    "DOMAIN-SUFFIX,openai.com," + aiGroupName,
    "DOMAIN-SUFFIX,chatgpt.com," + aiGroupName
  ];

  config.rules = [...priorityRules, ...(config.rules || [])];

  return config;
}
