//@ts-check
import * as esbuild from 'esbuild';
import * as fs from 'node:fs'; // Add this import

/** @type {esbuild.Plugin} */
const utilStubPlugin = {
    name: 'util-stub',
    setup(build) {
        build.onResolve({ filter: /^util$/ }, () => ({ path: 'util', namespace: 'util-stub' }));
        build.onLoad({ filter: /.*/, namespace: 'util-stub' }, () => {
            console.log('[Build] Injecting util-stub into bundle...'); // Logs during npm run build
            return {
                contents: `
                    console.log('--- UTIL SHIM INITIALIZED ---');
                    export const types = { 
                        isUint8Array: (v) => v instanceof Uint8Array,
                        isAnyArrayBuffer: (v) => v instanceof ArrayBuffer 
                    }; 
                    export default { types };
                `,
                loader: 'js'
            };
        });
    },
};

const watch = process.argv.includes('--watch');
const minify = process.argv.includes('--minify');

const success = (/** @type {string} */ name) => `${getTime()} ${name} build succeeded`;

function getTime() {
    const date = new Date();
    return `[${`${padZeroes(date.getHours())}:${padZeroes(date.getMinutes())}:${padZeroes(date.getSeconds())}`}] `;
}

/**
 * @param {number} i
 */
function padZeroes(i) {
    return i.toString().padStart(2, '0');
}

const createPlugin = (/** @type {string} */ name) => ({
    name: 'watch-plugin',
    /**
     * @param {{ onEnd: (arg0: (result: any) => void) => void; }} build
     */
    setup(build) {
        build.onEnd(result => {
            if (result.errors.length === 0) {
                console.log(success(name));
            }
        });
    },
});

/** @type {esbuild.BuildOptions} */
const desktopConfig = {
    entryPoints: {
        'extension/main': 'src/extension/main.ts',
        'language/main': 'src/language/main.ts'
    },
    outdir: 'out',
    bundle: true,
    target: "es2017",
    format: 'cjs',
    outExtension: { '.js': '.cjs' },
    external: ['vscode'],
    platform: 'node',
    sourcemap: !minify,
    minify,
    plugins: [createPlugin('Desktop')]
};

/** @type {esbuild.BuildOptions} */
const webConfig = {
    entryPoints: { 'browser/extension': 'src/extension/main.ts' },
    outdir: 'out',
    bundle: true,
    target: "es2017",
    format: 'cjs',
    outExtension: { '.js': '.cjs' },
    // Only 'vscode' is external here so that 'util' and 'path' aliases get bundled
    external: ['vscode'],
    platform: 'browser',
    mainFields: ['browser', 'module', 'main'],
    alias: {
        'vscode-languageclient/node.js': 'vscode-languageclient/browser.js',
        'path': 'path-browserify'
    },
    define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'globalThis'
    },
    banner: {
        js: `console.log('%c BUNDLE LOADED AT: ${new Date().toISOString()} ', 'background: #222; color: #bada55');`
    },
    sourcemap: !minify,
    minify,
    plugins: [utilStubPlugin, createPlugin('Web')]
};

/** @type {esbuild.BuildOptions} */
const webServerConfig = {
    entryPoints: { 'language/main-browser': 'src/language/main-browser.ts' },
    outdir: 'out',
    bundle: true,
    target: "es2020",
    format: 'iife',
    platform: 'browser',
    // We mark these as external to ensure esbuild doesn't generate standard require() calls
    external: ['vscode', 'path', 'os', 'child_process', 'fs', 'crypto'],
    mainFields: ['browser', 'module', 'main'],
    alias: {
        'util': 'path-browserify',
        'path': 'path-browserify'
    },
    banner: {
        js: `
/* Web Worker Environment Fix */
var self = this;
var global = self;
var process = { env: { NODE_ENV: 'production' }, binding: function() { return {}; }, nextTick: function(f) { setTimeout(f, 0); } };
var require = function(n) { 
    if (n === 'util') return { types: {} };
    return {}; 
};
`
    },
    define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'self'
    },
    sourcemap: !minify,
    minify,
    plugins: [createPlugin('Web-Server')]
};

async function run() {
    const desktopCtx = await esbuild.context(desktopConfig);
    const webCtx = await esbuild.context(webConfig);
    const webServerCtx = await esbuild.context(webServerConfig);

    if (watch) {
        await Promise.all([desktopCtx.watch(), webCtx.watch(), webServerCtx.watch()]);
    } else {
        await Promise.all([desktopCtx.rebuild(), webCtx.rebuild(), webServerCtx.rebuild()]);
        desktopCtx.dispose();
        webCtx.dispose();
        webServerCtx.dispose();
    }
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});