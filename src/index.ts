/* eslint-disable global-require */
import { ServicePlugin } from '@vue/cli-service';
import browserslist from 'browserslist';
import { ESBuildMinifyPlugin, ESBuildPlugin } from 'esbuild-loader';

const plugin: ServicePlugin = (api) => {
    api.chainWebpack((config) => {
        config.plugin('esbuild')
            .use(ESBuildPlugin);

        const target = browserslist()
            .map(value => value.replace(/\s/g, ''));

        const jsRule = config.module.rule('js').test(/\.m?jsx?$/);

        jsRule.uses
            .delete('thread-loader')
            .delete('babel-loader');

        jsRule.use('cache-loader')
            .loader(require.resolve('cache-loader'))
            .options(api.genCacheConfig('js-esbuild-loader', {
                target,
                esbuildLoaderVersion: require('esbuild-loader/package.json'),
            }));

        jsRule
            .use('esbuild-loader')
            .loader('esbuild-loader')
            .options({
                target,
            });

        const tsRule = config.module.rules.get('ts');

        if (tsRule) {
            tsRule.uses
                .delete('thread-loader')
                .delete('babel-loader')
                .delete('ts-loader');

            tsRule.use('cache-loader')
                .loader(require.resolve('cache-loader'))
                .options(api.genCacheConfig('ts-esbuild-loader', {
                    target,
                    esbuildLoaderVersion: require('esbuild-loader/package.json'),
                    // eslint-disable-next-line import/no-extraneous-dependencies
                    typescriptVersion: require('typescript/package.json'),
                }, 'tsconfig.json'));

            tsRule
                .use('esbuild-loader')
                .loader('esbuild-loader')
                .options({
                    target,
                    loader: 'ts',
                });
        }

        (config.optimization as any).minimizers.delete('terser');

        config.optimization.minimizer('esbuild-minify')
            .use(ESBuildMinifyPlugin, [{
                target,
            }]);
    });
};

export = plugin;
