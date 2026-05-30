# Contact 黑洞吸积盘重写 — 设计文档

> 日期: 2026-05-29
> 目标组件: `components/ContactBlackHole.tsx`
> 关联: `components/Contact.tsx` (消费方), `components/HeroParticles.tsx` (配色参照)

## 1. 背景与目标

当前 `ContactBlackHole.tsx` 渲染 16 万粒子排成正对镜头的平面环,**没有真实物理** —— 所有运动是顶点着色器里的 per-particle wobble + 缓慢整组自转。"黑洞" 完全靠后处理 `LENS_SHADER` 伪造(中心变暗 + photon ring)。闪电从中心击出。没有引力模拟,没有真正的吸积盘。

**本次重写目标:**

- 用 **GPU GPGPU/FBO** 跑**真实牛顿引力**,保持 16 万粒子密度
- 物理在**纯 2D 平面**(z 恒为 0)运行,整组**倾斜 ~60°** 做伪 3D 吸积盘
- 每个粒子带**随机权重 / 质量**
- 掉进视界 (`r < HORIZON`) 或飞出边界 (`r > KILL_RADIUS`) → **死亡**
- 死亡后在**外圈环带重生**(带新随机质量 + 切向初速度),总数恒定
- 缝合保留:**lens 后处理**(黑色视界 + photon ring)、**bloom 辉光**、**鼠标引力扰动**(替代原闪电交互)
- 粒子配色统一 Hero(amber→purple,additive,软点)
- **移除**:闪电系统、HALO、纯 wobble 运动

## 2. 依赖

- `three/examples/jsm/misc/GPUComputationRenderer.js` —— three 自带,已确认存在,**无需新依赖**。
- 其余沿用现有:`@react-three/fiber`、`three` addons 的 EffectComposer / RenderPass / UnrealBloomPass / ShaderPass。

## 3. 数据布局与纹理打包

16 万粒子 → 纹理边长 `ceil(sqrt(160000)) = 400`,即 **400×400 = 160000** 个纹素,完美整除。

两张 RGBA float 数据纹理:

| 纹理 | R | G | B | A |
|------|---|---|---|---|
| `texPosition` | x | y | seed (永久随机种子) | mass (随机权重) |
| `texVelocity` | vx | vy | life (0→1 重生淡入) | state (0=alive) |

- **z 永不存储** —— 物理纯 2D。渲染时 z=0,靠整组 tilt 做伪 3D。
- `mass` 每个粒子随机 (0.3–1.0):影响点大小、引力惯性表现、死亡重生时重新 roll。
- `seed` 保证粒子重生后保留稳定视觉个性,避免重生闪烁。

## 4. 引力物理(GPGPU 双 pass)

每帧 ping-pong 两个 fragment shader,全在 2D 平面。两 pass 共享 `uTime / uDelta / uMouse / uMouseActive` uniform。dt 用 clamp 后固定步长保证稳定。

### 4.1 速度 pass (`velocityShader`)

```glsl
// 读 pos.xy, vel.xy, mass
float r = length(pos);
vec2 dir = -pos / r;                 // 指向中心
float a = G / (r*r + SOFTENING);     // 牛顿引力,softening 防 r→0 爆炸
vel += dir * a * uDelta;
vel *= DAMPING;                      // 极轻阻尼 → 轨道缓慢内旋(吸积)

// 鼠标第二引力源(§7.3)
if (uMouseActive) {
  vec2 toMouse = uMouse - pos;
  float md = length(toMouse);
  vel += normalize(toMouse) * (G_MOUSE / (md*md + SOFTENING)) * uDelta;
}
```

- `SOFTENING`(~4.0)避免中心奇点炸飞速度。
- `DAMPING`(~0.999)让轨道缓慢衰减内旋 → 自然吸积、最终落入视界。"掉进去"的来源。

### 4.2 位置 pass (`positionShader`)

```glsl
pos.xy += vel.xy * uDelta;
float r = length(pos.xy);
if (r < HORIZON || r > KILL_RADIUS) {
  // → 死亡,触发重生(见 §5)
}
```

死亡两条件:`r < HORIZON`(掉进视界)/ `r > KILL_RADIUS`(飞出逃逸)。

## 5. 死亡与重生(shader 内完成,总数恒定)

死亡命中后,同一 pass 内立即重写该粒子状态,无需 CPU 介入:

```glsl
// hash(seed, uTime) 自写,shader 无内置 random
float angle  = hash(seed, uTime) * 6.2831853;
float radius = SPAWN_MIN + hash2(...) * (SPAWN_MAX - SPAWN_MIN);  // 外圈环带
vec2 newPos = vec2(cos(angle), sin(angle)) * radius;

vec2 tangent = vec2(-sin(angle), cos(angle));   // 切向 = 角动量
float orbitalSpeed = sqrt(G / radius);          // 近似圆轨道速度
vec2 newVel = tangent * orbitalSpeed * (0.8 + hash3 * 0.4);  // 随机扰动

float newMass = 0.3 + hash4 * 0.7;   // 重新 roll 随机权重
float life = 0.0;                    // 从 0 淡入,避免突然冒出
```

要点:

