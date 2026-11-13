/* eslint-disable @typescript-eslint/no-require-imports -- isolated security ports */
const test=require('node:test'),assert=require('node:assert/strict');
const {loadModules}=require('../scripts/migrate-single-sheet.cjs');
const {AccessError}=loadModules()('./access-error');
function harness(){return {load:loadModules()};}
test('mutation rejects foreign origins, non-JSON and excessive request bodies before authorization',async()=>{
 let authCalls=0;
 const load=loadModules({'@/lib/access':{AccessError,apiError:e=>Response.json({error:e.message},{status:e.status||503}),requireAccount:async()=>{authCalls++;throw Error('Must not authenticate');}},'@/lib/audit-delivery':{flushPendingAudits:async()=>{}}});
 const post=load('./mutation-security').secureMutation(async()=>Response.json({}),{action:'synthetic',orderWrite:false});
 for(const [headers,body,status]of [[{'Content-Type':'application/json'},'{}',403],[{'Content-Type':'application/json',Origin:'https://evil.example'},'{}',403],[{'Content-Type':'text/plain',Origin:'http://localhost'},'{}',415],[{'Content-Type':'application/json',Origin:'http://localhost'},JSON.stringify({large:'x'.repeat(512*1024)}),413]]){
  const response=await post(new Request('http://localhost/api/orders',{method:'POST',headers,body}));assert.equal(response.status,status);
 }
 assert.equal(authCalls,0);
});
test('Redis REST adapter uses authenticated POST, non-expiring SET NX and owner-only unlock; errors fail closed',async context=>{
 const keys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','GOOGLE_SHEET_ID'];const original=Object.fromEntries(keys.map(key=>[key,process.env[key]]));context.after(()=>keys.forEach(key=>{if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}));
 process.env.UPSTASH_REDIS_REST_URL='https://redis.example.test';process.env.UPSTASH_REDIS_REST_TOKEN='mock-test-token';process.env.GOOGLE_SHEET_ID='mock-test-sheet';
 const data=new Map(),commands=[],events=new Map(),pending=new Set();let failure=false;
 context.mock.method(globalThis,'fetch',async(url,init)=>{assert.equal(new URL(url).origin,'https://redis.example.test');assert.equal(init.headers.Authorization,'Bearer mock-test-token');assert.equal(init.method,'POST');const command=JSON.parse(init.body);commands.push(command);if(failure)return new Response(JSON.stringify({error:'unavailable'}),{status:503});let result;
 if(command[0]==='SET'){assert.equal(command.length,4);assert.equal(command[3],'NX');result=data.has(command[1])?null:'OK';if(result)data.set(command[1],command[2]);}
 else if(command[0]==='EVAL' && command[1].includes("redis.call('GET'")){const key=command[3],token=command[4];result=data.get(key)===token?1:0;if(result)data.delete(key);}
 else if(command[0]==='EVAL' && command[1].includes("redis.call('INCR'") && !command[1].includes('local out=')){const key=command[3];result=(data.get(key)||0)+1;data.set(key,result);assert(command[1].includes("redis.call('EXPIRE'"));}
 else if(command[0]==='EVAL' && command[1].includes("redis.call('HSET'")){events.set(command[5],command[6]);pending.add(command[5]);result=1;}
 else if(command[0]==='EVAL' && command[1].includes('local out=')){result=[...pending].map(id=>events.get(id));assert.equal(command[2],3);}
 else if(command[0]==='ZREM'){result=pending.delete(command[2])?1:0;}
 else throw new Error('Unexpected command');return new Response(JSON.stringify({result}),{headers:{'Content-Type':'application/json'}});});
 const {load}=harness({realStore:true});const store=load('@/lib/security-store');const release=await store.acquireWriteLock();await assert.rejects(store.acquireWriteLock(),e=>e.status===423);const key=commands[0][1];data.set(key,'another-owner');await release();assert.equal(data.get(key),'another-owner');data.delete(key);
 const release2=await store.acquireWriteLock();await release2();assert.equal(data.has(key),false);
 await store.consumeRate('user@example.test','save',1);await assert.rejects(store.consumeRate('user@example.test','save',1),e=>e.status===429);
 const event={id:'test-event',timestamp:'2026-10-30',email:'user@example.test',action:'test',target:'O1',details:'hash',outcome:'completed'};await store.saveAuditEvent(event);assert.deepEqual(await store.pendingAuditEvents(),[event]);await store.acknowledgeAudit(event.id);assert.deepEqual(await store.pendingAuditEvents(),[]);
 failure=true;await assert.rejects(store.acquireWriteLock(),e=>e.status===503);delete process.env.UPSTASH_REDIS_REST_TOKEN;await assert.rejects(store.acquireWriteLock(),e=>e.status===503);
});
