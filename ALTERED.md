# 魔改说明

本仓库是 [hugo-theme-reimu](https://github.com/D-Sketon/hugo-theme-reimu) 的**非官方魔改版**，为
[紗夕里の小窝](https://blog.ovofish.com) 的站点需求而改。上游原文档见 [README.md](README.md)，
许可证见 [LICENSE](LICENSE)（MIT，版权归 D-Sketon 所有，本仓库未做任何修改）。

## 来源与基线

| 项目 | 值 |
| --- | --- |
| 上游仓库 | <https://github.com/D-Sketon/hugo-theme-reimu> |
| 上游作者 | D-Sketon（<https://d-sketon.github.io/>） |
| 基线版本 | `v0.16.1`（2026-08-02） |
| 已合入 | 上游 `master` `3be8426`（2026-10-25，v0.16.1 之后上游未发新版） |
| 合并方式 | 三方合并（base=v0.16.1 / ours=本地定制 / theirs=上游 master），合并日 2026-11-24 |
| 维护者 | 紗夕里（[herontirel](https://github.com/herontirel)） |

## 改动清单

### 1. 首页全屏 Deck（新增）

首屏是一整屏手写体标题动画，滚轮 / 触屏 / 键盘向下切到第二屏文章卡带；只在首页第 1 页生效，
其余页面完全不受影响。

| 文件 | 说明 |
| --- | --- |
| `layouts/partials/home-hero.html` | 首屏结构 + 单线字形表（标题逐笔书写动画） |
| `layouts/partials/home-backdrop.html` | 第二屏的模糊环境底图（与首屏同一张 banner） |
| `layouts/partials/home-hero-enabled.html` | 开关判定；**并用 posts 集合初始化首页分页器**（见下方「坑」） |
| `assets/css/home-deck.css` | 卡带布局、逐笔动画、模糊底图、移动端适配 |
| `assets/js/home-deck.js` | 滚轮 / 触屏 / 键盘切换，含锁与防抖 |
| `layouts/_default/baseof.html` | 装配 `$homeHero`、加 `body.home-deck`、按条件 SSR 直出夜间主题 |
| `layouts/partials/head.html` | 按门槛加载 deck CSS（`resources.Get` + minify + fingerprint） |
| `layouts/partials/afterFooter.html` | 按门槛加载 deck JS |
| `layouts/partials/header.html` | 首页第 1 页不渲染 `#header` 横幅（`/page/N/` 照常渲染） |
| `config/_default/params.yml` | 新增 `home_hero` 默认配置（`enable` 默认 `false`） |

开关：

```yaml
params:
  home_hero:
    enable: true    # 默认 false，关掉即回到上游原本的「横幅 + 长列表」首页
    title: ""       # 留空用站点标题；只支持 A-Z a-z 0-9 与空格
    subtitle: ""
    banner: ""      # 留空用站点 banner
    blur: 20        # 第二屏底图高斯模糊半径（px）
    speed: 1.0
```

**为什么 `home-deck.css` 不走主题的 scss 管线**：`helpers/scss.html` 用的是 libsass（Hugo 已弃用），
会把 `clamp()` / `min()` 当 Sass 函数求值，`min(280px, 52vw)` 这种混合单位直接报
`Incompatible units: 'vw' and 'px'`。所以 deck 的样式保留 `.css`，走 Hugo 自带 minify + fingerprint。

**坑（已修）**：`home-hero-enabled.html` 在 `baseof.html` 里就会读 `.Paginator`，而 Hugo 对首页无参
`.Paginator` 的兜底是「全站 RegularPages」，且分页器用 `sync.Once` 只认第一次调用 —— 结果
`index.html` 里的 `.Paginate $posts` 被忽略，首页会混入非 `mainSections` 的页面。修法是先按
`mainSections` 过滤、再初始化分页器，集合与排序要和 `index.html` 保持一致。

### 2. 友链卡片与失联友链页（重写 / 新增）

| 文件 | 说明 |
| --- | --- |
| `layouts/shortcodes/friendsLink.html` | 重写为封面卡片 / 横排头像卡片，支持按 `badge` 分组、按组切换 `style` |
| `layouts/shortcodes/badFriends.html` | 新增：失联友链档案页，条目刻意不可点击（只作档案展示） |
| `assets/css/partials/friend.scss` | 上述两者的样式（追加在文件末尾） |
| `data/friends.yml` | 示例数据补了 `cover` / `tag` / `style` / `remark` 字段说明 |

短代码用法：

```text
{{< friendsLink >}}                  封面卡片，按 badge 分组（默认）
{{< friendsLink "list" >}}           整页横排头像卡片
{{< friendsLink "card" "false" >}}   不分组平铺
{{< friendsLink "compact" >}}        旧版样式，保留兼容
{{< badFriends >}}                   失联友链列表（数据由巡检脚本生成）
```

### 3. 预加载器（重绘）

`assets/css/loader.scss` + `layouts/partials/loader.html`：加载动画改成手绘太极图标。

### 4. 本地化（去外链）

| 文件 | 说明 |
| --- | --- |
| `assets/css/main.scss` | 注入 `$icon_font_url`，填了就用本地图标字体 |
| `assets/css/iconfont.scss` | `$icon-url` 支持本地路径 |
| `layouts/partials/head.html` | iconfont preload 指向本地文件 |

配套做法：**删除** `static/resources/`（上游用它缓存 CDN 资源），改由站点级 `static/vendor/`
+ 站点级 `data/vendor.yml`（整文件覆盖，加 `vendor:` 前缀）统一管理，构建产物零外部静态请求。
本站的字体 / 表情本地化交给 `scripts/localize_external.py`。

### 5. 兼容性与小修

- `assets/js/pjax_main.ts`：原来直接读 `#header > img` 的 `.src`，首页关掉 `#header` 后会抛异常，加了空值保护。
- `layouts/_default/taxonomy.html`、`layouts/archives/section.html`、`layouts/index.html`：
  先排序再交给 `.Paginate`（`.Paginate` 只认传入集合的默认顺序，`ByDate` 之类的链式排序会被丢掉）。
  上游 `master` 后来也修了同一处，合并后已与上游一致。

### 6. 静态资源

`static/images/banner.webp`、`banner.jpg`、`banner1.webp`、`avatar.webp`、`static/img/avatar.webp`
是本站自用图（首页 deck 与站点 banner/头像），二次使用时可直接替换或删除。

## 与「站点级覆盖」的边界

以下定制**不在本仓库**，而在使用本站点的仓库里（`layouts/partials/` 等处），换主题不会带走：

- `layouts/partials/comment.html`（自建 Rustaline 评论）
- `layouts/partials/header.html`（导航下拉菜单）
- `layouts/partials/helpers/vendorGoogleFont.html`（Google Fonts 本地化）
- `layouts/partials/sidebar/commonBar.html`
- `data/vendor.yml`、`data/friends.yml`、`data/bad-friends.yml`
- `scripts/` 下的本地化 / 友链巡检脚本

## 怎么跟上游同步

不要直接 `git pull` 上游覆盖本仓库。用三方合并，把「本地定制」当作一个分支来合：

```bash
# 1. 取上游目标版本，当作 theirs
git clone --depth 1 https://github.com/D-Sketon/hugo-theme-reimu /tmp/up

# 2. 建临时仓库：base = 上次合并的上游版本，ours = 本仓库，theirs = /tmp/up
#    git merge theirs，冲突按「保留本地定制 + 接受上游改动」处理

# 3. 合并结果覆盖回本仓库后提交，并在 ALTERED.md 更新基线版本与合并日期
```

合并前记得给本仓库打 tag（如 `v0.16.1-altered.1`），出问题可以直接回滚。

## 已知限制

- 只针对 Hugo extended ≥ 0.158 验证（主题用 SCSS，必须 extended 版）；实际测试环境 0.168.0。
- `home_hero.title` 的字形表只覆盖 A-Z、a-z、0-9 与空格，中文 / 符号会退化为空白。
- 不保证与上游未来版本的配置项兼容；上游 `params.yml` 改名时需手动对照。
- 不提供 issue 支持，纯粹是自用魔改版，觉得有用可以自行 fork。
