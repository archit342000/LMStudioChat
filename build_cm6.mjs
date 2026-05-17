import * as esbuild from 'esbuild';

const deps = [
    'codemirror',
    '@codemirror/state',
    '@codemirror/view',
    '@codemirror/language',
    '@codemirror/commands',
    '@codemirror/language-data',
    '@codemirror/theme-one-dark',
    '@codemirror/lang-python',
    '@codemirror/lang-javascript',
    '@codemirror/lang-html',
    '@codemirror/lang-css',
    '@codemirror/lang-json',
    '@codemirror/lang-cpp',
    '@codemirror/lang-markdown',
    '@lezer/highlight'
];

const buildContent = `
    export * from 'codemirror';
    export * from '@codemirror/state';
    export * from '@codemirror/view';
    export * from '@codemirror/language';
    export * from '@codemirror/commands';
    export { languages } from '@codemirror/language-data';
    export { oneDark } from '@codemirror/theme-one-dark';
    export { python } from '@codemirror/lang-python';
    export { javascript } from '@codemirror/lang-javascript';
    export { html } from '@codemirror/lang-html';
    export { css } from '@codemirror/lang-css';
    export { json } from '@codemirror/lang-json';
    export { cpp } from '@codemirror/lang-cpp';
    export { markdown, markdownLanguage } from '@codemirror/lang-markdown';
    export { tags } from '@lezer/highlight';
`;

// esbuild allows providing stdin to avoid a temporary file for the entry point
try {
    await esbuild.build({
        stdin: {
            contents: buildContent,
            resolveDir: process.cwd(),
            loader: 'js',
        },
        bundle: true,
        format: 'esm',
        outfile: 'static/js/cm6.bundle.js',
        minify: true,
        legalComments: 'none',
        platform: 'browser',
    });
    console.log('Successfully rebuilt static/js/cm6.bundle.js');
} catch (e) {
    console.error('Build failed:', e);
    process.exit(1);
}
