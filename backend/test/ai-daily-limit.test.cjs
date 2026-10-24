process.env.DATABASE_DRIVER='pglite';process.env.PGLITE_PATH='memory://';process.env.NODE_ENV='test';process.env.STORAGE_DRIVER='local';
const {test}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {Database}=require('../dist/database/database');const {AIService}=require('../dist/ai/ai.module');const {settings}=require('../dist/config');
const {userRequestFilter,limaDayStart}=require('../dist/common/ai-usage');const {ProviderPacing}=require('../dist/common/provider-pacing');

test('20 guides are allowed despite hundreds of internal page calls and earlier retries',async()=>{
 const db=new Database(),previous=settings.dailyLimit;settings.dailyLimit=20;
 try{
  await db.executeSchema('CREATE TABLE ai_usage(id uuid PRIMARY KEY,user_id uuid,model text,request_type text,created_at timestamptz DEFAULT now())');
  const user=randomUUID(),service=new AIService(db,{});
  // Old internal usage must not keep the user locked out after the fix.
  await db.query("INSERT INTO ai_usage(id,user_id,model,request_type) SELECT gen_random_uuid(),$1,'test','guide_page' FROM generate_series(1,110)",[user]);
  await db.query("INSERT INTO ai_usage(id,user_id,model,request_type,created_at) VALUES($1,$2,'test','guide',now()-interval '2 days')",[randomUUID(),user]);
  for(let guide=0;guide<20;guide++){
   await service.reserve(user,'guide');
   for(let page=0;page<6;page++)await service.reserve(user,'guide_page');
   await service.reserve(user,'guide_image');
   await service.reserve(user,'template_design');
  }
  const [usage]=await db.query(`SELECT count(*) AS count FROM ai_usage WHERE user_id=$1 AND ${userRequestFilter} AND created_at>=${limaDayStart}`,[user]);assert.equal(Number(usage.count),20);
  await assert.rejects(()=>service.reserve(user,'guide'),error=>error.getStatus()===429&&error.message.includes('20 solicitudes'));
  await service.reserve(user,'guide_page'); // Finish an already admitted request even at the limit.
  await service.reserve(randomUUID(),'guide'); // Limits remain scoped to each user.
 }finally{settings.dailyLimit=previous;await db.onModuleDestroy();}
});

test('provider calls are spaced and separate models have independent schedules',async()=>{
 const waits=[],pacing=new ProviderPacing(()=>1000,async ms=>{waits.push(ms);});
 await pacing.acquire('text',12);await pacing.acquire('text',12);await pacing.acquire('text',12);await pacing.acquire('other-model',12);
 assert.deepEqual(waits,[5000,10000]);
});
