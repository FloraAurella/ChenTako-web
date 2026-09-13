import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const source = new URL('../src/resources/themes/tako-festival-theme-v1.json',import.meta.url);
const output = new URL('../examples/tako-festival-package.json',import.meta.url);
const theme = JSON.parse(readFileSync(source,'utf8'));
mkdirSync(new URL('../examples/',import.meta.url),{recursive:true});
writeFileSync(output, JSON.stringify(theme,null,2)+'\n');
console.log(`已生成 ${output.pathname}`);
