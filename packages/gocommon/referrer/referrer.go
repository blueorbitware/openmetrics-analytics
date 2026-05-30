package referrer

import (
	"net/url"
	"strings"
)

type Source struct {
	Name     string // e.g., "Google", "Facebook", "ChatGPT"
	Category string // e.g., "search", "social", "ai", "email", "referral"
	Medium   string // e.g., "organic", "paid", "social", "ai"
}

var domainMapping = map[string]Source{
	// Search Engines
	"google.com":     {Name: "Google", Category: "search", Medium: "organic"},
	"google.co":      {Name: "Google", Category: "search", Medium: "organic"},
	"bing.com":       {Name: "Bing", Category: "search", Medium: "organic"},
	"yahoo.com":      {Name: "Yahoo", Category: "search", Medium: "organic"},
	"duckduckgo.com": {Name: "DuckDuckGo", Category: "search", Medium: "organic"},
	"baidu.com":      {Name: "Baidu", Category: "search", Medium: "organic"},
	"yandex.ru":      {Name: "Yandex", Category: "search", Medium: "organic"},
	"yandex.com":     {Name: "Yandex", Category: "search", Medium: "organic"},
	"ecosia.org":     {Name: "Ecosia", Category: "search", Medium: "organic"},
	"brave.com":      {Name: "Brave Search", Category: "search", Medium: "organic"},
	"search.brave.com": {Name: "Brave Search", Category: "search", Medium: "organic"},

	// Social Media - Major Platforms
	"facebook.com":    {Name: "Facebook", Category: "social", Medium: "social"},
	"fb.com":          {Name: "Facebook", Category: "social", Medium: "social"},
	"fb.me":           {Name: "Facebook", Category: "social", Medium: "social"},
	"m.facebook.com":  {Name: "Facebook", Category: "social", Medium: "social"},
	"l.facebook.com":  {Name: "Facebook", Category: "social", Medium: "social"},
	"lm.facebook.com": {Name: "Facebook", Category: "social", Medium: "social"},
	"instagram.com":   {Name: "Instagram", Category: "social", Medium: "social"},
	"l.instagram.com": {Name: "Instagram", Category: "social", Medium: "social"},
	"twitter.com":     {Name: "X (Twitter)", Category: "social", Medium: "social"},
	"x.com":           {Name: "X (Twitter)", Category: "social", Medium: "social"},
	"t.co":            {Name: "X (Twitter)", Category: "social", Medium: "social"},
	"linkedin.com":    {Name: "LinkedIn", Category: "social", Medium: "social"},
	"lnkd.in":         {Name: "LinkedIn", Category: "social", Medium: "social"},

	// Video Platforms
	"youtube.com":    {Name: "YouTube", Category: "video", Medium: "social"},
	"youtu.be":       {Name: "YouTube", Category: "video", Medium: "social"},
	"m.youtube.com":  {Name: "YouTube", Category: "video", Medium: "social"},
	"tiktok.com":     {Name: "TikTok", Category: "video", Medium: "social"},
	"vm.tiktok.com":  {Name: "TikTok", Category: "video", Medium: "social"},
	"vimeo.com":      {Name: "Vimeo", Category: "video", Medium: "social"},
	"twitch.tv":      {Name: "Twitch", Category: "video", Medium: "social"},
	"dailymotion.com": {Name: "Dailymotion", Category: "video", Medium: "social"},

	// Messaging Apps
	"whatsapp.com":      {Name: "WhatsApp", Category: "messaging", Medium: "social"},
	"wa.me":             {Name: "WhatsApp", Category: "messaging", Medium: "social"},
	"api.whatsapp.com":  {Name: "WhatsApp", Category: "messaging", Medium: "social"},
	"web.whatsapp.com":  {Name: "WhatsApp", Category: "messaging", Medium: "social"},
	"telegram.org":      {Name: "Telegram", Category: "messaging", Medium: "social"},
	"t.me":              {Name: "Telegram", Category: "messaging", Medium: "social"},
	"telegram.me":       {Name: "Telegram", Category: "messaging", Medium: "social"},
	"web.telegram.org":  {Name: "Telegram", Category: "messaging", Medium: "social"},
	"messenger.com":     {Name: "Messenger", Category: "messaging", Medium: "social"},
	"m.me":              {Name: "Messenger", Category: "messaging", Medium: "social"},
	"discord.com":       {Name: "Discord", Category: "messaging", Medium: "social"},
	"discord.gg":        {Name: "Discord", Category: "messaging", Medium: "social"},
	"discordapp.com":    {Name: "Discord", Category: "messaging", Medium: "social"},
	"slack.com":         {Name: "Slack", Category: "messaging", Medium: "social"},
	"signal.org":        {Name: "Signal", Category: "messaging", Medium: "social"},
	"viber.com":         {Name: "Viber", Category: "messaging", Medium: "social"},
	"wechat.com":        {Name: "WeChat", Category: "messaging", Medium: "social"},
	"weixin.qq.com":     {Name: "WeChat", Category: "messaging", Medium: "social"},
	"line.me":           {Name: "LINE", Category: "messaging", Medium: "social"},
	"snapchat.com":      {Name: "Snapchat", Category: "messaging", Medium: "social"},

	// AI Platforms & Assistants
	"chat.openai.com":   {Name: "ChatGPT", Category: "ai", Medium: "ai"},
	"chatgpt.com":       {Name: "ChatGPT", Category: "ai", Medium: "ai"},
	"openai.com":        {Name: "OpenAI", Category: "ai", Medium: "ai"},
	"claude.ai":         {Name: "Claude", Category: "ai", Medium: "ai"},
	"anthropic.com":     {Name: "Anthropic", Category: "ai", Medium: "ai"},
	"perplexity.ai":     {Name: "Perplexity", Category: "ai", Medium: "ai"},
	"bard.google.com":   {Name: "Google Bard", Category: "ai", Medium: "ai"},
	"gemini.google.com": {Name: "Google Gemini", Category: "ai", Medium: "ai"},
	"copilot.microsoft.com": {Name: "Microsoft Copilot", Category: "ai", Medium: "ai"},
	"bing.com/chat":     {Name: "Bing Chat", Category: "ai", Medium: "ai"},
	"character.ai":      {Name: "Character.AI", Category: "ai", Medium: "ai"},
	"poe.com":           {Name: "Poe", Category: "ai", Medium: "ai"},
	"you.com":           {Name: "You.com", Category: "ai", Medium: "ai"},
	"phind.com":         {Name: "Phind", Category: "ai", Medium: "ai"},
	"kagi.com":          {Name: "Kagi", Category: "ai", Medium: "ai"},
	"jasper.ai":         {Name: "Jasper", Category: "ai", Medium: "ai"},
	"writesonic.com":    {Name: "Writesonic", Category: "ai", Medium: "ai"},
	"copy.ai":           {Name: "Copy.ai", Category: "ai", Medium: "ai"},
	"notion.so":         {Name: "Notion AI", Category: "ai", Medium: "ai"},
	"midjourney.com":    {Name: "Midjourney", Category: "ai", Medium: "ai"},
	"huggingface.co":    {Name: "Hugging Face", Category: "ai", Medium: "ai"},
	"replicate.com":     {Name: "Replicate", Category: "ai", Medium: "ai"},
	"stability.ai":      {Name: "Stability AI", Category: "ai", Medium: "ai"},
	"runwayml.com":      {Name: "Runway", Category: "ai", Medium: "ai"},
	"cursor.sh":         {Name: "Cursor", Category: "ai", Medium: "ai"},
	"cursor.com":        {Name: "Cursor", Category: "ai", Medium: "ai"},
	"replit.com":        {Name: "Replit", Category: "ai", Medium: "ai"},
	"github.com/copilot": {Name: "GitHub Copilot", Category: "ai", Medium: "ai"},
	"codeium.com":       {Name: "Codeium", Category: "ai", Medium: "ai"},
	"tabnine.com":       {Name: "Tabnine", Category: "ai", Medium: "ai"},

	// Other Social Platforms
	"pinterest.com":  {Name: "Pinterest", Category: "social", Medium: "social"},
	"pin.it":         {Name: "Pinterest", Category: "social", Medium: "social"},
	"reddit.com":     {Name: "Reddit", Category: "social", Medium: "social"},
	"redd.it":        {Name: "Reddit", Category: "social", Medium: "social"},
	"tumblr.com":     {Name: "Tumblr", Category: "social", Medium: "social"},
	"quora.com":      {Name: "Quora", Category: "social", Medium: "social"},
	"medium.com":     {Name: "Medium", Category: "social", Medium: "social"},
	"threads.net":    {Name: "Threads", Category: "social", Medium: "social"},
	"mastodon.social": {Name: "Mastodon", Category: "social", Medium: "social"},
	"bsky.app":       {Name: "Bluesky", Category: "social", Medium: "social"},

	// News & Content
	"news.ycombinator.com": {Name: "Hacker News", Category: "news", Medium: "referral"},
	"producthunt.com":      {Name: "Product Hunt", Category: "news", Medium: "referral"},
	"slashdot.org":         {Name: "Slashdot", Category: "news", Medium: "referral"},
	"digg.com":             {Name: "Digg", Category: "news", Medium: "referral"},
	"flipboard.com":        {Name: "Flipboard", Category: "news", Medium: "referral"},
	"feedly.com":           {Name: "Feedly", Category: "news", Medium: "referral"},
	"pocket.com":           {Name: "Pocket", Category: "news", Medium: "referral"},
	"getpocket.com":        {Name: "Pocket", Category: "news", Medium: "referral"},

	// Developer & Tech
	"github.com":      {Name: "GitHub", Category: "developer", Medium: "referral"},
	"gitlab.com":      {Name: "GitLab", Category: "developer", Medium: "referral"},
	"stackoverflow.com": {Name: "Stack Overflow", Category: "developer", Medium: "referral"},
	"dev.to":          {Name: "DEV Community", Category: "developer", Medium: "referral"},
	"hashnode.com":    {Name: "Hashnode", Category: "developer", Medium: "referral"},
	"npmjs.com":       {Name: "npm", Category: "developer", Medium: "referral"},
	"pypi.org":        {Name: "PyPI", Category: "developer", Medium: "referral"},

	// Email Providers (when clicked from webmail)
	"mail.google.com": {Name: "Gmail", Category: "email", Medium: "email"},
	"outlook.live.com": {Name: "Outlook", Category: "email", Medium: "email"},
	"outlook.office.com": {Name: "Outlook", Category: "email", Medium: "email"},
	"mail.yahoo.com":  {Name: "Yahoo Mail", Category: "email", Medium: "email"},
	"mail.proton.me":  {Name: "ProtonMail", Category: "email", Medium: "email"},
	"protonmail.com":  {Name: "ProtonMail", Category: "email", Medium: "email"},

	// Shopping / Marketplaces
	"amazon.com":   {Name: "Amazon", Category: "shopping", Medium: "referral"},
	"amazon.co":    {Name: "Amazon", Category: "shopping", Medium: "referral"},
	"ebay.com":     {Name: "eBay", Category: "shopping", Medium: "referral"},
	"etsy.com":     {Name: "Etsy", Category: "shopping", Medium: "referral"},
	"shopify.com":  {Name: "Shopify", Category: "shopping", Medium: "referral"},
	"aliexpress.com": {Name: "AliExpress", Category: "shopping", Medium: "referral"},

	// Advertising Platforms
	"googleads.g.doubleclick.net": {Name: "Google Ads", Category: "advertising", Medium: "paid"},
	"ad.doubleclick.net":          {Name: "Google Ads", Category: "advertising", Medium: "paid"},
	"pagead2.googlesyndication.com": {Name: "Google Ads", Category: "advertising", Medium: "paid"},
	"ads.google.com":              {Name: "Google Ads", Category: "advertising", Medium: "paid"},
}

