import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root=process.cwd();const failures=[];
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
for(const filename of walk(path.join(root,'src')).filter(f=>/\.[jt]sx?$/.test(f))){
 const relative=path.relative(root,filename);const owner=relative.match(/^src\/modules\/([^/]+)\//)?.[1];
 const source=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true);
 function inspect(node){
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
   const spec=node.moduleSpecifier.text;if(!spec.startsWith('.'))return;
   const target=path.relative(root,path.resolve(path.dirname(filename),spec));const other=target.match(/^src\/modules\/([^/]+)\//)?.[1];
   if(relative.startsWith('src/core/')&&!target.startsWith('src/core/')) failures.push(`${relative}: Core must not import ${target}`);
   if(owner&&target.startsWith('src/app/')) failures.push(`${relative}: module must not import App ${target}`);
   if(other&&other!==owner&&!target.includes('/public/')) failures.push(`${relative}: use public entry for ${target}`);
   if(!['','.js','.ts','.tsx','.json'].some(ext=>fs.existsSync(path.resolve(path.dirname(filename),spec+ext)))) failures.push(`${relative}: missing ${spec}`);
  }
  ts.forEachChild(node,inspect);
 }
 inspect(source);
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('Architecture boundaries passed: Core isolation, module ownership, public imports, resolved paths.');
