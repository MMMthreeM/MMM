/* eslint-disable @typescript-eslint/no-require-imports -- offline TypeScript conversion runner */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function loadModules(overrides={}){
  const cache=new Map();
  function load(name,parent=path.resolve(__dirname,'../lib/_entry.ts')){
    if(Object.hasOwn(overrides,name))return overrides[name];
    if(name==='server-only')return {};
    if(name.startsWith('node:'))return require(name);
    if(!name.startsWith('.')&&!name.startsWith('@/'))throw Error('Offline converter prohibits external dependencies');
    const file=(name.startsWith('@/')?path.resolve(__dirname,'..',name.slice(2)):path.resolve(path.dirname(parent),name))+'.ts';
    if(cache.has(file))return cache.get(file).exports;
    const m={exports:{}};cache.set(file,m);
    const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename:file})(n=>load(n,file),m,m.exports);return m.exports;
  }
  return load;
}
if(require.main===module){
  const args=process.argv.slice(2);
  if(args.length!==4||args[0]!=='--source'||args[2]!=='--out')throw Error('Usage: --source private-snapshot.json --out private-prepared.json (offline only)');
  const input=JSON.parse(fs.readFileSync(args[1],'utf8'));
  if(input.sourceSpreadsheetId===input.targetSpreadsheetId)throw Error('Source and target must differ');
  if(input.target.Orders.slice(1).some(r=>r.some(v=>v!==''))||input.target.Draft_Item_State.slice(1).some(r=>r.some(v=>v!==''))||input.target.Order_History.slice(1).some(r=>r.some(v=>v!=='')))throw Error('Target business tables must be empty');
  const prepared=loadModules()('./single-sheet-import.server').prepareSingleSheetImport(input.source.Orders,input.sourceSpreadsheetId);
  const output=path.resolve(args[3]);if(fs.existsSync(output))throw Error('Prepared manifest already exists; reuse its stable IDs, do not overwrite');
  fs.writeFileSync(output,JSON.stringify({...prepared,targetSpreadsheetId:input.targetSpreadsheetId},null,2),{flag:'wx'});
  console.log(JSON.stringify({mode:'prepared-not-applied',...prepared.summary,sourceDigest:prepared.sourceDigest}));
}
module.exports={loadModules};
