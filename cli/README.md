# Registry CLI

Registry（人员信息登记系统）的官方命令行工具，用于与 Registry API 服务交互。
专为 **AI 与脚本** 设计：加 `--json` 后每个命令在 stdout 输出单个合法 JSON 文档，
错误、进度与确认提示一律走 stderr，失败时退出码非 0。

## 构建

```bash
cd cli
make build          # 当前平台 → bin/registry
make build-all      # 5 平台交叉编译
make test           # 单元测试
```

## 快速开始

```bash
./bin/registry init --baseurl http://localhost:3000   # 写入 ~/.registry/config.yaml
./bin/registry health                                  # 连通性自检
./bin/registry collections list
```

配置优先级：CLI flags > 环境变量（`REGISTRY_BASEURL` / `REGISTRY_TOKEN` / `REGISTRY_CONFIG_DIR`）> 配置文件 > 默认值。
`token` 字段是机器凭证：部署时后端同源生成一份 `API_TOKEN` 写入配置文件，
请求自动带 `Authorization: Bearer` 头，后端校验通过才放行。配置文件权限恒为
`0600`，展示一律打码。

## 命令树

```
registry
├── init                              # 初始化配置（交互式）
├── config set/get/path               # 配置管理
├── health                            # API + 数据库健康检查
├── collections                       # 名录
│   ├── list / get / create / update / delete
│   └── members add|remove            # 成员增删（列举走 users list --collection-id）
├── attributes                        # 属性定义（string/number/bool/date/select）
│   ├── list [--scope all|global|collection]
│   └── get / create / update / delete
├── users                             # 人员
│   ├── list [--search --has-code --collection-id] [key=value ...]
│   ├── get <id> [--collection-id]    # 含 profile 与所属名录
│   ├── create / update / delete
│   └── profile update <id> --profiles '{...}'   # merge-patch
├── comments                          # 留言：list/create <userId>；update/delete <commentId>
├── files                             # 人员附件：upload(多文件)/list/download/delete
└── source-files                      # 数据源文件（溯源根，无删除）：upload/list/download
```

## AI 使用指南

1. **标准用法**：所有命令加 `--json`。stdout 恒为单个 JSON 文档，可直接 `jq` /
   `JSON.parse`；错误对象在 stderr（`{"error": "..."}`），退出码非 0 表示失败。
2. **已知例外**：无法解析的命令行（缺参数等极早期错误）在 `--json` 下也以纯文本
   落 stderr —— 此时命令根本没执行，修正调用方式重试即可。
3. **业务错误可编程处理**：API 错误消息含后端业务 code 的场景（如
   `ATTRIBUTE_TYPE_LOCKED`=409 属性有值禁止改类型），按消息中的 code 分支决策。
4. **删除类命令**默认交互确认；非交互 stdin（管道/CI/AI）下 EOF 视为拒绝并失败。
   脚本里请显式加 `--force/-f`。
5. **分页**：list 命令支持 `--page/--page-size`（上限 100）与 `--all`（自动翻页取全量）。
6. **下载**：`files download` / `source-files download` 二进制只落盘；
   省略 `-o` 时用服务器声明的原始文件名存到当前目录，已存在则拒绝覆盖（`-f` 强制）。
7. **多文件上传**：`files upload <userId> <file...>` 循环发 N 个请求逐个上报，
   部分失败时 exit 非 0（已成功的不回滚），JSON 模式输出逐文件结果数组。

## 配置示例

`~/.registry/config.yaml`:

```yaml
baseurl: http://localhost:3000
token: ""    # 机器凭证（与后端 API_TOKEN 一致）
```

## 架构

```
cli/
├── main.go                 # 入口: cmd.SetVersion + cmd.Execute()
├── cmd/                    # Cobra 命令定义（保持薄）
│   ├── root.go             # 全局 flags + PersistentPreRunE 注入 + 统一错误渲染
│   ├── init.go config.go health.go
│   ├── collections.go attributes.go users.go comments.go files.go source_files.go
│   └── helpers.go          # confirm/truncateRunes/parseID/泛型分页列表
└── internal/
    ├── config/             # ~/.registry/config.yaml 读写 + 优先级合并
    ├── client/             # HTTP 客户端（统一信封解析、multipart 上传、流式下载）
    └── output/             # Printer 接口：Table(CJK 对齐)/JSON 双实现
```

新增模块三步走：在对应 `cmd/<mod>.go` 定义 DTO 与 cobra 命令并在其 `init()`
中 `rootCmd.AddCommand(...)` 自我注册 → 需要新端点时扩展 `internal/client`。
