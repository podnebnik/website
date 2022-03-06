const path = require("path")
const webpack = require("webpack")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const { CleanWebpackPlugin } = require("clean-webpack-plugin")
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

const PROJECT = "podnebnik"
const PUBLIC_PATH = "/static/frontend/"

function resolve(filePath) {
    return path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath)
}

module.exports = (env, argv) => {
    var plugins = []

    const mode = argv.mode === "production" ? "production" : "development"
    const isProduction = mode === "production"

    return {
        entry: {
            main: "./frontend/scripts/main.js",
        },

        output: {
            filename: "[name].js",
            chunkFilename: "[id].js",
            path: resolve("./" + PROJECT + PUBLIC_PATH),
            publicPath: PUBLIC_PATH,
        },

        mode: mode,
        devtool: isProduction ? undefined : "eval-source-map",

        plugins: isProduction ?
            plugins.concat([
                new CleanWebpackPlugin(),
                new MiniCssExtractPlugin(),
                // new BundleAnalyzerPlugin(),
            ])
            : plugins.concat([
                new webpack.HotModuleReplacementPlugin(),
            ]),

        devServer: {
            port: 8080,
            host: '127.0.0.1',
            publicPath: PUBLIC_PATH,
            hot: true,
            overlay: {
                warnings: true,
                errors: true
            },
            proxy: {
                "/": {
                    target: "http://127.0.0.1:8000",
                    changeOrigin: true
                }
            },
        },

        module: {
            rules: [
                {
                    test: /\.fs(x|proj)?$/,
                    use: {
                        loader: "fable-loader",
                        options: {
                            silent: false
                        }
                    }
                },
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            comments: false,
                            presets: [
                                ["@babel/preset-env", {
                                    "useBuiltIns": "usage",
                                    "corejs": 3
                                }]
                            ]
                        }
                    }
                },
                {
                    test: /\.(sass|scss|css)$/,
                    use: [
                        isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader',
                        {
                            loader: 'postcss-loader',
                            options: {
                                postcssOptions: {
                                    plugins: ['postcss-flexbugs-fixes', 'postcss-preset-env']
                                }
                            }
                        },
                        'sass-loader'
                    ]
                },
                {
                    test: /\.(woff|woff2|eot|ttf|otf)$/,
                    loader: 'file-loader',
                    options: {
                        name: '[name].[contenthash].[ext]',
                    }
                },
                {
                    test: /\.(png|svg|jpg|gif)$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                name: '[name].[contenthash].[ext]',
                            }
                        },
                        {
                            loader: 'image-webpack-loader',
                            options: {
                                disable: ! isProduction,
                            }
                        }
                    ]
                }
            ]
        }
    }
}
