# Yu-Home 个人主页

一个使用 Next.js、React、Three.js 构建的现代化黑白风格个人主页，具有高级 3D 粒子效果和物理模拟。

## 技术栈

- **Next.js 16** - React 全栈框架，App Router
- **React 19** - 用户界面库
- **TypeScript 5** - 类型安全
- **Three.js 0.170** - 3D 图形库
- **@react-three/fiber** - React Three.js 渲染器
- **@react-three/drei** - Three.js 工具集
- **Tailwind CSS 3** - 原子化 CSS 框架

## 功能特点

### 五大粒子系统

#### 1. Hero - 旋转星系（HeroParticles.tsx）
灵感来自 actium.co.jp 首屏，仿真一个螺旋星系。
- **130000 粒子**：90000 薄盘星 + 40000 球形光晕
- **盘面分布**：圆柱半径偏向外缘（10–40 单位），盘高 ±2
- **光晕**：环绕核心的稀疏球壳
- **配色**：基于柱面距离的双色径向渐变 — 暖琥珀核心（255,170,60）→ 冷紫边缘（110,60,230）
- **运动**：每粒子独立 wobble，全部在 vertex shader 计算（CPU 只更新 uTime 和 group 旋转）
- **鼠标**：0.18 视差跟随
- **渲染**：自定义 ShaderMaterial + 透视点尺寸（110.0 / -mvPosition.z）

#### 2. About - 对角线虫洞（AboutParticles.tsx）
单条流动管道斜穿屏幕。
- **22000 管道粒子 + 700 背景星**
- **路径**：从 (-1600,-800,-200) 到 (1600,800,200) 的对角线，超出视口形成无限延伸感
- **管半径**：220 单位
- **运动**：粒子沿轴向螺旋流动（spiralPhase + spiralTurns），每粒子独立速度和生命相位
- **配色 4 段渐变**：琥珀 → 暖白 → 紫色 → 深紫（与 Hero 同族）
- **鼠标**：260 单位半径内排斥
- **后处理**：UnrealBloom 发光

#### 3. Skills - 横向锭形龙卷风（SkillsParticles.tsx）
沿 X 轴流动的纺锤状粒子涡流。
- **60000 粒子**（移动端降至 22000）
- **结构**：长度 1800、最大半径 180 的横向纺锤，sin 包络半径（中间粗、两端细，K=0.55）
- **运动方程**：
  - 轴向流速 FLOW=0.10（循环）
  - 旋转角速度 OMEGA=0.45
  - 轴向扭转 TWIST=1.8（前后段反向旋转）
  - 每粒子 wobble shift（与 Hero 同款）
- **鼠标**：350 单位半径内 r×1.25 + θ+0.6 扰动
- **GPU 计算**：所有运动都在 vertex shader，CPU 只更新 uniform

#### 4. Projects - 轨道系统（ProjectsParticles.tsx）
项目作品作为天体绕共享核心运行。
- **总计约 88000 粒子**：
  - 5000 中央脉动核心
  - 5 个椭圆轨道环 × 9000/环 = 45000
  - 8 颗彗星 × 220 尾迹 = 1760
  - 32000 小行星带
- **椭圆轨道公式**：r = a(1-e²) / (1 + e·cos(θ))，每环不同速度、倾角、离心率
- **彗星**：明亮头部 + 拖尾粒子链
- **鼠标**：靠近的粒子升温变亮（不扭曲位置，像光照尘埃）
- **配色**：与 Hero 同族琥珀/紫色
- **后处理**：UnrealBloom

#### 5. Contact - 黑洞吸积盘（ContactBlackHole.tsx）
CPU 驱动的牛顿引力实时模拟。
- **14000 粒子**
- **物理量**：位置/速度/质量/生命存于 Float32Array，每帧 CPU 积分
- **参数**：G=90000，软化常数 SOFTENING=40，阻尼 DAMPING=0.9985
- **空间结构**：
  - 事件视界 HORIZON=60（穿过即销毁，保持中心文字区干净）
  - 出生半径 95–120
  - 销毁半径 140
- **视觉**：盘面倾斜 -60° 呈现伪 3D 椭圆，盘面物理仍在纯 2D（z=0）计算
- **配色**：核心琥珀（255,170,60）→ 边缘深紫（110,60,230）
- **鼠标扰动**（30 单位半径）：
  - 径向推力 7000
  - 切向漩涡 0.6
  - 受影响粒子升温为暖光（255,215,150）
- **后处理**：自定义 ShaderPass 实现径向引力透镜 + 光子环

### FluidText - SVG 流体文字（FluidText.tsx）
- 基于 SVG `feDisplacementMap` + `feTurbulence` 的流体变形
- 静止位移 12，悬停位移 28
- requestAnimationFrame + 临界阻尼平滑过渡（SMOOTHING=0.12），避免 CSS transition 不支持 scale 属性导致的卡顿
- 灰度渐变色彩循环（白 → 浅灰 → 深灰）

### UI/UX 设计
- 黑白极简风格（背景 #000，文字 #fff）
- 单页滚动布局
- Intersection Observer 滚动动画
- 悬停微交互效果
- 响应式设计

### 页面板块
1. **Hero** - 130000 粒子旋转星系 + FluidText 流体文字标题
2. **About** - 22000 粒子对角线虫洞 + 个人介绍 + 数据统计
3. **Skills** - 60000 粒子横向龙卷风 + 技能进度条动画
4. **Projects** - 88000 粒子轨道系统 + 作品集卡片网格
5. **Contact** - 14000 粒子黑洞吸积盘 + 联系方式 + 社交链接

## 项目结构

