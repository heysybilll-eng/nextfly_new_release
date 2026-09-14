# 设计素材

按 App 版本分目录存放。这里是**原图**，不是上线用的——上线资产由
`release-notes/ios/tools/build-assets.mjs` 从这里转码生成，输出到
`release-notes/ios/releases/v<版本>/assets/`。

```bash
cd release-notes/ios
node tools/build-assets.mjs --src ../../pics/2.0.6
```

## 不要改文件名

`build-assets.mjs` 里的映射表是按**原始文件名**写死的（`1.PNG`、`Group 2.png`
这些），改名会导致匹配不到而构建失败。名字不好看是事实，但它是版本与功能块之
间的唯一对应关系，重命名要连映射表一起改。

解析器能容忍 iOS 截图导出带的时间戳后缀，所以 `3.PNG` 存成
`3 18.40.03.PNG` 仍然能匹配上。

## 2.0.5

| 文件 | 功能块 | 画面 |
|---|---|---|
| `1.PNG` | 1 界面优化 | 首页，深色 |
| `Group 2.png` | 2 账号互通 | Login & security |
| `3 18.40.03.PNG` | 3 深色模式 | 设置页，深色 |
| `2.PNG` | 4 会员到期 | 设置页，浅色 |
| `4.PNG` | 5 行程数据 | My Trips，flight passport |
| `rocket-lineart-even@2x.png` | hero | 火箭线稿，黑 |
| `rocket-lineart-even-white@2x.png` | hero | 火箭线稿，白（深色模式用） |

`2.PNG` 和 `3.PNG` 看起来错位是因为它们是**同一个设置页的浅色版和深色版**：深
色那张用来演示深色模式，浅色那张用来演示会员到期行。顺序是刻意的。

## 2.0.6

见 `2.0.6/README.md`——目录是空的，等素材。
