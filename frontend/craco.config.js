const CompressionPlugin = require("compression-webpack-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

const shouldAnalyze = process.env.ANALYZE === "true";

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.optimization = {
        ...webpackConfig.optimization,
        runtimeChunk: "single",
        splitChunks: {
          chunks: "all",
          maxInitialRequests: 30,
          maxAsyncRequests: 30,
          cacheGroups: {
            reactVendor: {
              test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
              name: "vendor-react",
              chunks: "all",
              priority: 30,
              enforce: true,
            },
            uiVendor: {
              test: /[\\/]node_modules[\\/](bootstrap|@popperjs)[\\/]/,
              name: "vendor-ui",
              chunks: "all",
              priority: 20,
              enforce: true,
            },
            monacoVendor: {
              test: /[\\/]node_modules[\\/](monaco-editor|@monaco-editor)[\\/]/,
              name: "vendor-monaco",
              chunks: "async",
              priority: 25,
              enforce: true,
            },
            echartsVendor: {
              test: /[\\/]node_modules[\\/](echarts|zrender|echarts-for-react)[\\/]/,
              name: "vendor-echarts",
              chunks: "async",
              priority: 25,
              enforce: true,
            },
            gridLayoutVendor: {
              test: /[\\/]node_modules[\\/]react-grid-layout[\\/]/,
              name: "vendor-grid-layout",
              chunks: "async",
              priority: 25,
              enforce: true,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: "vendor",
              chunks: "all",
              priority: 10,
              reuseExistingChunk: true,
            },
            common: {
              test: /[\\/]src[\\/](api|auth|components|utils)[\\/]/,
              name: "common",
              minChunks: 2,
              chunks: "all",
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        },
      };

      webpackConfig.output = {
        ...webpackConfig.output,
        filename: "static/js/[name].[contenthash:8].js",
        chunkFilename: "static/js/[name].[contenthash:8].chunk.js",
      };

      webpackConfig.plugins.push(
        new CompressionPlugin({
          algorithm: "gzip",
          test: /\.(js|css|html|svg)$/,
          threshold: 10240,
          minRatio: 0.8,
        }),
      );

      // Query Manager's SQL editor lazy-loads Monaco - restrict to the sql
      // language so the (larger) typescript/json/css workers are never bundled.
      webpackConfig.plugins.push(
        new MonacoWebpackPlugin({
          languages: ["sql"],
          filename: "static/js/monaco/[name].worker.[contenthash:8].js",
        }),
      );

      if (shouldAnalyze) {
        webpackConfig.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: "static",
            reportFilename: "bundle-report.html",
            openAnalyzer: false,
          }),
        );
      }

      return webpackConfig;
    },
  },
  devServer: (devServerConfig) => {
    const onBeforeSetupMiddleware = devServerConfig.onBeforeSetupMiddleware;
    const onAfterSetupMiddleware = devServerConfig.onAfterSetupMiddleware;
    const existingSetupMiddlewares = devServerConfig.setupMiddlewares;

    delete devServerConfig.onBeforeSetupMiddleware;
    delete devServerConfig.onAfterSetupMiddleware;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      if (typeof onBeforeSetupMiddleware === "function") {
        onBeforeSetupMiddleware(devServer);
      }

      const nextMiddlewares = typeof existingSetupMiddlewares === "function"
        ? existingSetupMiddlewares(middlewares, devServer)
        : middlewares;

      if (typeof onAfterSetupMiddleware === "function") {
        onAfterSetupMiddleware(devServer);
      }

      return nextMiddlewares;
    };

    return devServerConfig;
  },
};
