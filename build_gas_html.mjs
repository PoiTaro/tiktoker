import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('webui/index.html');
const cssPath = path.resolve('webui/style.css');
const jsPath = path.resolve('webui/app.js');
const outputPath = path.resolve('gas/Index.html');

let html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

html = html.replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n</style>`);
html = html.replace('<script src="app.js"></script>', `<script>\n${js}\n</script>`);

fs.writeFileSync(outputPath, html, 'utf8');
console.log('🎉 Successfully bundled webui/ into gas/Index.html!');
