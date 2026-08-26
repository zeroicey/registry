# CLI 工具（`registry` 命令）需求与方案

- 日期：2026-08-25
- 状态：**已完成 v1**（reviewer 子代理终审 **APPROVE-with-nits**，五条 P2 建议全部采纳修复；QA 矩阵全绿，端到端冒烟通过）
- 参考项目：`~/workspace/projects/serenique` 的 `apps/cli/`（Go + Cobra，已上线并经过一轮评估定稿）

---

## 一、背景与动机

Registry 后端接口已基本成型（users / attributes / comments / collections / files / source-files），当前工作模式是：**大部分数据操作（导入、更新、处理冲突）由 AI 完成，人只做查询，前端需求很少。**

现状痛点：

1. AI 每次操作都要现场手写 curl / bun 脚本 / HTTP 请求代码，重复劳动且容易出错；
2. 批量导入目前依赖一次性脚本直连数据库（如 `scripts/local/import-cpzx-robust.ts`），没有统一、可复用的操作入口。

因此需要一个 **CLI 命令行工具**：

1. **简化 AI 操作** —— AI 直接执行 `registry <子命令>` 即可完成增删改查，不用再写请求语法；
2. **结合脚本执行** —— AI 可用 Bash/Python 脚本循环调用 CLI 完成文件上传与数据导入，不必每次从零写导入程序。

## 二、目标与非目标

### 目标（v1）

- 单一 Go 二进制 `registry`，覆盖现有全部 REST API 模块；
- 配置存于 `~/.registry/config.yaml`（隐藏目录，主流做法），支持环境变量与 flag 覆盖；
- 为后续鉴权预留 `token` 字段（当前后端无鉴权，字段先占位）；
- `--json` 输出模式专为 AI/脚本设计：stdout 只输出单个合法 JSON 文档，错误/进度/确认全部走 stderr，失败退出码非 0。

### 非目标（明确推迟）

| 项 | 说明 |
| ---- | ------ |
| 鉴权流程 | 后端无健全鉴权；`auth login/logout` 等 v1 不做，token 仅预留配置字段 |
| 超大批量导入替代 | 万行级导入仍可走脚本直连库（跨隧道断线续跑场景）；CLI 定位是常规增量操作 + 中小批量 |
| 进度条、多 profile、交互式编辑器 | 列入后续演进 |

## 三、技术栈（照搬 serenique 已验证选型）

| 项 | 选型 | 理由 |
| ---- | ------ | ------ |
| 语言 | Go 1.22+ | 编译快、交叉编译简单、标准库 HTTP/multipart 成熟、gh 先例 |
| CLI 框架 | `github.com/spf13/cobra` | K8s/gh 同款，help 生成、flag 解析完善 |
| 配置解析 | `gopkg.in/yaml.v3` | 轻量；结构简单不需 Viper |
| 表格对齐 | 自研 CJK 显示宽度 padding | tabwriter 按字节计列宽，中文表头会错位（serenique 踩过的坑） |

依赖总量约 4 个（cobra、pflag、mousetrap、yaml.v3）。

## 四、参考项目沉淀：直接规避的技术债

serenique CLI 经评估收尾后留下的遗留问题，本项目**从第一版就规避**：

| serenique 遗留问题 | 本项目对策 |
| -------------------- | ----------- |
| 表格用 tabwriter，CJK 错位 | 自研按显示宽度（中文按 2 列）padding |
| `--config` flag 声明了但 Load 未使用 | 在 `PersistentPreRunE` 里真正接入 `config.SetPath()` |
| 错误被吞、进程一律 exit 0 | 所有命令走 `RunE` 返回 error，`Execute()` 统一渲染一次，失败 exit 1 |
| `--json` 下 stdout 被进度/确认污染 | stdout 只放结果；进度/确认/错误一律 stderr |
| token 明文输出、配置权限过宽 | 展示一律 `maskToken()`；文件 `0600`、目录 `0700`、原子写（temp+rename） |
| 传输无超时、Ctrl-C 处理差 | 根 context 用 `signal.NotifyContext` 派生 + `ResponseHeaderTimeout` |
| `confirm()` 只认 `y/Y`，非交互 stdin 误判成功 | 接受 y/yes（大小写）；管道/CI 下 EOF 视为未确认并返回错误 |
| `--json` 检测靠 os.Args 文本预扫描，边界误判 | 沿用 serenique 已验证的 pflag 语义感知预扫描（含单测），早期错误也能以 JSON 落 stderr |
| delete 204-with-body 传输层噪音 | `client.Delete` 设 `req.Close = true` |
| 列表预览按字节截断产生非法 UTF-8 | 按 rune 截断 |
| 下载路径直接取 originalName | `filepath.Base()` 净化 + 空值兜底 |