```
Yu-Home/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 根布局
│   ├── page.tsx                  # 主页面
│   └── globals.css               # 全局样式
├── components/                   # React 组件
│   ├── Hero.tsx                  # Hero 区域
│   ├── HeroParticles.tsx         # Hero 粒子系统
│   ├── About.tsx                 # 个人介绍
│   ├── AboutParticles.tsx        # About 粒子背景
│   ├── Skills.tsx                # 技能展示
│   ├── SkillsParticles.tsx       # Skills 粒子效果
│   ├── Projects.tsx              # 项目作品
│   ├── ProjectsParticles.tsx     # Projects 粒子装饰
│   ├── Contact.tsx               # 联系方式
│   ├── ContactBlackHole.tsx      # 黑洞吸积盘模拟
│   └── FluidText.tsx             # SVG 流体文字组件
├── lib/                          # 工具库
│   ├── hooks/
│   │   └── useIntersectionObserver.ts
│   └── three/
│       └── ParticleSystem.ts     # 粒子系统核心逻辑
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

各粒子系统的可调参数都直接定义在对应组件文件顶部的常量区。

### Hero 星系（components/HeroParticles.tsx）

```typescript
const HALO_COUNT = 40000        // 球形光晕粒子数
const DISK_COUNT = 90000        // 薄盘粒子数
const INNER_RADIUS = 10         // 盘面内半径
const OUTER_RADIUS = 40         // 盘面外半径
const DISK_HEIGHT = 2           // 盘厚度
const HALO_RADIUS = 10          // 光晕半径
const MOUSE_PARALLAX = 0.18     // 鼠标视差强度
```

### About 虫洞（components/AboutParticles.tsx）

```typescript
const TUNNEL_PARTICLES = 22000  // 管道粒子数
const STAR_COUNT       = 700    // 背景星数
const TUBE_RADIUS      = 220    // 管半径
const MOUSE_RADIUS     = 260    // 鼠标排斥半径
```

### Skills 龙卷风（components/SkillsParticles.tsx）

```typescript
const PARTICLE_COUNT = 60000    // 粒子数（移动端 22000）
const L      = 1800             // 锭形长度
const R_MAX  = 180              // 最大半径
const K      = 0.55             // sin 包络陡度
const FLOW   = 0.10             // 轴向流速
const OMEGA  = 0.45             // 旋转角速度
const TWIST  = 1.8              // 轴向扭转量
const MOUSE_R = 350             // 鼠标影响半径
```

### Projects 轨道系统（components/ProjectsParticles.tsx）

```typescript
const RING_COUNT = 5            // 轨道环数
const PARTICLES_PER_RING = 9000 // 每环粒子数
const COMET_COUNT = 8           // 彗星数
const COMET_TAIL = 220          // 彗星尾长
const ASTEROID_BELT = 32000     // 小行星带粒子数
const CORE_PARTICLES = 5000     // 核心粒子数
```

### Contact 黑洞（components/ContactBlackHole.tsx）

```typescript
const PARTICLE_COUNT = 14000    // 粒子数
const HORIZON   = 60            // 事件视界半径
const SPAWN_MIN = 95            // 出生最小半径
const SPAWN_MAX = 120           // 出生最大半径
const KILL_RADIUS = 140         // 销毁半径
const G         = 90000         // 引力常数
const SOFTENING = 40            // 软化常数（防止奇点）
const DAMPING   = 0.9985        // 速度阻尼
const MOUSE_RADIUS = 30         // 鼠标影响半径
const MOUSE_PUSH   = 7000       // 鼠标径向推力
const MOUSE_SWIRL  = 0.6        // 鼠标切向漩涡
const REST_PITCH = -Math.PI / 3 // 盘面倾斜角度
```

### FluidText 流体文字（components/FluidText.tsx）

```typescript
const REST_SCALE  = 12          // 静止位移强度
const HOVER_SCALE = 28          // 悬停位移强度
const SMOOTHING   = 0.12        // rAF 过渡平滑度（0=冻结, 1=瞬切）
```

### 颜色系统

各粒子系统共享一致的暖琥珀 → 冷紫色调：

```
amber  rgb(255, 170,  60)   // 核心
white  rgb(255, 230, 200)   // 高亮
purple rgb(110,  60, 230)   // 边缘
deep   rgb( 30,  10,  70)   // 深空
```

UI 颜色在 `tailwind.config.js` 和 `app/globals.css` 中定义：

```css
--background: #000000;
--foreground: #ffffff;
--card: #111111;
--card-hover: #1a1a1a;
--border: rgba(255, 255, 255, 0.1);
```

## 性能优化

- **GPU 优先**：Hero/Skills/About/Projects 的所有粒子运动都在 vertex shader 计算，CPU 仅更新 uTime 等少量 uniform
- **Buffer Geometry**：所有粒子用 Points + 自定义 ShaderMaterial 渲染，避免逐粒子 draw call
- **CPU 物理仅在必要时使用**：只有 Contact 黑洞需要每帧引力积分，因为粒子要相互作用并响应中心奇点
- **移动端自适应**：Skills 龙卷风在 width<768 时粒子数从 60k 降到 22k
- **后处理按需启用**：仅 About 和 Projects 启用 UnrealBloom，Contact 用更轻量的自定义 ShaderPass
- **rAF 替代 CSS transition**：FluidText 用 requestAnimationFrame + 临界阻尼，绕开 SVG `feDisplacementMap scale` 属性不支持 CSS 过渡的限制

## 部署

支持部署到：
- Vercel（推荐）
- Netlify
- 任何支持 Node.js 的平台

## 许可证

MIT License

## 友链

[LINUX DO](https://linux.do/)