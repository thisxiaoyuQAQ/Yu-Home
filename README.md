# Yu-Home 个人主页

一个使用 Next.js、React、Three.js 构建的现代化黑白风格个人主页。

## 技术栈

- **Next.js 15** - React 全栈框架，App Router
- **React 19** - 用户界面库
- **TypeScript** - 类型安全
- **Three.js** - 3D 图形库
- **@react-three/fiber** - React Three.js 渲染器
- **@react-three/drei** - Three.js 工具集
- **Tailwind CSS 3** - 原子化 CSS 框架

## 功能特点

### 3D 粒子系统
- 4000+ 白色粒子构成的动态星云效果
- 粒子间智能连线（距离阈值检测）
- 鼠标交互：涟漪效果、推力/吸引力
- 深度伪 3D：粒子大小随 Z 轴变化
- 高性能：使用 Points 渲染 + 空间哈希优化

### UI/UX 设计
- 黑白极简风格（背景 #000，文字 #fff）
- 单页滚动布局
- Intersection Observer 滚动动画
- 悬停微交互效果
- 响应式设计

### 页面板块
1. **Hero** - 全屏 3D 粒子背景 + 个人标题
2. **About** - 个人介绍 + 数据统计
3. **Skills** - 技能展示（进度条动画）
4. **Projects** - 作品集卡片网格
5. **Contact** - 联系方式 + 社交链接

## 项目结构

```
Yu-Home/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # 根布局
│   ├── page.tsx            # 主页面
│   └── globals.css         # 全局样式
├── components/             # React 组件
│   ├── Hero.tsx            # Hero 区域
│   ├── About.tsx           # 个人介绍
│   ├── Skills.tsx          # 技能展示
│   ├── Projects.tsx        # 项目作品
│   ├── Contact.tsx         # 联系方式
│   └── ParticleCanvas.tsx  # Three.js 粒子画布
├── lib/                    # 工具库
│   ├── hooks/
│   │   └── useIntersectionObserver.ts
│   └── three/
│       └── ParticleSystem.ts
├── .gitignore
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

## 自定义配置

### 粒子系统参数

在 `lib/three/ParticleSystem.ts` 中可调整：

```typescript
{
  count: 4000,              // 粒子数量
  connectionDistance: 100,  // 连线距离阈值
  mouseInfluenceRadius: 180,// 鼠标影响半径
  mouseForceStrength: 0.6,  // 鼠标推力强度
  particleMinSize: 1.5,     // 最小粒子尺寸
  particleMaxSize: 4.0,     // 最大粒子尺寸
}
```

### 颜色系统

在 `tailwind.config.js` 和 `app/globals.css` 中定义：

```css
--background: #000000;
--foreground: #ffffff;
--card: #111111;
--card-hover: #1a1a1a;
--border: rgba(255, 255, 255, 0.1);
```

## 部署

支持部署到：
- Vercel（推荐）
- Netlify
- 任何支持 Node.js 的平台

## 许可证

MIT License