## 五、架构设计

```text
cli/
├── main.go                 # 入口: cmd.SetVersion + cmd.Execute()
├── go.mod                  # module github.com/zeroicey/registry-cli
├── Makefile                # build / build-all(5平台) / install / test / lint
├── README.md               # 中文使用 + AI 使用指南
├── cmd/                    # Cobra 命令定义（保持薄）
│   ├── root.go             # 全局 flags + PersistentPreRunE 注入 config/client/printer + 统一错误渲染
│   ├── init.go / config.go
│   ├── collections.go / attributes.go / users.go / comments.go / files.go / source_files.go
│   └── helpers.go          # confirm() / truncateRunes()
└── internal/
    ├── config/             # 配置读写 + 优先级合并
    ├── client/             # HTTP 客户端（统一响应解析、上传下载）
    └── output/             # Printer 接口 + Table/JSON 双实现
```

依赖方向固定：`cmd → internal/{config, client, output}`，三个 internal 包互相独立。
新增模块三步走：`internal/client/<mod>.go`（类型化方法）→ `cmd/<mod>.go`（cobra 命令）→ `root.go` 注册。

### 配置层

- 文件：`~/.registry/config.yaml`，权限 `0600`，目录 `0700`，原子写入；
- 内容：`baseurl` + `token`（占位，后端加鉴权后启用）；
- 优先级：CLI flags > 环境变量（`REGISTRY_BASEURL` / `REGISTRY_TOKEN` / `REGISTRY_CONFIG_DIR`）> 配置文件 > 默认值；
- `registry init --baseurl <url>` 交互式初始化；`registry config path/set/get` 管理；
- baseurl 在加载时 `url.Parse` 预校验，早失败给中文提示。

### 客户端层

- 统一响应解析：registry 后端契约 `{ success, message, code?, data?, error? }`，`do()` 解包，业务错误转成带 `code` 字段的 `APIError`（AI 可直接分支 `ATTRIBUTE_TYPE_LOCKED` 等）；
- 所有 delete 端点返回真·无 body 的 HTTP 204（`new Response(null)`），client 显式处理 204 即成功，无需 serenique 的 `req.Close` 变通；
- 方法集：`Get / Post / Patch / Put / Delete` + `UploadFile`（multipart 流式，支持附加表单字段如 `collectionId`）+ `DownloadFile`（流式落盘）。

## 六、命令树（v1 · 对齐现有 API）

```text
registry
├── init                              # 初始化配置
├── config set/get/path               # 配置管理
├── collections                       # 名录管理
│   ├── list / get <id> / create / update <id> / delete <id>
│   ├── members add <collectionId> <userId...>   # POST /collections/:id/members（幂等，多 userId）
│   └── members remove <collectionId> <userId>   # DELETE /collections/:id/members/:userId
│                                     # 注意：后端无成员列举端点，成员经 users list --collection-id 查询
├── attributes                        # 属性管理
│   └── list [--scope all|global|collection] [--collection-id]
│      / get <id> / create / update <id> / delete <id>
├── users                             # 人员管理
│   ├── list [--search] [--has-code] [--collection-id] [+ 属性过滤 key=value]
│   ├── get <id> [--collection-id]    # 返回含 profile 与所属名录
│   ├── create / update <id> / delete <id>
│   └── profile update <id>           # PATCH /users/:id/profile（merge-patch；无独立 profile get，get 已含）
├── comments                          # 留言
│   └── list <userId> / create <userId> / update <commentId> / delete <commentId>
├── files                             # 人员附件
│   ├── upload <userId> <file...>     # 多文件=循环 N 个请求逐个上报，部分失败 exit≠0
│   ├── list <userId> / download <fileId> [-o 输出路径] / delete <fileId>
├── source-files                      # 数据源文件（溯源根，无删除）
│   ├── upload <file> --collection-id <id>   # collectionId 必填（后端强校验）
│   └── list [--collection-id] / download <id> [-o 输出路径]
└── health                            # 健康检查（连通性自检）
```

全局 flags（PersistentFlags）：`--baseurl/-b`、`--token/-t`（预留）、`--json/-j`、`--config/-c`。
删除类命令默认交互确认（提示走 stderr），`--force/-f` 跳过；非交互 stdin 下 EOF 视为拒绝。
下载类命令（files download / source-files download）：二进制只落盘不进 stdout；`--json` 下 stdout 输出 JSON 摘要（路径、字节数、originalName）。

