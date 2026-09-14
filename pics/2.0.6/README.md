# 2.0.6 素材（待补）

目录是空的。H5 已经建好，`releases/v2.0.6/assets/` 里目前是占位图，每张都标了
该放什么画面。把下面 8 个文件放进这个目录，然后跑一条命令就能替换。

## 需要的文件

| 建议文件名 | 功能块 | 画面 |
|---|---|---|
| `1.PNG` | 1 关注角色 | Who's it for? sheet（Drop-off/Pick-up + 角色网格） |
| `2.PNG` | 2 按人筛选 | My Trips 顶部筛选栏 + 带角色标签的行程卡 |
| `3.PNG` | 3 航班号键盘 | 搜索页 + 自定义键盘 |
| `4.PNG` | 4 主屏小组件 | 主屏，NextFly 小组件 |
| `5.PNG` | 5 灵动岛焕新 | 锁屏实时活动 |
| `6.PNG` | 6 意见反馈 | Feedback「How can we help?」 |
| `hero@2x.png` | hero | 新插图，**黑**线稿，透明底 |
| `hero-white@2x.png` | hero | 新插图，**白**线稿，透明底 |

## 两件要注意的

**插图必须是透明底。** 深色模式直接换成白色那张，不做反色处理。如果是白底
PNG，深色下会出现一个白色方块。

**白色版目前还没有。** 已经收到的只有黑线稿那张（拿笔的人 + 灯泡 + 云）。

## 替换步骤

```bash
cd release-notes/ios
node tools/build-assets.mjs --src ../../pics/2.0.6
# 把它打印出的固有尺寸填回 releases/v2.0.6/index.html 的 width/height
npm run check          # 214 条样式断言 + 66 组布局扫描
node tools/dist.mjs    # 出包
```

文件名和上表不一致也行，改 `tools/build-assets.mjs` 里 `MAP` 的 `from` 字段
即可；解析器会按文件名主干匹配，所以 iOS 导出带的时间戳后缀不用手动去掉。