func Parse(referrerURL string) Source {
	if referrerURL == "" {
		return Source{Name: "Direct", Category: "direct", Medium: "none"}
	}

	parsed, err := url.Parse(referrerURL)
	if err != nil || parsed.Host == "" {
		return Source{Name: "Direct", Category: "direct", Medium: "none"}
	}

	host := strings.ToLower(parsed.Host)
	host = strings.TrimPrefix(host, "www.")

	// Check exact match first
	if source, ok := domainMapping[host]; ok {
		return source
	}

	// Check if path contains AI chat indicators (for platforms with /chat paths)
	pathLower := strings.ToLower(parsed.Path)
	if strings.Contains(pathLower, "/chat") {
		if strings.Contains(host, "bing.com") {
			return Source{Name: "Bing Chat", Category: "ai", Medium: "ai"}
		}
	}

	// Check partial matches for subdomains
	for domain, source := range domainMapping {
		if strings.HasSuffix(host, "."+domain) || strings.HasSuffix(host, domain) {
			return source
		}
	}

	// Check for country-specific Google domains (google.co.uk, google.de, etc.)
	if strings.HasPrefix(host, "google.") || strings.Contains(host, ".google.") {
		return Source{Name: "Google", Category: "search", Medium: "organic"}
	}

	// Check for country-specific Amazon domains
	if strings.HasPrefix(host, "amazon.") || strings.Contains(host, ".amazon.") {
		return Source{Name: "Amazon", Category: "shopping", Medium: "referral"}
	}

	// Unknown referrer - treat as referral
	return Source{Name: extractDomain(host), Category: "referral", Medium: "referral"}
}

