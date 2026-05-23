const CompressionPlugin = require("compression-webpack-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");

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
};
