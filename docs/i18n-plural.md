# 需求：数量文案改用 ICU plural

**类型**：缺陷修复 + 规范建立
**影响端**：iOS / Android（Flutter 双端共用同一份 ARB）
**影响语言**：11 种全部
**发现方式**：v2.1 角色管理页截图验收

---

## 1. 问题

角色管理页显示 `1 flights in progress`。英语里数量为 1 必须用单数 `flight`。

根因是文案用拼接实现，形如：

```dart
Text('$count flights in progress')   // ✗
```

这行代码隐含一个假设：**名词形式固定，前面换个数字就行**。这个假设只在中文、日文、韩文、印尼语成立（这 4 种语言没有复数变化），在其余 7 种语言里都不成立。

不能用 `if (count == 1)` 修。复数规则不是「1 特殊，其余一样」——各语言规则完全不同，且与数字的**末位**相关而非大小。

### 俄语是最严重的一个

角色上限 8 个，即计数范围主要落在 1–8。**俄语在这个范围内就需要三种不同词形**：

| count | 档位 | 俄语 |
|---|---|---|
| 1, 21, 31… | `one` | `1 рейс выполняется` |
| 2–4, 22–24… | `few` | `2 рейса выполняются` |
| 5–20, 25–30… | `many` | `5 рейсов выполняются` |

注意 `21 → one`、`22 → few`、`11 → many`。规则是「末位是 1 且不是 11」，靠条件判断写不对。

---

## 2. 各语言需要的档位

以下为实测结果（`Intl.PluralRules`，CLDR 规则）：

| 语言 | 1–8 范围内用到 | 该语言全部档位 | 翻译需要填几条 |
|---|---|---|---|
| en | one, other | one, other | 2 |
| de | one, other | one, other | 2 |
| hi | one, other | one, other | 2 |
| fr | one, other | many, one, other | 2（`many` 仅百万级用到，可不填） |
| it | one, other | many, one, other | 2（同上） |
| es | one, other | many, one, other | 2（同上） |
| ja | other | other | **1** |
| ko | other | other | **1** |
| zh-TW | other | other | **1** |
| id | other | other | **1** |
| **ru** | **one, few, many** | one, few, many, other | **4** |

---

## 3. 方案

改用 ICU MessageFormat，把所有档位写进一条字符串，由框架按 locale 规则挑选：

```
{count, plural,
  =0    {No flights in progress}
  one   {# flight in progress}
  other {# flights in progress}
}
```

- `#` 自动替换为数字，并按 locale 格式化（千分位分隔符也会跟着变）
- `=0` 是**精确匹配**，与复数档位是两回事。英语里 0 走 `other`（`0 flights`），如果产品希望显示「没有航班」需要单独用 `=0`
- 缺失的档位自动回落到 `other`，所以只填该语言需要的即可

---

## 4. 文案交付（已验证）

下列 11 条已通过 `intl-messageformat` 语法校验，可直接入 ARB。

> ⚠️ **译文为初稿，需母语校对**。术语（航班/рейс/フライト/항공편）应与 App 内既有译法对齐后再定稿。

```
en      {count, plural, =0{No flights in progress} one{# flight in progress} other{# flights in progress}}
fr      {count, plural, =0{Aucun vol en cours} one{# vol en cours} other{# vols en cours}}
de      {count, plural, =0{Keine Flüge unterwegs} one{# Flug unterwegs} other{# Flüge unterwegs}}
it      {count, plural, =0{Nessun volo in corso} one{# volo in corso} other{# voli in corso}}
es      {count, plural, =0{Ningún vuelo en curso} one{# vuelo en curso} other{# vuelos en curso}}
ja      {count, plural, =0{進行中のフライトなし} other{進行中のフライト # 件}}
ko      {count, plural, =0{진행 중인 항공편 없음} other{진행 중인 항공편 #편}}
zh-TW   {count, plural, =0{沒有進行中的航班} other{# 個航班進行中}}
id      {count, plural, =0{Tidak ada penerbangan berlangsung} other{# penerbangan berlangsung}}
hi      {count, plural, =0{कोई उड़ान जारी नहीं} one{# उड़ान जारी} other{# उड़ानें जारी}}
ru      {count, plural, =0{Нет активных рейсов} one{# рейс выполняется} few{# рейса выполняются} many{# рейсов выполняются} other{# рейса выполняются}}
```

