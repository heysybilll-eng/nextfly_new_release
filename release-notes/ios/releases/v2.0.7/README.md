# NextFly 2.0.7 H5

沿用 2.0.6 视觉样式与语言选择器；缩短首屏插画，展示天气设置、数字排列、键盘选择、多语言修正及终身会员订阅提醒。适用于 iOS 和 Android；系统字体不在本版范围。

## 交付

- index.html + assets/：静态部署版本。
- index.standalone.html：图片内嵌的单文件版本，已核对图片和文案。
- 不含外部脚本或字体请求；无需构建即可部署。可将 index.html 与 assets/ 一起上传到静态服务器；仅支持单文件上传时使用 index.standalone.html。GitHub 源码上传不代表已部署为网页。

## 语言与主题

保留 11 种语言：en、fr、de、it、es、ja、ko、zh-TW、id、hi、ru。
沿用 URL 参数 lang / locale / hl、v、vw、theme、header、fullbleed。
默认版本 2.0.7；默认跟随系统主题。中文参数解析为繁体中文。?theme=dark 可用于检查深色。

## 素材

三张展示截图来自 pics/2.0.7 的用户原图，PNG/WebP 缩放输出；键盘开关图用 CSS 限定显示区域，原图没有裁切。设置入口图留作参考，不重复展示。
首屏使用用户确认的新手绘旅行者插画，深色配套白线稿；源图保存在 pics/2.0.7，页面使用 hero-v207.png / hero-v207-white.png，避免旧素材缓存。
构建截图可用 tools/build-assets.mjs --release v2.0.7 --src ../../pics/2.0.7。
独立版本：node tools/inline.mjs --release v2.0.7。

## 本轮验证

- 插画替换后实际查看深浅主题首屏，人物、飞机与天气元素显示正常；截图见 .out/v2.0.7/hero-light.png 和 hero-dark.png。

- 浏览器检查 11 语言 × 320/390/430 宽度 × 深浅主题，共 66 组；无横向溢出、空文案、未解析标记或文本容器横向裁切。
- 实际点击语言选择器，从繁体中文切换到英文成功。
- 英文深色、繁体中文浅色完整页面人工查看；三张截图均加载成功。
- 独立 HTML 版本读回：版本正确、4 个内容章节、3 张图片均加载成功。
- 历史项目的样式断言数量不能作为本版已运行结果；本轮未运行旧 Playwright CLI 测试。已补充 v2.0.7 的工具映射。
- 真机 WebView、原生主题联动与多语言母语审校未验证。
