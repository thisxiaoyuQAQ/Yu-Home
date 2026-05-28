# Skills 页面 — 神经网络粒子效果

**日期:** 2026-05-28
**目标文件:** `components/SkillsParticles.tsx` (完整替换), `components/Skills.tsx` (轻改)
**移除:** 原有 Matrix Rain 效果

## 目标

将 Skills 页面背景的 Matrix Rain 粒子替换为 **动态图谱式神经网络**:节点漂浮 + 距离阈值连线 + 鼠标/自发混合脉冲。视觉风格与 Hero 页面统一(`#0a0010` 背景、amber→purple 渐变、Hero 同款 wobble shader、AdditiveBlending)。

## 关键决策

| 决策项 | 选择 |
|---|---|
| 神经结构 | 动态图谱 (Floating Graph) |
| 信号触发 | 鼠标增强 + 自发持续脉冲(两者结合) |
| 节点规模 | ~400 节点 |
| Skill bar 联动 | 轻联动: hover bar → 背景对应区域 burst |

## 架构

单文件 `components/SkillsParticles.tsx` (复用 Hero 单文件模式)。

```
SkillsParticles.tsx
├── exports
│   ├── default <SkillsParticles className/>
│   └── skillsMouseState (扩展)
├── 常量 (NODE_COUNT=400, MAX_LINKS=1200, LINK_DIST=80, SPREAD_X/Y/Z)
├── VERTEX_SHADER / FRAGMENT_SHADER (节点)
├── LINE_VERTEX_SHADER / LINE_FRAGMENT_SHADER (连线)
├── NeuralNetwork() — 主组件
│   ├── 节点 BufferGeometry (position, aSize, aShift, aActivation)
│   ├── 连线 BufferGeometry (LineSegments, DynamicDraw)
│   ├── 空间网格 (16×16 uniform grid) 加速邻接查询
│   └── useFrame: drift + 网格重建 + 邻接 + activation 传播
└── SkillsParticles wrapper (Canvas)
```

## 数据流

**节点 CPU 状态(长度 N=400):**
- `positions: Float32Array(N*3)` — 漂浮位置,每帧累加 drift + 边界回绕
- `activation: Float32Array(N)` — 0~1 激活强度
- `nextAct: Float32Array(N)` — 双缓冲,本帧算下帧

**每帧 useFrame:**
1. drift 更新 `positions` (慢速漂浮 + 三轴 wrap)
2. 重建空间网格 (16×16 cell)
3. 邻接重建 — 同/邻 cell 查距 < `LINK_DIST`,上限 `MAX_LINKS=1200`(超出按距离淘汰)
4. 鼠标传播:
   - 鼠标最近 ~5 节点 → `activation = 1`
   - skill bar burst: `hoverBarY` 区域最近 ~3 节点 → `activation = 1`
   - 沿邻接表: `nextAct[neighbor] = max(nextAct[neighbor], activation[i] * 0.6)`
5. 自发激活: 每帧 ~2 个随机节点 `activation = 0.5`
6. 衰减: `activation *= 0.94`
7. swap `(activation, nextAct)`
8. 上传 GPU:节点 `aActivation`,连线 `position + aLineActivation + aLinePhase`
9. shader 渲染

## 联动接口

`Skills.tsx → SkillsParticles` 通过扩展的 `skillsMouseState`:

```ts
export const skillsMouseState = {
  x: 0, y: 0, active: false,
  hoverBarIndex: -1,   // -1 = 无 hover
  hoverBarY: 0,        // hover bar 屏幕 y
  burstRequest: 0,     // 递增计数,变化触发一次 burst
}
```

`Skills.tsx` 的 `SkillBar` 增加 `onMouseEnter` → 写入 `hoverBarIndex/Y` + `burstRequest++`。无 React state,零渲染开销。

## Shader 设计

**节点 vertex:**
- Hero 同款 `aShift (phaseA, phaseB, frequency, amplitude)` wobble
- `glow = 0.3 + aActivation * 0.7`
- Y 轴 amber↔purple 渐变(Hero 同色:`vec3(1.0,0.667,0.235)` ↔ `vec3(0.431,0.235,0.902)`)
- `gl_PointSize *= (1.0 + aActivation * 0.5)` 激活时膨胀

**节点 fragment:** 圆形点,`smoothstep(0.5, 0.1, d)` 软边。

**连线 vertex:**
- 共享 `aLineActivation`(两端 activation max)
- `vAlpha = 0.03 + aLineActivation * 0.5` 未激活几乎不可见,激活清晰
- `vPulse = fract(uTime * 0.5 + aLinePhase)` 沿线流动相位

**连线 fragment:**
- `pulse = smoothstep(0.0, 0.3, vPulse) * smoothstep(1.0, 0.7, vPulse)` — 流动光斑
- `finalAlpha = vAlpha * (0.3 + pulse * 0.7)`

混合: `AdditiveBlending`, `depthWrite: false` — 与 Hero 一致。

## 性能预算

| 项 | 成本 |
|---|---|
| Drift | O(N)=400 浮点累加 |
| 网格重建 | O(N) |
| 邻接 | O(N·8) ≈ 3200 距离比较 |
| Activation 传播 | O(MAX_LINKS)=1200 |
| GPU 上传 | 节点 ~6KB/帧,连线 ~30KB/帧 |

目标 60 FPS 稳定。`MAX_LINKS=1200` 硬上限防爆。`BufferAttribute.usage = DynamicDrawUsage`,通过 `setDrawRange` 复用而非重建。

## 移动端降级

`window.innerWidth < 768`:
- `NODE_COUNT = 200`
- `MAX_LINKS = 500`
- `LINK_DIST` 同步缩小

## 不做(YAGNI)

- 不做节点间最短路径动画
- 不做 skill level → 节点数映射
- 不做 WebGL2 transform feedback(CPU 够用)
- 不做 instanced lines(LineSegments 够用)
- 不做 skill bar 与具体节点的深绑定

## 验收标准

1. 桌面 60 FPS 稳定
2. 鼠标移动有可见脉冲沿连线传播 2-3 跳
3. skill bar hover 触发背景对应区域 burst
4. 视觉风格与 Hero 一致(色调/抖动/暗背景/混合方式)
5. 完全移除原 Matrix Rain 代码痕迹
6. `skillsMouseState` 对外接口保留兼容(`x, y, active` 字段仍存在)

## 改动清单

- `components/SkillsParticles.tsx` — 完整重写
- `components/Skills.tsx` — `SkillBar` 加 `onMouseEnter/Leave` 写入 `skillsMouseState`;移除 `// Matrix Rain` 相关注释
- `particles.md` — 更新 Skills 章节(可后续)
