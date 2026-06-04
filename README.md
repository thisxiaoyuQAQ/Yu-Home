# Yu-Home 个人主页

一个使用 Next.js、React、TypeScript 和 Tailwind CSS 构建的黑白极简个人主页。页面保留完整的单页作品集结构，去除了粒子、黑洞、发光渐变等复杂视觉效果，把重点放在文字、留白、细线分割和项目内容上。

## 技术栈

- **Next.js 16** - React 全栈框架，App Router
- **React 19** - 用户界面库
- **TypeScript 5** - 类型安全
- **IBM Plex Sans / IBM Plex Mono** - 本地打包字体

## 功能特点

### 黑白极简视觉

- 纯黑背景与白 / 灰文字层级
- 大字号标题、细线分割和宽留白
- 无粒子、无 WebGL、无彩色发光效果
- 轻量 CSS 过渡与滚动进入动画
- 响应式单页布局

### 页面板块

1. **Hero** - 姓名、身份和中文格言
2. **About** - 个人介绍与数据统计
3. **Skills** - 技能列表与单色进度条
4. **Projects** - 作品项目列表
5. **Contact** - 联系方式与页脚

## 项目结构

```text
Yu-Home/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 根布局
│   ├── page.tsx                  # 主页面
│   └── globals.css               # 全局样式
├── components/                   # React 组件
│   ├── Hero.tsx                  # 首屏介绍
│   ├── About.tsx                 # 个人介绍
│   ├── Skills.tsx                # 技能展示
│   ├── Projects.tsx              # 项目作品
│   └── Contact.tsx               # 联系方式
├── lib/
│   └── hooks/
│       └── useIntersectionObserver.ts
├── docs/superpowers/specs/       # 设计文档
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── tsconfig.json
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3000

### 生产构建

```bash
npm run build
npm run start
```

## 设计说明

这版主页采用克制的黑白作品集风格：

- Hero 用大标题、GSAP 字符进入动效和横向信息条建立视觉记忆点。
- 全站使用 IBM Plex Sans，标签、数字和辅助信息使用 IBM Plex Mono，形成冷静技术感。
- About / Skills 使用左右分栏和细线强调结构。
- Projects 使用列表式作品索引，减少卡片装饰。
- Contact 使用简单边框链接，保持页面收束感。

详细设计文档见：

`docs/superpowers/specs/2026-06-05-black-white-minimal-homepage-design.md`

## 部署

支持部署到：

- Vercel（推荐）
- Netlify
- 任何支持 Node.js 的平台

## 许可证

MIT License

## 友链

[LINUX DO](https://linux.do/)
