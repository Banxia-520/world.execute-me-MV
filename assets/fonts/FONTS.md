# 随包字体与字重映射（FONTS.md）

`00` 总纲只给了字体**族名**（Inter / JetBrains Mono），未随包提供文件 —— 这会导致  
跨机器静默回退到不同字体，像素级排版不可复现。本目录把字体钉死。

## 1. 文件清单

| 文件                                        | 角色              | 字重             |
| ----------------------------------------- | --------------- | -------------- |
| `Inter-Regular.ttf`                       | 主词 / 次词         | 400            |
| `Inter-Bold.ttf`                          | 主词 / 次词         | 700            |
| `JetBrainsMono-Regular.ttf`               | 微字 / 状态行        | 400            |
| `JetBrainsMono-Medium.ttf`                | 微字              | 500            |
| `JetBrainsMono-Bold.ttf`                  | 微字 / 页眉         | 700            |
| `JetBrainsMono-ExtraBold.ttf`             | 微字强调            | 800            |
| **`JetBrainsMono-VariableFont_wght.ttf`** | **微字全字重（变量字体）** | **100–800 任意** |

> **注**：本目录**只保留上面这些真正被加载的 `.ttf`**。>   
> 原设计还随包放置过 `Inter-Regular.otf` / `Inter-Bold.otf`（CFF 版本，仅作备选），>   
> 但播放器与渲染器从未引用它们，**已移除以减小仓库体积**（省约 530 KB）。>   
> 若确需 CFF 版本，可按官方来源自行补回。
>
> **同步说明**：这些字体在完整项目里是 `assets/fonts/` 的一份副本。>   
> 本仓库为自包含部署而内嵌一份，二者可用>   
> `python render/tools/sync_web_assets.py --check` 校验一致性。

## 2. JetBrains Mono —— 精确覆盖

该族随包提供**变量字体**，字重轴 `Weight ∈ [100, 800]`，默认 400。  
渲染时按轴实例化即可精确命中 `06` 用到的所有字重：

```python
f = ImageFont.truetype("assets/fonts/JetBrainsMono-VariableFont_wght.ttf", px)
f.set_variation_by_axes([600])      # Semi-Bold
```

| 06 中写法                   | 轴值  |
| ------------------------ | --- |
| JetBrains Mono           | 400 |
| JetBrains Mono Medium    | 500 |
| JetBrains Mono Semi-Bold | 600 |
| JetBrains Mono Bold      | 700 |
| JetBrains Mono ExtraBold | 800 |

实测：墨量随字重严格单调，100→800 增长 171%，轴生效。

## 3. Inter —— 需要近似（重要）

本机 Inter 只有 400 与 700 两个静态实例，**没有变量字体**，因此 `06` 用到的  
Medium(500) / Semi-Bold(600) / Extra-Bold(800) 无法精确命中。实测偏差：

| 06 中写法                 | 直接映射到静态实例        | 墨量偏差             |
| ---------------------- | ---------------- | ---------------- |
| Inter Medium (500)     | `Inter-Bold.ttf` | **+35.1%**（明显偏重） |
| Inter Semi-Bold (600)  | `Inter-Bold.ttf` | +14.9%           |
| Inter Bold (700)       | `Inter-Bold.ttf` | 0%（精确）           |
| Inter Extra-Bold (800) | `Inter-Bold.ttf` | −11.5%           |

### 推荐的近似参数（误差 < 8%）

用 `Inter-Regular.ttf` 绘制并加 `stroke_width`（Pillow）/ 等效描边：

| 06 中写法                 | 基准文件                | 等效描边                           | 实测误差 |
| ---------------------- | ------------------- | ------------------------------ | ---- |
| Inter Medium (500)     | `Inter-Regular.ttf` | `stroke_width ≈ 0.75`（96px 基准） | 4.5% |
| Inter Semi-Bold (600)  | `Inter-Regular.ttf` | `stroke_width ≈ 1.50`（96px 基准） | 7.7% |
| Inter Extra-Bold (800) | `Inter-Regular.ttf` | `stroke_width ≈ 2.75`（96px 基准） | 2.5% |

> 描边值按字号等比缩放：`stroke_px = k × 字号 / 96`，其中 k 取 0.75 / 1.50 / 2.75。>   
> 这是**近似**，不是 Inter 的真实字重；如需精确字重，请补 Inter 变量字体>   
> （`Inter-VariableFont_wght.ttf`）并按 `Weight` 轴实例化，映射表与本文件 §2 相同。

## 4. 渲染器要求

1. 用**绝对路径**加载本目录字体，**禁止系统字体回退**。
2. 加载失败即**报错退出**，不要静默替换（静默回退正是本包原先的确定性风险）。
3. 首帧渲染前断言字体就绪。
4. `IBM Plex Mono` 未被任何镜头实际引用，故未随包提供。

## 5. 许可

Inter 与 JetBrains Mono 均为 **SIL Open Font License 1.1**，允许随作品分发与嵌入。  
OFL 全文见 <https://scripts.sil.org/OFL> 。