- 在**外圈环带**(`SPAWN_MIN..SPAWN_MAX`)重生,不是固定圆 → 像源源不断有物质从外被吸入。
- **切向初速 = 角动量** → 粒子绕转而非直落,形成螺旋吸积盘。速度略偏离精确圆轨道(`*0.8~1.2`)→ 椭圆/缓慢内旋,配合 §4 阻尼最终落入。
- `life` 从 0 淡入,渲染 alpha 乘 life,重生不闪。

**初始化(CPU,mount 时):** 同规则铺满整盘(`HORIZON..KILL_RADIUS` 内随机分布 + 切向速度),首帧即完整旋转盘。

## 6. 渲染、配色、伪 3D 倾斜

### 6.1 渲染 shader (points)

从 `texPosition` / `texVelocity` 读回每个粒子:

```glsl
vec4 p = texture(texPosition, uv);   // p.xy=位置, p.z=seed, p.w=mass
vec4 v = texture(texVelocity, uv);   // v.z=life
vec3 worldPos = vec3(p.xy, 0.0);     // z 恒 0,平面盘
gl_PointSize = uSize * (p.w*0.7+0.25) * uPixelRatio * (110.0 / -mvPosition.z);
```

### 6.2 配色 —— 完全沿用 Hero 两段调色板

映射量改为"到中心距离"(吸积盘温度梯度):

```glsl
float d = clamp(r / KILL_RADIUS, 0.0, 1.0);
vec3 core = vec3(255.0,170.0,60.0)/255.0;  // amber 内核 (Hero)
vec3 rim  = vec3(110.0,60.0,230.0)/255.0;  // deep purple 外缘 (Hero)
vColor = mix(core, rim, d);
```

- fragment alpha 沿用 Hero:`smoothstep(0.5,0.0,d)*0.35+0.15`,再 `* life`(重生淡入)。
- `AdditiveBlending` + `depthWrite:false` —— 与 Hero / 当前一致。

### 6.3 伪 3D 倾斜

```jsx
<group rotation={[REST_PITCH, 0, 0]}>   {/* REST_PITCH ≈ -Math.PI/3 (~60°) */}
  <points ... />
</group>
```

平面盘 (XY) 绕 X 轴倾 ~60° → 椭圆吸积盘,中心露出。物理本身已在转;可选叠加极慢 `rotation.z` 整体微调。

## 7. 缝合现有效果

### 7.1 Bloom(原样保留)
`UnrealBloomPass(strength=1.1, radius=0.9, threshold=0.25)`,让 amber 内核辉光外溢。

### 7.2 Lens 后处理(原样保留 `LENS_SHADER`)
- 径向引力透镜:UV 向屏幕中心拉 (`uLensStrength`)。
- **黑色视界**:中心 `uHoleRadius` 内黑盘 —— 对应物理 `HORIZON` 的视觉黑洞。
- **photon ring**:视界边缘 amber 亮环。外圈 vignette。
- `uAberration=0`(保持 Hero 干净配色)。
- **对齐要点**:`uHoleRadius`(屏幕空间)需与物理 `HORIZON`(世界空间倾斜投影后)视觉对齐,黑盘正好盖住中心"粒子被吸入消失"区域,衔接无缝。实现时调常量对齐。

### 7.3 鼠标引力扰动(新增,替代原闪电)
- 鼠标 NDC → 世界平面坐标(逆 tilt 投影),传 `uMouse`。
- 作为第二引力源注入 `velocityShader`(见 §4.1),`G_MOUSE` < 中心 `G`,局部拽动粒子拖出引力尾迹,不破坏整体盘。
- 沿用现有 `__contactMouse` window-global 模式 + `onMouseMove / onMouseLeave`。

### 7.4 管线与相机
EffectComposer:`RenderPass → Bloom → Lens`(与现状一致)。相机 `position=[0,0,140]` 附近,fov 60(沿用)。

## 8. 移除项

- 闪电系统全部(Bolt 接口、spawnBolt、burst 调度、lineSegments、lineGeo/lineMat)。
- HALO_COUNT 及 halo 分布。
- 当前纯 wobble 顶点运动(aShift 驱动)。

## 9. 关键常量(初始建议,实现时可调)

| 常量 | 建议值 | 含义 |
|------|--------|------|
| `PARTICLE_COUNT` | 160000 (400×400) | 粒子总数 |
| `G` | 待调 | 中心引力强度 |
| `G_MOUSE` | `G * 0.2` 量级 | 鼠标引力强度 |
| `SOFTENING` | 4.0 | 防奇点 |
| `DAMPING` | 0.999 | 内旋吸积速率 |
| `HORIZON` | 待调 | 视界死亡半径 |
| `SPAWN_MIN / SPAWN_MAX` | 外圈环带 | 重生半径区间 |
| `KILL_RADIUS` | > SPAWN_MAX | 逃逸死亡半径 |
| `REST_PITCH` | -π/3 (~60°) | 盘倾斜角 |

## 10. 验收标准

- 粒子呈螺旋吸积盘形态,绕中心旋转并缓慢内旋。
- 中心黑洞(lens 黑盘 + photon ring)与粒子消失区域视觉对齐。
- 粒子掉入视界 / 飞出边界后消失,并在外圈持续重生,画面密度稳定不变空。
- 鼠标移过盘面时附近粒子轨道被扰动拖出尾迹。
- 配色 amber→purple 与 Hero 视觉统一;bloom 辉光生效。
- 16 万粒子下保持 ~60fps。
- `npm run build` / 类型检查通过。
