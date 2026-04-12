# Privacy Policy for Smart Bookmarks / Smart Bookmarks 隐私政策

**Last Updated / 最后更新:** February 2026

---

## 1. Operator / 运营者

Smart Bookmarks is developed and operated by **OrangeDuck** ("we", "us", "our"). Our website is [scamlens.org](https://scamlens.org).

Smart Bookmarks 由 **OrangeDuck**（"我们"）开发和运营。我们的网站是 [scamlens.org](https://scamlens.org)。

---

## 2. Overview / 概述

Smart Bookmarks is a Chrome extension for AI-powered bookmark management, domain intelligence, and scam detection. This privacy policy explains how your data is collected, used, stored, and protected across all features of the extension and its associated backend services.

Smart Bookmarks 是一款基于 AI 的 Chrome 书签管理、域名情报和诈骗检测扩展。本隐私政策说明扩展及其关联后端服务如何收集、使用、存储和保护您的数据。

---

## 3. Account Data / 账户数据

When you create an account or sign in, we collect and store the following information on our servers:

当您创建账户或登录时，我们在服务器上收集并存储以下信息：

- **Email address** — used for authentication and account recovery / **电子邮箱** — 用于身份验证和账户恢复
- **Display name** — chosen by you, shown in community features / **显示名称** — 由您选择，用于社区功能
- **Hashed password** — if you register with email/password; we never store plaintext passwords / **哈希密码** — 如果您使用邮箱/密码注册；我们从不存储明文密码
- **OAuth profile information** — if you sign in with Google (name, email, profile picture URL as provided by Google) / **OAuth 个人资料** — 如果您使用 Google 登录（Google 提供的姓名、邮箱、头像 URL）
- **JWT tokens and refresh tokens** — used to maintain your authenticated session / **JWT 令牌和刷新令牌** — 用于维持您的登录会话
- **Subscription and plan information** — your current plan tier and subscription status / **订阅和计划信息** — 您当前的计划级别和订阅状态

---

## 4. Data Collection and Transmission / 数据收集与传输

### 4.1 Proxy Backend (Default Mode) / 代理后端（默认模式）

By default, when you save a bookmark with AI features enabled, the following data is sent to our backend server at `api.scamlens.org`:

默认情况下，当您在启用 AI 功能的情况下保存书签时，以下数据将发送到我们的后端服务器 `api.scamlens.org`：

- **Page content** truncated to 4,000 characters / 截断至 4,000 字符的**页面内容**
- **Page title** / **页面标题**
- **Domain name** / **域名**

Our backend processes this data to provide AI summarization, translation, and classification. The backend forwards the content to AI providers (currently Anthropic Claude) on your behalf, so you do not need your own API key. Content is processed in transit and is not permanently stored on our servers beyond what is necessary for caching and rate limiting.

我们的后端处理这些数据以提供 AI 摘要、翻译和分类。后端代您将内容转发给 AI 供应商（目前为 Anthropic Claude），因此您无需自己的 API 密钥。内容在传输中处理，除缓存和速率限制所需外，不会永久存储在我们的服务器上。

### 4.2 Direct AI Mode (User-Configured) / 直接 AI 模式（用户配置）

If you provide your own API key in the extension settings, you can choose to send content directly to your chosen AI provider instead of through our proxy backend. In this mode, page content (truncated to 4,000 characters) and the page title are sent directly from your browser to the provider's API. The extension supports the following providers:

如果您在扩展设置中提供自己的 API 密钥，可以选择将内容直接发送到您选择的 AI 供应商，而非通过我们的代理后端。在此模式下，页面内容（截断至 4,000 字符）和页面标题将直接从您的浏览器发送到供应商的 API。扩展支持以下供应商：

| Provider / 供应商 | Endpoint / 端点 | Privacy Policy / 隐私政策 |
|---|---|---|
| Anthropic Claude | api.anthropic.com | [anthropic.com/privacy](https://www.anthropic.com/privacy) |
| OpenAI | api.openai.com | [openai.com/privacy](https://openai.com/privacy) |
| Google Gemini | generativelanguage.googleapis.com | [policies.google.com/privacy](https://policies.google.com/privacy) |
| Grok (xAI) | api.x.ai | [x.ai/legal/privacy-policy](https://x.ai/legal/privacy-policy) |
| Custom Provider / 自定义供应商 | User-configured / 用户配置 | Varies / 各有不同 |

Your API keys are stored locally on your device and are never sent to our servers.

您的 API 密钥存储在您的本地设备上，绝不会发送到我们的服务器。

### 4.3 Embedding Generation / 向量嵌入生成

After you save a bookmark while logged in, the bookmark's text content is automatically sent to our backend to generate search vectors (embeddings). These embeddings enable semantic search across your bookmarks. This feature is active only when you are logged in. You can disable embedding generation in the extension settings.

当您在登录状态下保存书签后，书签的文本内容会自动发送到我们的后端以生成搜索向量（嵌入）。这些嵌入使您可以对书签进行语义搜索。此功能仅在您登录时启用。您可以在扩展设置中禁用嵌入生成。

### 4.4 Cloud Backup / 云端备份

You can optionally create encrypted cloud backups of your bookmark data, stored on our servers using Cloudflare R2 object storage. Your data is encrypted before it leaves your device. We cannot read the contents of your encrypted backups. You manage your own backups and can delete them at any time through the extension.

您可以选择创建书签数据的加密云端备份，存储在我们使用 Cloudflare R2 对象存储的服务器上。您的数据在离开设备之前即已加密。我们无法读取您加密备份的内容。您可以自行管理备份，并随时通过扩展删除它们。

### 4.5 Domain Intelligence (RDAP Lookups) / 域名情报（RDAP 查询）

When you use domain intelligence features, the extension performs RDAP (Registration Data Access Protocol) lookups to retrieve public domain registration information. These lookups involve:

当您使用域名情报功能时，扩展会执行 RDAP（注册数据访问协议）查询以获取公开的域名注册信息。这些查询涉及：

- A request to `data.iana.org` to determine the appropriate RDAP bootstrap server / 向 `data.iana.org` 发送请求以确定适当的 RDAP 引导服务器
- A request to the third-party RDAP registry server for the domain's registration data / 向第三方 RDAP 注册服务器请求域名的注册数据

The domain name you are querying is sent to these third-party servers. RDAP responses contain only publicly available registration data.

您查询的域名将被发送到这些第三方服务器。RDAP 响应仅包含公开可用的注册数据。

### 4.6 Google Favicon Service / Google 图标服务

The extension fetches website icons from Google's favicon service at `google.com/s2/favicons`. This sends the domain name of bookmarked websites to Google to retrieve the corresponding favicon image.

扩展从 Google 的图标服务 `google.com/s2/favicons` 获取网站图标。这会将书签网站的域名发送给 Google 以获取相应的网站图标。

### 4.7 Health Checks / 健康检查

The extension periodically makes HTTP HEAD requests to your bookmarked URLs to verify they are still accessible. Only the request headers are sent; no page content is downloaded or transmitted to our servers. The accessibility status is stored locally on your device.

扩展定期对您的书签 URL 发送 HTTP HEAD 请求以验证其可访问性。仅发送请求头；不会下载或传输任何页面内容到我们的服务器。可访问状态存储在您的本地设备上。

### 4.8 Screenshot Capture / 截图捕获

When configured for L3 (full snapshot) mode, the extension uses Chrome's `captureVisibleTab` API to capture a screenshot of the currently visible page. These screenshots are stored locally in IndexedDB on your device as part of bookmark snapshots. Screenshots are never uploaded to our servers.

当配置为 L3（完整快照）模式时，扩展使用 Chrome 的 `captureVisibleTab` API 捕获当前可见页面的截图。这些截图作为书签快照的一部分存储在您设备上的 IndexedDB 中。截图绝不会上传到我们的服务器。

### 4.9 Google OAuth / Google OAuth 认证

If you choose to sign in with Google, the extension redirects you to `accounts.google.com` for authentication. Google provides us with your name, email address, and profile picture URL upon successful authentication. We do not receive your Google password. Google's privacy policy governs data collected during the OAuth flow: [policies.google.com/privacy](https://policies.google.com/privacy).

如果您选择使用 Google 登录，扩展会将您重定向到 `accounts.google.com` 进行身份验证。Google 在成功验证后向我们提供您的姓名、电子邮箱和头像 URL。我们不会获取您的 Google 密码。Google 在 OAuth 流程中收集的数据受其隐私政策管辖：[policies.google.com/privacy](https://policies.google.com/privacy)。

---

## 5. Local Data Storage / 本地数据存储

The majority of your data is stored locally on your device and never leaves it. Local storage mechanisms include:

您的大部分数据存储在您的本地设备上且不会离开设备。本地存储机制包括：

- **chrome.storage.local** — extension settings, preferences, cached data / 扩展设置、偏好、缓存数据
- **IndexedDB (via Dexie.js)** — bookmark records, AI-generated summaries, tags, categories, page snapshots, screenshots / 书签记录、AI 生成的摘要、标签、分类、页面快照、截图

Locally stored data includes:

本地存储的数据包括：

- All bookmark data (URLs, titles, summaries, tags, categories, notes) / 所有书签数据（URL、标题、摘要、标签、分类、笔记）
- User preferences (language, theme, snapshot level, folder organization) / 用户偏好（语言、主题、快照级别、文件夹组织）
- API keys for direct AI mode (if configured) / 直接 AI 模式的 API 密钥（如已配置）
- Page snapshots and screenshots / 页面快照和截图
- Health check results / 健康检查结果

---

## 6. Data We Do NOT Collect / 我们不收集的数据

- **Browsing history** — we only process pages you explicitly save as bookmarks / **浏览历史** — 我们仅处理您明确保存为书签的页面
- **Analytics or telemetry data** — we do not use any analytics services / **分析或遥测数据** — 我们不使用任何分析服务
- **Advertising data** — we do not serve ads or use advertising trackers / **广告数据** — 我们不投放广告或使用广告追踪器
- **Third-party tracking** — no tracking pixels, fingerprinting, or behavioral profiling / **第三方跟踪** — 无跟踪像素、指纹识别或行为分析

---

## 7. Data Security / 数据安全

We take the following measures to protect your data:

我们采取以下措施保护您的数据：

- **HTTPS for all external communications** — all data transmitted between the extension and our backend, AI providers, RDAP servers, and other external services uses HTTPS encryption / **所有外部通信均使用 HTTPS** — 扩展与我们的后端、AI 供应商、RDAP 服务器及其他外部服务之间传输的所有数据均使用 HTTPS 加密
- **Password hashing** — passwords are hashed before storage; we never store or transmit plaintext passwords / **密码哈希** — 密码在存储前进行哈希处理；我们从不存储或传输明文密码
- **Local API key storage** — your API keys never leave your device / **本地 API 密钥存储** — 您的 API 密钥绝不离开您的设备
- **Encrypted cloud backups** — backup data is encrypted on your device before upload / **加密云端备份** — 备份数据在上传前于您的设备上加密
- **No remote code execution** — the extension does not execute remotely loaded code / **无远程代码执行** — 扩展不执行远程加载的代码

---

## 8. Third-Party Services / 第三方服务

This extension interacts with the following external services:

本扩展与以下外部服务交互：

| Service / 服务 | Purpose / 用途 | Data Sent / 发送的数据 |
|---|---|---|
| Our backend (`api.scamlens.org`) | AI proxy, embeddings, auth, cloud backup | Page content, titles, domains, account data / 页面内容、标题、域名、账户数据 |
| Anthropic, OpenAI, Google, xAI (Direct AI mode) | AI summarization (user-configured) | Page content, titles / 页面内容、标题 |
| Google OAuth (`accounts.google.com`) | Authentication / 身份验证 | OAuth credentials / OAuth 凭据 |
| Google Favicon Service (`google.com/s2/favicons`) | Website icons / 网站图标 | Domain names / 域名 |
| IANA (`data.iana.org`) + RDAP registry servers | Domain intelligence / 域名情报 | Domain names / 域名 |
| Bookmarked URLs | Health checks / 健康检查 | HEAD requests only / 仅 HEAD 请求 |
| Cloudflare R2 (via our backend) | Encrypted cloud backup storage / 加密云端备份存储 | Encrypted backup data / 加密的备份数据 |

No analytics, advertising, or tracking services are used.

不使用任何分析、广告或跟踪服务。

---

## 9. Data Retention / 数据保留

- **Local data** — stored on your device until you delete it or uninstall the extension / **本地数据** — 存储在您的设备上，直至您删除或卸载扩展
- **Account data** — stored on our servers until you request account deletion / **账户数据** — 存储在我们的服务器上，直至您请求删除账户
- **Cloud backups** — stored on our servers per your management; you can delete backups at any time through the extension / **云端备份** — 按您的管理存储在我们的服务器上；您可以随时通过扩展删除备份
- **AI processing data** — content sent for AI summarization and embedding generation is processed in transit and is not permanently retained beyond operational caching / **AI 处理数据** — 发送用于 AI 摘要和嵌入生成的内容在传输中处理，除运营缓存外不会永久保留

---

## 10. User Rights / 用户权利

You have the right to / 您有权：

- **Export** all your bookmark data in JSON or HTML format / **导出**所有书签数据（JSON 或 HTML 格式）
- **Delete** all local data via Settings / **删除**所有本地数据（通过设置）
- **Uninstall** the extension to remove all locally stored data / **卸载**扩展以删除所有本地存储的数据
- **Use the extension without AI features** — you can disable AI summarization entirely / **在不使用 AI 功能的情况下使用扩展** — 您可以完全禁用 AI 摘要
- **Disable embedding generation** in the extension settings / 在扩展设置中**禁用嵌入生成**
- **Delete cloud backups** at any time through the extension / 随时通过扩展**删除云端备份**
- **Request account deletion** by contacting us at [wayne@wayjet.io](mailto:wayne@wayjet.io) or through your account settings / 通过联系 [wayne@wayjet.io](mailto:wayne@wayjet.io) 或通过账户设置**请求删除账户**

---

## 11. Children's Privacy / 儿童隐私

Smart Bookmarks is not intended for use by children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us at [wayne@wayjet.io](mailto:wayne@wayjet.io) so we can delete that information.

Smart Bookmarks 不适用于 13 岁以下的儿童。我们不会有意收集 13 岁以下儿童的个人信息。如果您认为 13 岁以下的儿童向我们提供了个人信息，请联系 [wayne@wayjet.io](mailto:wayne@wayjet.io)，以便我们删除该信息。

---

## 12. Changes to This Policy / 政策变更

We may update this privacy policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. Changes will be reflected in the "Last Updated" date at the top of this document. We encourage you to review this policy periodically. Continued use of the extension after changes constitutes acceptance of the updated policy.

我们可能会不时更新本隐私政策，以反映我们实践中的变化或其他运营、法律或监管原因。更改将反映在本文档顶部的"最后更新"日期中。我们鼓励您定期查阅本政策。在政策变更后继续使用扩展即表示接受更新后的政策。

---

## 13. Contact / 联系方式

For privacy-related questions, concerns, or requests, please contact us:

如有隐私相关问题、顾虑或请求，请联系我们：

- **Email / 邮箱:** [wayne@wayjet.io](mailto:wayne@wayjet.io)
- **Website / 网站:** [scamlens.org](https://scamlens.org)
- **Operator / 运营者:** OrangeDuck

---

## 14. Consent / 同意

By installing and using Smart Bookmarks, you consent to the collection and use of your data as described in this privacy policy.

安装和使用 Smart Bookmarks 即表示您同意按照本隐私政策所述收集和使用您的数据。
