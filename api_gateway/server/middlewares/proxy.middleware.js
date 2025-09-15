const { createProxyMiddleware } = require("http-proxy-middleware");

const proxyTo = (mountPath, target, attachUserHeaders = true) => {
  if (!target) throw new Error("Proxy target is required");

  const prepareRequest = (req, res, next) => {
    console.log(`Proxying ${req.method} ${req.originalUrl}`);
    if (attachUserHeaders && req.user) {
      const userId = (req.user._id || req.user.id).toString();
      req.headers["x-user-id"] = userId;
      req.headers["x-user-email"] = req.user.email || "";
      //console.log(
      //  "👤 User headers attached:",
      //  req.headers["x-user-id"],
      //  req.headers["x-user-email"]
      //);
    }
    next();
  };

  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    timeout: 60000,
    proxyTimeout: 60000,
    pathRewrite: (pathReq, req) => {
      const original = req.originalUrl;
      const newPath = original.replace(/^\/api/, "");
      console.log(`Path rewritten: ${original} -> ${newPath}`);
      return newPath;
    },
    onProxyReq: (proxyReq, req) => {
      console.log(`onProxyReq called for ${req.method} ${req.originalUrl}`);
      if (req.rawBody && ["POST", "PUT", "PATCH"].includes(req.method)) {
        console.log("Writing rawBody to proxyReq:", req.rawBody.toString());
        proxyReq.setHeader("Content-Length", Buffer.byteLength(req.rawBody));
        proxyReq.write(req.rawBody);
        
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`Response from ${target}: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      console.error(`Proxy error for ${req.originalUrl}:`, err);
      if (!res.headersSent) {
        res.status(502).json({
          message: "Failed to connect to the downstream service",
          error: err.message,
        });
      }
    },
    selfHandleResponse: false, // let proxy pipe back
  });

  return [prepareRequest, proxy];
};

module.exports = { proxyTo };
