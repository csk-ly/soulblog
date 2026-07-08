# AGENTS.md

## 常用命令
- 优先用 `pnpm i` 安装依赖；仓库里同时有 `pnpm-lock.yaml` 和 `package-lock.json`，但 README 和 Cloudflare 构建配置都使用 pnpm。
- 本地开发：`pnpm dev`，实际执行 `next dev --turbopack -p 2025`。
- 生产构建：`pnpm build`。Next 16 要求 Node `>=20.9`，Node 18 会在编译前直接失败。
- Cloudflare 构建/预览/部署：`pnpm build:cf`、`pnpm preview`、`pnpm deploy`；`wrangler.toml` 里的 build command 也是 `pnpm run build:cf`。
- 生成 Cloudflare 环境类型：`pnpm cf-typegen`。
- 生成 SVG 索引：`pnpm svg`；该脚本会启动 watcher 并写入 `src/svgs/index.ts`。
- `package.json` 没有 lint、test、typecheck 脚本；除非任务另有要求，否则用 `pnpm build` 做主要验证。

## 应用结构
- 这是 Next App Router 项目。根布局在 `src/app/layout.tsx`；通用外壳、背景、导航、音乐卡片在 `src/layout/index.tsx`。
- 首页在 `src/app/(home)`，各个首页卡片是同级的 `*-card.tsx` 文件；全局导航卡片在 `src/components/nav-card.tsx`。
- 站点内容和主题来自 JSON，不是 CMS：`src/config/site-content.json`、`src/config/card-styles.json`、`src/config/card-styles-default.json`。
- 博客内容是文件驱动：`public/blogs/<slug>/index.md` 加 `config.json`；列表来源是 `public/blogs/index.json`。

## GitHub 驱动的前端编辑
- 前端编辑流程会通过 GitHub App 直接提交到 GitHub，核心封装在 `src/lib/github-client.ts`，仓库配置来自 `src/consts.ts` 的 `GITHUB_CONFIG`。
- 相关服务通过 Git tree/commit 写仓库文件：发布博客在 `src/app/write/services/push-blog.ts`，博客索引/分类编辑在 `src/app/blog/services/save-blog-edits.ts`，站点/卡片配置在 `src/app/(home)/services/push-site-content.ts`。
- 不要打印或提交私钥。README 期望用户在页面里粘贴 GitHub App private key；相关环境变量是 `NEXT_PUBLIC_GITHUB_OWNER`、`NEXT_PUBLIC_GITHUB_REPO`、`NEXT_PUBLIC_GITHUB_BRANCH`、`NEXT_PUBLIC_GITHUB_APP_ID`、`NEXT_PUBLIC_GITHUB_ENCRYPT_KEY`。

## 约定和坑点
- 导入路径用 `@/*` 指向 `src/*`。
- 格式化使用 Prettier：tab、单引号、无分号、`printWidth: 160`，并启用 `prettier-plugin-tailwindcss`。
- Tailwind 是 v4，通过 `@tailwindcss/postcss` 接入；主题 CSS 变量在 `src/app/layout.tsx` 中由 `src/config/site-content.json` 初始化。
- `next.config.ts` 设置了 `typescript.ignoreBuildErrors: true`，所以 Next 构建成功不代表类型完全正确。
- SVG 在 Turbopack 和 webpack 中都由 SVGR 处理；如果增删 `src/svgs` 下的 SVG，需要重新生成 `src/svgs/index.ts`。