## 七、AI 对接设计要点

- `registry --json ...` 是 AI 的标准用法：stdout 恒为单个合法 JSON 文档，可放心 `jq` / `JSON.parse`；
- **已知例外**：cobra 在 printer 创建前就完成 args/required-flag 校验，此类极早期错误即使 `--json` 也以纯文本落 stderr（有预扫描兜底，仅限无法解析命令的场景）；
- 错误输出带业务 code（如 `ATTRIBUTE_TYPE_LOCKED`、`USER_NOT_FOUND`），AI 可据此自动决策（409 换类型、重试等）；
- 中文帮助文本 + 示例齐全，AI 依赖 `registry --help` 自学命令；
- 上传/导入场景：AI 用 Bash 循环 `registry files upload ...` 或 Python 调 subprocess，无需写 HTTP 代码。

## 八、验收标准

1. `make build` 出单平台二进制，`make build-all` 出 5 平台产物；
2. 对本地 dev server（`cd api && bun run dev`）走通全流程：init → 建 collection → 建属性 → 建用户 → 改 profile → 上传附件 → 上传 source-file → 各 list/get → 删除（含确认与 --force）；
3. `--json` 模式下每个命令 stdout 可被 `jq .` 正常解析；失败命令 exit ≠ 0 且 stderr 有 `{"error":...}` 或中文错误；
4. 单元测试覆盖 config / client（httptest）/ output / helpers，`make test` 通过；
5. 配置文件权限 0600，token 展示打码。

## 九、实施步骤

1. 脚手架：`cli/` 目录 + go.mod + Makefile + main.go + root.go（全局 flags、配置注入、错误渲染）；
2. internal 三件套：config → output → client（各配单测）；
3. init / config / health 命令，端到端联调打通；
4. 业务模块命令：collections → attributes → users（含 profile）→ comments → files → source-files；
5. README（中文使用指南 + AI 使用指南）；
6. 收尾：`bun test && bun run typecheck`（api 侧不受影响）+ `go vet` / `gofmt` + 冒烟清单过一遍。

## 十、开放问题（已确认）

1. ✅ 命令名 `registry`，代码放仓库根 `cli/` 目录；
2. ✅ 配置目录 `~/.registry/`；
3. ✅ v1 命令树范围如上（超大批量导入仍走脚本直连库，CLI 定位常规增量操作 + 中小批量）。

## 十一、评审记录（2026-08-25 · reviewer 子代理）

### 方案评审（实施前）

结论：FAIL → 修正后进入实施（PASS-with-fixes）。三处阻塞均为命令树与后端不符的笔误：

1. `users profile get`：后端无独立 profile 读取端点，profile 经 `GET /users/:id` 返回 —— 已删除该子命令；
2. `collections members list`：后端无成员列举端点（仅 add/remove）—— 已删除，成员查询走 `users list --collection-id`；`members add` 明确为多 userId 幂等批量；
3. `source-files upload`：漏了必填 `collectionId` 表单字段 —— 已补 `--collection-id <id>`（必填）。

已采纳的非阻塞建议：多文件上传循环 N 个请求、逐个上报、部分失败 exit≠0；下载类命令二进制只落盘不进 stdout，统一命名 `download`，JSON 模式输出摘要；README 注明早期错误在 `--json` 下为纯文本的例外；client 显式处理 204 无 body。

### 代码终审（实施后）

结论：**APPROVE-with-nits**（无阻塞项）。正确性验证通过：后端契约逐一比对无误（含 members userIds[]、profile merge-patch、hasCode 枚举、multipart 字段名、204 真·空 body）、HTTP 资源无泄漏、包级变量模式在 cobra 单进程模型下无竞争、输出契约完整符合、预扫描器逻辑有针对性单测。

五条 P2 建议已全部采纳修复并回归验证：

1. 四处自定义 `--all` 循环改为统一 `walkAllPages` 泛型翻页器，`maxAllPages` 溢出显式报错（不再静默截断 exit 0）；
2. 手写 `stringsCut/indexOf` 替换为标准库 `strings.Cut`；
3. 批量上传逐文件失败行改走 stderr（table 与 json 模式一致，stdout 不混错误噪音）；
4. 裸根命令 `registry --json` 改输出单条 JSON 提示，守住 stdout 单文档契约；
5. 补测试：`walkAllPages` 溢出守卫、下载 Content-Length 截断检测、`client.List` 信封解包、`maskToken` 8/9 字符边界。
