# soulblog 项目长期记忆

## 项目概要
- Next.js App Router 博客项目，用户名 Ataraxia
- 暗色主题 + 玻璃拟态设计 + 星空背景动画
- 首页：以屏幕中心为原点的绝对定位卡片系统（11 张可拖拽卡片）
- 内容驱动：JSON 配置 + Markdown 博客文件
- 前端编辑通过 GitHub App 直接提交到仓库
- 部署目标：Cloudflare Pages
- 包管理器：pnpm；开发命令 `pnpm dev`（端口 2025）；构建 `pnpm build`

## 已知问题（待修复）
- `consts.ts` 中 GitHub 加密密钥暴露在客户端（P0 安全）
- `lang='en'` 应为 `zh-CN`
- 首页全客户端渲染，无 SSR
- `aritcle-card.tsx` 文件名拼写错误
- `user-scalable=no` 违反 WCAG 可访问性
