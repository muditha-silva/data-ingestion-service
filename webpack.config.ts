import path from 'path';
import { Configuration } from 'webpack';

const config: Configuration = {
    mode: 'production',
    entry: {       
        'sqs-event-listener-lambda':'./src/sqs-event-listener-lambda.ts',
        's3-messages-retrieval-lambda':'./src/s3-messages-retrieval-lambda.ts',
        'aurora-message-ingestion-lambda':'./src/aurora-message-ingestion-lambda.ts'
    },
    devtool: 'inline-source-map',
    plugins: [],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: [/node_modules/, /bin/]
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    externals: [
        'aws-sdk',
        'aws-xray-sdk'
    ],
    target: 'node',
    output: {
        filename: '[name]/index.js',
        libraryTarget: 'commonjs',
        path: path.resolve(__dirname, 'build')
    }
};

export default config;