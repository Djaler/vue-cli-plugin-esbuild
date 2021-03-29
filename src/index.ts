/* eslint-disable global-require */
import { PluginAPI, ProjectOptions, ServicePlugin } from '@vue/cli-service';
import browserslist from 'browserslist';
import { ESBuildMinifyPlugin } from 'esbuild-loader';
import fs from 'fs';
import Config from 'webpack-chain';
import { hasDecorator } from './helpers/typescript';

interface EsbuildPluginOptions {
    emitDecoratorMetadata?: boolean | string[];
}

function hasEsbuildPluginOptions(pluginsOptions: any): pluginsOptions is { esbuild: EsbuildPluginOptions } {
    return 'esbuild' in pluginsOptions;
}

const plugin: ServicePlugin = (api, projectOptions) => {
    api.chainWebpack((config) => {
        const target = browserslist()
            .map(value => value.replace(/\s/g, ''));

        const jsRule = config.module.rule('js').test(/\.m?jsx?$/);

        configureJs(jsRule, api, target);

        const tsRule = config.module.rules.get('ts');

        if (tsRule) {
            configureTs(tsRule, api, target, projectOptions);
        }

        configureMinimizer(config, target);
    });
};

function configureJs(jsRule: Config.Rule<Config.Module>, api: PluginAPI, target: string[]) {
    jsRule.uses.clear();

    jsRule.use('cache-loader')
        .loader(require.resolve('cache-loader'))
        .options(api.genCacheConfig('js-esbuild-loader', {
            target,
            esbuildLoaderVersion: require('esbuild-loader/package.json').version,
        }));

    jsRule
        .use('esbuild-loader')
        .loader('esbuild-loader')
        .options({
            target,
        });
}

function configureTs(tsRule: Config.Rule<Config.Module>, api: PluginAPI, target: string[], projectOptions: ProjectOptions) {
    let emitDecoratorMetadata = false;
    let allowedDecorators: string[] | undefined;
    if (projectOptions.pluginOptions && hasEsbuildPluginOptions(projectOptions.pluginOptions)) {
        emitDecoratorMetadata = !!projectOptions.pluginOptions.esbuild.emitDecoratorMetadata;
        if (Array.isArray(projectOptions.pluginOptions.esbuild.emitDecoratorMetadata)) {
            allowedDecorators = projectOptions.pluginOptions.esbuild.emitDecoratorMetadata;
        }
    }

    tsRule.uses.clear();

    if (emitDecoratorMetadata) {
        const fileHasNoDecorators = (path: string) => {
            try {
                path = path.replace(/\.vue\.ts$/, '.vue');
                const content = fs.readFileSync(path).toString();

                if (!allowedDecorators) {
                    return !hasDecorator(content);
                }
                return !hasDecorator(content, allowedDecorators);
            } catch (e) {
                console.error('Unexpected error', e);
                return false;
            }
        };

        const tsRuleWithoutDecorators = tsRule.oneOf('esbuild')
            .test(fileHasNoDecorators);
        configureTsEsbuild(tsRuleWithoutDecorators, api, target);

        const tsRuleWithDecorators = tsRule.oneOf('ts-loader');
        configureTsLoader(tsRuleWithDecorators, api, target, projectOptions);
    } else {
        configureTsEsbuild(tsRule, api, target);
    }
}

function configureTsEsbuild(tsRule: Config.Rule<unknown>, api: PluginAPI, target: string[]) {
    tsRule.use('cache-loader')
        .loader(require.resolve('cache-loader'))
        .options(api.genCacheConfig('ts-esbuild-loader', {
            target,
            esbuildLoaderVersion: require('esbuild-loader/package.json').version,
            // eslint-disable-next-line import/no-extraneous-dependencies
            typescriptVersion: require('typescript/package.json').version,
        }, 'tsconfig.json'));

    tsRule
        .use('esbuild-loader')
        .loader('esbuild-loader')
        .options({
            target,
            loader: 'ts',
        });
}

function configureTsLoader(tsRule: Config.Rule<unknown>, api: PluginAPI, target: string[], projectOptions: ProjectOptions) {
    const useThreads = process.env.NODE_ENV === 'production' && !!projectOptions.parallel;

    tsRule.use('cache-loader')
        .loader(require.resolve('cache-loader'))
        .options(api.genCacheConfig('ts-loader', {
            'ts-loader': require('ts-loader/package.json').version,
            // eslint-disable-next-line import/no-extraneous-dependencies
            typescript: require('typescript/package.json').version,
            modern: !!process.env.VUE_CLI_MODERN_BUILD,
        }, 'tsconfig.json'));

    if (useThreads) {
        tsRule.use('thread-loader')
            .loader(require.resolve('thread-loader'))
            .options(typeof projectOptions.parallel === 'number'
                ? { workers: projectOptions.parallel }
                : {});
    }

    if (api.hasPlugin('babel')) {
        tsRule.use('babel-loader')
            .loader(require.resolve('babel-loader'));
    }

    tsRule
        .use('ts-loader')
        .loader(require.resolve('ts-loader'))
        .options({
            transpileOnly: true,
            appendTsSuffixTo: ['\\.vue$'],
            // https://github.com/TypeStrong/ts-loader#happypackmode-boolean-defaultfalse
            happyPackMode: useThreads,
        });
}

function configureMinimizer(config: Config, target: string[]) {
    (config.optimization as any).minimizers.delete('terser');

    config.optimization.minimizer('esbuild-minify')
        .use(ESBuildMinifyPlugin, [{
            target,
        }]);
}

export = plugin;
