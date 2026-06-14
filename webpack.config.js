const path = require('path');
const webpack = require('webpack');

const DEVELOPMENT = process.env.NODE_ENV === 'development';

module.exports = {
    devServer: {
        headers: { 'Access-Control-Allow-Origin': '*' },
        port: 3002,
    },
    devtool: DEVELOPMENT ? 'source-map' : false,
    entry: { index: './index.js' },
    externals: {},
    experiments: { outputModule: true },
    mode: DEVELOPMENT ? 'development' : 'production',
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react'],
                    },
                },
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(png|jpe?g|gif|svg|webp)$/i,
                type: 'asset/inline',
            },
        ],
    },
    resolve: { extensions: ['.js', '.jsx'] },
    optimization: { minimize: !DEVELOPMENT },
    output: {
        clean: true,
        environment: { dynamicImport: true, module: true },
        filename: process.env.WEBPACK_SERVE ? '[name].js' : '[name].[contenthash].js',
        library: { type: 'module' },
        path: path.resolve('build', 'static'),
    },
    plugins: [],
};
