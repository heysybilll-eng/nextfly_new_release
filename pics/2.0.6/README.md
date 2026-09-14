# 2.0.6 素材

这里是**原图**。上线资产由 `release-notes/ios/tools/build-assets.mjs` 从这里转码
生成，输出到 `release-notes/ios/releases/v2.0.6/assets/`。

## 对应关系

| 文件 | 功能块 | 画面 |
|---|---|---|
| `他人航班关注.PNG` | 1 关注角色 | Who's it for? sheet（Drop-off/Pick-up + 角色网格） |
| `行程筛选器.PNG` | 2 按人筛选 | My Trips 顶部筛选栏 + 带角色标签的行程卡 |
| `备注.PNG` | 3 航班备注 | My Trips 行程卡上的备注行 |
| `自定义键盘.PNG` | 4 航班号键盘 | 搜索页 + 自定义键盘 |
| `小组件.PNG` | 5 主屏小组件 | 主屏，NextFly 小组件 |
| `实时活动_new.PNG` | 6 灵动岛焕新 | 锁屏实时活动 |
| `用户反馈页面.PNG` | 7 意见反馈 | Feedback「How can we help?」 |
| `header.png` | hero | 首屏插图，**黑**线稿，透明底 |
| `0_3-white-line-transparent-4x.png` | hero | 首屏插图，**白**线稿，透明底（深色模式用） |

未进 H5 的备用图：`角色管理入口.PNG`、`角色管理列表.PNG`、`新建角色.PNG`、
`用户反馈入口.PNG`。

## 两件要注意的

**插图必须是透明底。** 深色模式直接换成白色那张，不做反色处理。如果是白底
PNG，深色下会出现一个白色方块。

**黑色版 `header.png` 只有 634px（约 1.86x）**，白色版是 4x。黑线稿在
Retina 上会比白线稿糊，建议按 4x 重新导出。

## 改图之后

```bash
cd release-notes/ios
node tools/build-assets.mjs --src ../../pics/2.0.6
# 把它打印出的固有尺寸填回 releases/v2.0.6/index.html 的 width/height
npm run check          # 214 条样式断言 + 66 组布局扫描
node tools/dist.mjs    # 出包
```

文件名是映射关系的一部分，改名要连 `tools/build-assets.mjs` 里的 `from` 字段
一起改；解析器按文件名主干匹配，所以 iOS 导出带的时间戳后缀不用手动去掉。