func extractDomain(host string) string {
	parts := strings.Split(host, ".")
	if len(parts) >= 2 {
		// Return the main domain name capitalized
		domain := parts[len(parts)-2]
		if len(domain) > 0 {
			return strings.ToUpper(string(domain[0])) + domain[1:]
		}
	}
	return host
}

// DetectFromUTM overrides source detection based on UTM parameters
func DetectFromUTM(utm map[string]string, detected Source) Source {
	if utm == nil {
		return detected
	}

	// If utm_source is present, use it to override
	if source, ok := utm["source"]; ok && source != "" {
		detected.Name = normalizeSourceName(source)
		
		// Try to determine category from source name
		sourceLower := strings.ToLower(source)
		detected.Category = categorizeFromName(sourceLower)
	}

	// If utm_medium is present, use it
	if medium, ok := utm["medium"]; ok && medium != "" {
		detected.Medium = strings.ToLower(medium)
		
		// Update category based on medium
		switch strings.ToLower(medium) {
		case "cpc", "ppc", "paid", "paidsearch", "paid_search":
			detected.Category = "advertising"
			detected.Medium = "paid"
		case "social", "social-media":
			detected.Category = "social"
			detected.Medium = "social"
		case "email", "newsletter":
			detected.Category = "email"
			detected.Medium = "email"
		case "affiliate":
			detected.Category = "affiliate"
			detected.Medium = "affiliate"
		case "organic":
			detected.Medium = "organic"
		case "referral":
			detected.Category = "referral"
			detected.Medium = "referral"
		}
	}

	// If utm_campaign has certain keywords
	if campaign, ok := utm["campaign"]; ok {
		campaignLower := strings.ToLower(campaign)
		if strings.Contains(campaignLower, "email") || strings.Contains(campaignLower, "newsletter") {
			detected.Category = "email"
			detected.Medium = "email"
		}
	}

	return detected
}

