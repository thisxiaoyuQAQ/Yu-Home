# Section 间无奇点形变过渡设计

**日期:** 2026-05-29
**项目:** Yu-Home (Next.js 16 + React 19 + react-three-fiber 9 + three 0.170)
**目标:** 在 Hero / About / Skills / Projects / Contact 五个 section 之间插入 4 段
粒子过渡，让用户在向下滚动时看到"同一批粒子被重新排列"的一镜到底幻觉，同时
工程结构允许 4 个 agent 并行实现。

---

## 1. 决策汇总

| 项目 | 选择 |
|---|---|
| 触发方式 | 滚动驱动 |
| 视觉风格 | A — 形态形变 (一镜到底感、无奇点、连续) |
| 工程实现 | B — 4 个独立转场 Canvas，4 agent 可并行 |
| 过渡空间 | 50vh 重叠区 (覆盖前 25vh + 后 25vh，不增加页面总高度) |
| 粒子责任 | 过渡 Canvas 独立生成、独立运行 (不与上下 section 通信) |
| 动作设计 | 4 段每段都是量身定制的形变 |

---

## 2. 架构

### 2.1 页面结构

`app/page.tsx`:

```tsx
<main>
  <Hero />
  <SectionTransition variant="galaxyToTube" />
  <About />
  <SectionTransition variant="tubeToTornado" />
  <Skills />
  <SectionTransition variant="tornadoToNebulae" />
  <Projects />
  <SectionTransition variant="nebulaeToBlackhole" />
  <Contact />
</main>
```

### 2.2 `SectionTransition` 组件骨架

每个 variant 对应一个独立组件文件，但都遵循同一壳层：

```tsx
// components/transitions/<Variant>Transition.tsx
'use client'
export default function <Variant>Transition() {
  return (
    <div className="transition-host"
         style={{ position: 'relative', width: '100%', height: '50vh' }}>
      <div style={{
        position: 'absolute',
        top: '-25vh', left: 0,
        width: '100%', height: '100vh',
        pointerEvents: 'none',
      }}>
        <Canvas /* ... */>
          <<Variant>Scene />
        </Canvas>
      </div>
    </div>
  )
}
```

- `transition-host` 高度 50vh，参与文档流。
- 内部 Canvas 容器绝对定位、`top: -25vh`、`height: 100vh`，因此 Canvas 同时覆盖
  上一个 section 底部 25vh + 自身 50vh + 下一个 section 顶部 25vh = 100vh。
- Canvas 背景透明 (`background: 'transparent'`)；上下 section 自己的 `#0a0010`
  作为底色。
- `pointerEvents: 'none'`，鼠标事件透传给真实 section。

### 2.3 滚动驱动

每个 transition 组件内：

```tsx
const hostRef = useRef<HTMLDivElement>(null)
const progressRef = useRef(0)  // 共享给 Canvas 的 useFrame
useEffect(() => {
  const update = () => {
    const r = hostRef.current!.getBoundingClientRect()
    const vh = window.innerHeight
    // host 中心从 vh 走到 0 的过程映射为 progress 0 → 1
    const center = r.top + r.height / 2
    const p = 1 - center / vh
    progressRef.current = Math.max(0, Math.min(1, p))
  }
  update()
  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)
  return () => {
    window.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
  }
}, [])
```

Canvas 内部用 `useFrame` 读 `progressRef.current` 并写入 ShaderMaterial 的
`uProgress` uniform，所有形变在 vertex shader 里基于此插值。

### 2.4 共享工具

为防止 4 段过渡颜色 / 风格漂移，新建共享文件：

- `lib/three/palette.ts` — 导出 5 个 section 的关键颜色 (RGB 元组 + GLSL chunk)
- `lib/three/particleStyle.ts` — 导出 wobble 函数、circle-discard fragment、
  additive blending 配置等通用片段
- `lib/three/useScrollProgress.ts` — 上面 2.3 的 hook 抽出

每个 transition 组件**必须**从这两个文件导入颜色和风格，禁止内联硬编码新颜色。

---

## 3. 视觉幻觉手法

**核心:** 用户视线追的"那颗星"在过渡边界其实是被换掉的，但分布完全一致，眼睛
看不出切换。

**入口对齐 (progress = 0):** 过渡 Canvas 的粒子初态在颜色、密度、空间分布、运动
节奏上**视觉上等价于**上一个 section 末态。例如 galaxyToTube 在 progress=0 时
看起来就是一个 Hero 风格的星系盘，使用同一调色板、同一 wobble 节奏、同一
additive blending。

**出口对齐 (progress = 1):** 过渡 Canvas 的粒子终态视觉上等价于下一个 section
初态。

**握手:** Canvas 始终渲染，但材质透明度由 progress 控制：

- progress ∈ [0.00, 0.05]: alpha 从 0 升到 1 (淡入)
- progress ∈ [0.05, 0.95]: alpha = 1 (主表演)
- progress ∈ [0.95, 1.00]: alpha 从 1 降到 0 (淡出)

