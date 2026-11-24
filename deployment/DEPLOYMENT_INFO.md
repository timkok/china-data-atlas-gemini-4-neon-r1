# Deployment Information — China Data Atlas (Gemini 4 Neon · R1)

## 1. 独立代码仓库与分支隔离（GitHub）
- **Repository URL**：https://github.com/timkok/china-data-atlas-gemini-4-neon-r1
- **GitHub Account**：`timkok`
- **Default Branch**：`main`
- **Development Branch**：`feat/r1-china-data-atlas`
- **Pull Request URL**：https://github.com/timkok/china-data-atlas-gemini-4-neon-r1/pull/1
- **GitHub Actions CI**：`.github/workflows/ci.yml`（Python Data Quality Gate + pytest + Next.js Typecheck + Vitest + Production Build，均已在 PR #1 运行通过）
- **隔离声明**：全新独立仓库，未访问、修改或覆盖任何其他模型或用户现有项目。

## 2. 独立线上部署与验证（Vercel）
- **Vercel Project**：`timkok621-1320/china-data-atlas-gemini-4-neon-r1`（全新独立项目，Hobby 免费套餐）
- **Public Live / Preview URL**：https://china-data-atlas-gemini-4-neon-r1.vercel.app
- **Immutable Deployment URL**：https://china-data-atlas-gemini-4-neon-r1-9zzom7hub-timkok621-1320.vercel.app
- **Vercel Inspect URL**：https://vercel.com/timkok621-1320/china-data-atlas-gemini-4-neon-r1/7r9XrKAeNUkjoYwVsgBFtNa5pEgU
- **Deployment Protection**：无访问阻断，公网匿名直接返回 HTTP 200。

### 线上实际验证结果（2026-11-24 UTC）
1. **HTTP 连通性验证**：
   - `GET /` → **200**
   - `GET /indicators/population` → **200**
   - `GET /indicators/gdp_per_capita` → **200**
   - `GET /indicators/population_65plus` → **200**
   - `GET /explore` → **200**
   - `GET /methodology` → **200**
   - `GET /data/observations.csv` → **200**
   - `GET /data/data-dictionary.json` → **200**
   - `GET /sitemap.xml` → **200**
   - `GET /robots.txt` → **200**
2. **线上真实浏览器端到端回归（Playwright Chromium）**：
   - 执行命令：`E2E_BASE_URL=https://china-data-atlas-gemini-4-neon-r1.vercel.app npx playwright test`
   - 结果：**12 / 12 用例全部通过（20.3s）**，涵盖全部 **10 / 10 统一用户验收任务（Task A–J）**、Desktop (1440px) / Tablet (768px) / Mobile (390px) 零横向溢出、ECharts 图表渲染、筛选同步 CSV 实际下载校验以及浏览器控制台零报错。
3. **凭据与安全声明**：
   - 部署后已清理本地临时 `.env.local`（`VERCEL_OIDC_TOKEN`），未提交任何 API Key、凭据或私人数据至 GitHub、ZIP 或 Google Drive。

## 3. Google Drive 统一交付位置
- **Model Subfolder**：`China Data Atlas - Gemini 4 Neon`
- **Drive Folder URL**：https://drive.google.com/drive/folders/1QRtc23mP3sGLekDyMqWw_Te7jC9Y0T3G
- **Parent Folder**：`China Data Atlas AI Comparison` (`1jBQSNOjLmc815L7nkxruelvxLV5y7PKg`)
- **隔离声明**：仅创建并写入本模型专属子文件夹，未读取或访问任何其他模型文件夹。
