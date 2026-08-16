# Registry 部署指南（hpcore，与 serenique 同款模式）

镜像同时包含 API 与编译后的前端 SPA（Hono 同源 serve，无 nginx）。
部署目录约定：`/srv/compose/registry/`（serenique 同款）。

## 一次性初始化（需要 sudo，/srv/compose 归 root）

```bash
sudo mkdir -p /srv/compose/registry && sudo chown oicey:oicey /srv/compose/registry
```

## 首次部署

```bash
# 1. 构建镜像（仓库根，多阶段：web 构建 → api 合并）
docker build -t zeroicey/registry-api:latest .

# 2. 导出并传到 hpcore
docker save zeroicey/registry-api:latest | gzip > registry-api-latest.tar.gz
scp registry-api-latest.tar.gz hpcore:/srv/compose/registry/

# 3. 在 hpcore 上加载镜像
ssh hpcore 'docker load < /srv/compose/registry/registry-api-latest.tar.gz'

# 4. 准备配置（compose.yml + .env，secrets 在 .env 里）
scp deploy/compose.yml hpcore:/srv/compose/registry/
# 在 hpcore 上编辑：vim /srv/compose/registry/.env（模板见 deploy/.env.example，
# DATABASE_URL 指向 hpcore postgres 上的 registry 库）

# 5. 启动
ssh hpcore 'cd /srv/compose/registry && docker compose up -d'
ssh hpcore 'docker ps | grep registry-api'   # 期望 healthy
```

## 数据库迁移（镜像不自动迁移）

在本地（有 drizzle-kit devDeps），对着远程库执行：

```bash
cd api
DATABASE_URL='postgres://registry:PASSWORD@10.126.126.2:5432/registry' bun run db:migrate
```

## 更新发布

```bash
docker build -t zeroicey/registry-api:latest .
docker save zeroicey/registry-api:latest | gzip > registry-api-latest.tar.gz
scp registry-api-latest.tar.gz hpcore:/srv/compose/registry/
ssh hpcore 'docker load < /srv/compose/registry/registry-api-latest.tar.gz && cd /srv/compose/registry && docker compose up -d --force-recreate'
```

## 验证

- 页面：浏览器打开 `http://10.126.126.2:3100`（LAN）或 `http://localhost:3100`（本机）
- API：`curl http://10.126.126.2:3100/api/health` 期望 `{"success":true,...}`
- 前端同源：`VITE_API_BASE_URL` 留空（构建时即同源，勿在部署构建里设置绝对地址）

## 备注

- 端口 3100：hpcore 上 3000（serenique）/ 3001（vocechat）/ 3002（clipforge）已被占用
- 迁移只走 drizzle-kit；触发器/函数等用 `--custom` 补 SQL（见 `.ai/decisions.md`）