上下 section 始终全 alpha 渲染，因为过渡 Canvas 在它们头尾 25vh 区域内是叠加
绘制 (additive blending)，深色背景下叠加=替代，肉眼看不出切换。

**禁止事项:** 不允许有奇点 / 漩涡吸入 / 爆开 / 闪光帧。粒子的运动必须是渐变的
形变，progress 任何瞬间快照都应该是合理的中间形态。

---

## 4. 四段过渡的具体动作

### 4.1 `galaxyToTube` (Hero → About)

**入口形态:** Hero 风格星系盘。
- ~22000 个粒子 (与 About TUNNEL_PARTICLES 相同，方便 4.2 端复用资源结构)
- 极坐标在 disk plane 上：`radius ∈ [10, 40]`、`y ∈ [-1, 1]`，与 Hero 一致
- 颜色：琥珀核 → 紫边，与 Hero 一致
- Hero wobble + 0.04 group rotation y

**出口形态:** About 对角螺旋管局部段。
- 同样 22000 个粒子，沿 `PATH_START(-1600,-800,-200) → PATH_END(1600,800,200)`
  分布，半径 220
- 每颗粒子有 spiral phase，沿对角线缠绕
- 颜色：amber/white/purple/deep 沿生命周期渐变 (与 About wormholePalette 一致)

**形变方式 (vertex shader, uProgress 驱动):**
1. 每颗粒子在 CPU 端生成两套属性：`aHero (x,y,z, size)` 和
   `aTube (lifeOffset, spiralPhase, spiralTurns, sizeScale)`
2. Shader 同时计算两套世界坐标 `posHero` 和 `posTube`
3. 最终位置 = `mix(posHero, posTube, smoothstep(0, 1, uProgress))`
4. 颜色同样 `mix(colorHero, colorTube, uProgress)`
5. 关键：`aHero` 和 `aTube` 通过同一个粒子索引绑定，所以"那颗琥珀核"会平滑
   迁移到管道某个特定位置，不是随机重排，肉眼读到的是"抽丝"运动。

**视觉感受:** 盘心的琥珀星往斜上方被拉长，盘缘的紫色被卷成螺旋。中段
(progress ≈ 0.5) 看到的是一个被斜向风吹歪的星系，既像盘又像管。

---

### 4.2 `tubeToTornado` (About → Skills)

**入口形态:** About 对角螺旋管 (22000 粒子)。
- 对角轴 `(-1600,-800,-200) → (1600,800,200)`
- 半径 220

**出口形态:** Skills 水平纺锤龙卷局部段 (22000 粒子，桌面端 Skills 用 60000；
过渡里只取一部分做"密度递增"的暗示)。
- 水平轴 `x ∈ [-L/2, L/2]`, L=1800
- `radius = R_MAX * sin(PI * t)^K * jitter`，纺锤包络
- 颜色：purple → amber 沿 X 轴

**形变方式:**
1. 轴向**旋转拉直** — 对角 (1,0.5,0.125) 方向 → 水平 (1,0,0)，通过 shader 里
   `mix(对角向量, 水平向量, uProgress)` 重新计算 tangent。
2. 包络从均匀管 (radius=const) → 纺锤 (radius=sin envelope)，通过
   `mix(1.0, sinEnvelope, uProgress)`。
3. 颜色从 about palette → skills purple-amber 渐变 `mix`。
4. 整组绕 Z 轴旋转，把斜角转回水平：`rotation.z = (1 - uProgress) * angleOfDiagonal`。

**视觉感受:** 螺旋管被拽直、拽水平，同时被风吹得两头尖、中间胖。颜色从 amber↔
purple 的沿管渐变变成 purple→amber 的沿轴渐变。

---

### 4.3 `tornadoToNebulae` (Skills → Projects)

**入口形态:** Skills 水平纺锤龙卷局部段 (~24000 粒子)。

**出口形态:** Projects 3 团大星云的"种子"形态。
- 3 个团心：`(-70, 15, -5)`、`(60, -10, 8)`、`(5, 30, -15)` (与 Projects 完全一致)
- 每团 ~8000 粒子 (Projects 实际 36000 / 团，过渡里取早期种子状态)
- 调色板：PALETTE_AMBER / PALETTE_PURPLE / PALETTE_MAGENTA

**形变方式:**
1. 每颗龙卷粒子在 CPU 端预先**按颜色分组**：靠紫色那 1/3 → 紫色星云、靠琥珀
   那 1/3 → 琥珀星云、中间 1/3 → 品红星云。每颗粒子记一个 `aTargetCluster`
   (0/1/2) 和 `aTargetOffset (vec3)` (在目标星云内的相对位置)。
2. Shader 同时计算 `posTornado` (按 4.2 出口形态) 和 `posNebulaSeed = cluster.center + aTargetOffset`。
3. `posFinal = mix(posTornado, posNebulaSeed, smoothstep(0, 1, uProgress))`
4. 颜色：龙卷的 purple→amber 渐变 mix 到目标星云的 core 颜色。