func normalizeSourceName(source string) string {
	sourceLower := strings.ToLower(source)
	
	nameMap := map[string]string{
		"google":     "Google",
		"facebook":   "Facebook",
		"fb":         "Facebook",
		"instagram":  "Instagram",
		"ig":         "Instagram",
		"twitter":    "X (Twitter)",
		"x":          "X (Twitter)",
		"linkedin":   "LinkedIn",
		"youtube":    "YouTube",
		"yt":         "YouTube",
		"tiktok":     "TikTok",
		"whatsapp":   "WhatsApp",
		"telegram":   "Telegram",
		"chatgpt":    "ChatGPT",
		"openai":     "OpenAI",
		"claude":     "Claude",
		"perplexity": "Perplexity",
		"bing":       "Bing",
		"reddit":     "Reddit",
		"pinterest":  "Pinterest",
		"snapchat":   "Snapchat",
		"discord":    "Discord",
		"slack":      "Slack",
		"medium":     "Medium",
		"quora":      "Quora",
	}

	if normalized, ok := nameMap[sourceLower]; ok {
		return normalized
	}

	// Capitalize first letter
	if len(source) > 0 {
		return strings.ToUpper(string(source[0])) + source[1:]
	}
	return source
}

func categorizeFromName(sourceLower string) string {
	socialPlatforms := []string{"facebook", "fb", "instagram", "ig", "twitter", "x", "linkedin", "tiktok", "snapchat", "pinterest", "reddit", "tumblr", "threads", "mastodon"}
	searchEngines := []string{"google", "bing", "yahoo", "duckduckgo", "baidu", "yandex"}
	aiPlatforms := []string{"chatgpt", "openai", "claude", "anthropic", "perplexity", "gemini", "bard", "copilot", "poe", "phind"}
	videoPlatforms := []string{"youtube", "yt", "tiktok", "vimeo", "twitch"}
	messagingPlatforms := []string{"whatsapp", "telegram", "messenger", "discord", "slack", "signal", "viber", "wechat", "line"}

	for _, p := range aiPlatforms {
		if strings.Contains(sourceLower, p) {
			return "ai"
		}
	}
	for _, p := range socialPlatforms {
		if strings.Contains(sourceLower, p) {
			return "social"
		}
	}
	for _, p := range searchEngines {
		if strings.Contains(sourceLower, p) {
			return "search"
		}
	}
	for _, p := range videoPlatforms {
		if strings.Contains(sourceLower, p) {
			return "video"
		}
	}
	for _, p := range messagingPlatforms {
		if strings.Contains(sourceLower, p) {
			return "messaging"
		}
	}

	return "referral"
}