---

## 5. Flutter 实现

`intl` 包的 ARB 格式原生支持 ICU plural，不需要引入新依赖。

**`lib/l10n/app_en.arb`**

```json
{
  "flightsInProgress": "{count, plural, =0{No flights in progress} one{# flight in progress} other{# flights in progress}}",
  "@flightsInProgress": {
    "description": "角色管理页：该角色当前关联的进行中航班数",
    "placeholders": {
      "count": { "type": "int" }
    }
  }
}
```

其余语言的 ARB 只需 `"flightsInProgress"` 一个键，`@` 元数据只写在模板语言里。

**调用处**

```dart
Text(AppLocalizations.of(context)!.flightsInProgress(count))
```

代码里不应再出现任何 `count == 1` 的分支。

---

## 6. 排查清单

这类问题通常不止一处。**本次要求把所有「数字 + 名词」的文案全部过一遍**，不只修已发现的那条：

| 位置 | 现状 | 处理 |
|---|---|---|
| 角色管理页 `N flights in progress` | ✗ 已确认错误 | 必改 |
| 行程页 `共 x 个行程` | 本期细节优化新增 | 中文无复数问题，但同 key 的 en/ru 等译文必须用 plural |
| 筛选栏角标（All 6 / My Flight 2） | 纯数字，无名词 | 不涉及。但若配了读屏（a11y）文案则涉及 |
| 角色数量 `5/8` | 纯数字 | 不涉及 |
| 其他列表页计数、空状态、搜索结果数 | 待排查 | 逐一检查 |

排查方式：全局搜索字符串拼接中带数字变量的文案，例如 `'$` 后跟计数变量、`.toString()` 拼接等。

---

## 7. 验收标准

### 7.1 功能验收

在角色管理页构造对应数量的进行中航班，逐条核对：

| 语言 | count | 期望显示 |
|---|---|---|
| en | 0 | `No flights in progress` |
| en | 1 | `1 flight in progress` ← **当前错误点** |
| en | 2 | `2 flights in progress` |
| **ru** | 1 | `1 рейс выполняется` |
| **ru** | 2 | `2 рейса выполняются` ← **few 档** |
| **ru** | 5 | `5 рейсов выполняются` ← **many 档** |
| zh-TW | 1 | `1 個航班進行中` |
| zh-TW | 5 | `5 個航班進行中`（与 1 时同形，正确） |
| ja | 1 | `進行中のフライト 1 件` |
| hi | 1 | `1 उड़ान जारी` |
| hi | 2 | `2 उड़ानें जारी` |

### 7.2 关键提醒

⚠️ **只用中文和英文测是测不出问题的。**

中文没有复数变化，怎么写都对；英文只有 2 档，`count=2` 时拼接和 plural 结果相同。本节的 bug 只在 **俄语 count=2 与 count=5** 上才完整暴露。

**测试最少必须覆盖：en（1 和 2）、ru（1、2、5）。**

### 7.3 回归

改动会触及 ARB 文件结构，需确认：

- 11 种语言均能正常编译、无缺失 key 警告
- 数字格式化跟随 locale（`#` 在 de 下的千分位是 `.`，en 下是 `,`——虽然本例数值小，但同一套机制用在其他计数上会体现）

---

## 8. 非目标

- 不重构现有 i18n 架构，只把受影响的文案迁到 plural 格式
- 不新增语言
- 不处理序数词（ordinal，如「第 1 个」）——本期无此类文案，如后续出现用 `{n, selectordinal, ...}`

---

## 9. 成本与优先级

**成本**：每条文案约 1 行 ARB + 1 行调用，加上翻译填表。已发现的那条改动量在半小时内。

**优先级建议：随 v2.1 一起上。**

理由是改动成本不对称——现在改只是改字符串；上线后再改，需要重新走一轮 11 语言的翻译流程，而且 `1 flights` 这种错误母语用户一眼可见，属于会被直接反馈的低级错误（而本期恰好上线了用户反馈入口）。