**视觉感受:** 龙卷在 X 轴两端先"断裂"成 3 段 (因为 3 个星云在 X 上分散)，每
段被吸向自己的目标点，逐渐凝聚成星云种子。终帧三团星云已经初步成形，与
Projects section 接得上。

---

### 4.4 `nebulaeToBlackhole` (Projects → Contact)

**入口形态:** Projects 3 团星云 (~24000 粒子，与 4.3 出口一致)。

**出口形态:** Contact 黑洞盘 (Disk plane, 极坐标 `radius ∈ [0, 110]`,
`height = 1.6`，绕 X 轴 -π/2 翻转使盘面正对相机)。
- 取 24000 粒子作为黑洞盘的子集 (Contact 实际 160000，过渡里只是预兆形态)
- 颜色：Hero 同款 amber 核 → purple 边

**形变方式:**
1. 每颗星云粒子按"到画面中心距离"+ 随机 phase 计算一个**目标极坐标**
   `(theta, r)` 在 disk plane 上。
2. Shader 同时计算 `posNebula` (按 4.3 出口) 和
   `posDisk = vec3(r*cos(theta), 0, r*sin(theta)) * rotationMatrixToFaceCamera`
3. 增加一个**塌缩缓动**：`u = pow(uProgress, 1.8)`，让前半段慢、后半段加速，模拟
   引力坍缩。
4. `posFinal = mix(posNebula, posDisk, u)`
5. 颜色：星云颜色 mix 到 Hero amber→purple 调色板。

**视觉感受:** 3 团星云朝画面中心被引力拽过去，前期慢慢漂，后期加速，逐渐排成
一个面对相机的旋转盘。终帧已经是黑洞盘的初始形态，Contact section 接管。

---

## 5. 性能预算

| 项目 | 数值 |
|---|---|
| 每段过渡粒子数 | ~22000-24000 |
| 同时活跃 Canvas | 最多 2 (前一个 section + 当前过渡，或当前过渡 + 下一个 section) |
| Bloom / 后处理 | 过渡 Canvas **不加** Bloom (避免与 About / Contact 的 Bloom 叠加) |
| dpr | `[1, 2]` |
| 关停策略 | 当 `progress < -0.1` 或 `progress > 1.1` 时把 Canvas 的 `frameloop` 切到 `'never'`，节省 GPU |

每个过渡组件 mount 时即创建 BufferGeometry 并一次性写入两套属性 (入口属性 +
出口属性 + 索引)，运行时只更新 uniforms，不重建 buffer。

---

## 6. 文件清单

新增：

- `lib/three/palette.ts` (共享颜色)
- `lib/three/particleStyle.ts` (wobble / fragment / blending 共享 GLSL)
- `lib/three/useScrollProgress.ts` (滚动进度 hook)
- `components/transitions/GalaxyToTubeTransition.tsx` — agent 1
- `components/transitions/TubeToTornadoTransition.tsx` — agent 2
- `components/transitions/TornadoToNebulaeTransition.tsx` — agent 3
- `components/transitions/NebulaeToBlackholeTransition.tsx` — agent 4

修改：

- `app/page.tsx` (插入 4 个 SectionTransition)

不修改：

- 5 个现有 section 组件 (Hero / About / Skills / Projects / Contact)。如果未来
  发现过渡入口/出口和 section 实际形态差距过大，再回头精调 section 内 sweep
  范围，不在本期做。

---

## 7. 4 agent 并行任务划分

每个 agent 独立交付一个 `Transition.tsx` 文件 + 自测：

| Agent | 文件 | 入口参考 | 出口参考 |
|---|---|---|---|
| 1 | GalaxyToTubeTransition.tsx | Hero 星系盘 | About 螺旋管 |
| 2 | TubeToTornadoTransition.tsx | About 螺旋管 | Skills 龙卷 |
| 3 | TornadoToNebulaeTransition.tsx | Skills 龙卷 | Projects 三星云 |
| 4 | NebulaeToBlackholeTransition.tsx | Projects 三星云 | Contact 黑洞盘 |

**前置依赖 (主任务先做):**
1. 创建 `lib/three/palette.ts`、`particleStyle.ts`、`useScrollProgress.ts`
2. 修改 `app/page.tsx` 插入 4 个 placeholder transition (空 div, 50vh)

主任务完成后 4 agent 同时启动。每个 agent 完成后：
- 提供自测说明 (在 progress 0/0.5/1 时各应该看到什么)
- 主任务收齐后做集成验证

---

## 8. 验收标准

1. 滚动从 Hero 到 Contact，4 段过渡视觉上没有"突变帧"。
2. 任何时刻 progress 截图都是色调统一的星空场景，背景持续 `#0a0010`。
3. 桌面 1080p 全程 ≥ 50 fps；移动端可降级。
4. 过渡组件不影响上下 section 的鼠标交互 (`pointerEvents: 'none'`)。
5. 4 个 transition 文件代码风格、共享工具使用方式一致。
