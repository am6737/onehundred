# 一百件事管理后台 Web

这是与 Expo App 完全独立的后台管理前端工程。

## 本地开发

```bash
cd admin-web
npm install
npm run dev
```

浏览器访问 `http://localhost:5174`。

## 生产构建

```bash
npm run build
npm run preview
```

构建产物位于 `admin-web/dist/`，可独立部署到 Vercel、Cloudflare Pages、Netlify 或任意静态服务器。
