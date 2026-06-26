# 前端独立部署说明

前端静态资源位于：

- `src/main/resources/static/index.html`
- `src/main/resources/static/config.js`
- `src/main/resources/static/assets/app.css`
- `src/main/resources/static/assets/app.js`
- `src/main/resources/static/favicon.ico`

独立部署时，把上述文件按目录结构发布到 Nginx、对象存储、CDN 或任意静态服务器即可。

## 配置后端地址

编辑 `config.js`：

```js
window.APP_CONFIG = {
  API_BASE_URL: "http://localhost:8080/api"
};
```

同域部署时可保持默认：

```js
window.APP_CONFIG = {
  API_BASE_URL: "/api"
};
```

后端已开启 CORS，前端和后端可以部署在不同端口或不同域名。

## 缓存建议

- `assets/app.css`、`assets/app.js` 可以设置较长缓存。
- `index.html`、`config.js` 建议不缓存，便于快速切换后端地址和发布新版本。
