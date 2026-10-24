process.env.STORAGE_DRIVER='local';
const {test,mock}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const dns=require('node:dns/promises');
const https=require('node:https');
const {fetchWebSource}=require('../dist/documents/web-source');

test('web fetching supports Node lookup all mode, redirects and blocked sites',async()=>{
 const addresses=[{address:'93.184.215.14',family:4}];
 mock.method(dns,'lookup',async()=>addresses);
 let status=200,location;
 mock.method(https,'request',(url,options,respond)=>{
  options.lookup(url.hostname,{all:true},(error,result)=>{assert.equal(error,null);assert.deepEqual(result,addresses);});
  options.lookup(url.hostname,{},(error,address,family)=>{assert.equal(address,addresses[0].address);assert.equal(family,4);});
  const req=new EventEmitter();req.destroy=()=>{};
  req.end=()=>queueMicrotask(()=>{
   const res=new EventEmitter();res.statusCode=status;res.headers={'content-type':'text/html',location};res.destroy=()=>{};res.resume=()=>{};
   respond(res);
   if(status===200){res.emit('data',Buffer.from('<script>hidden</script><h1>Article</h1><p>Useful &amp; readable</p>'));res.emit('end');}
  });return req;
 });
 try{
  assert.equal(await fetchWebSource('https://example.com'),'Article Useful & readable');
  status=403;await assert.rejects(()=>fetchWebSource('https://example.com'),/bloquea la lectura/);
  status=302;location='/loop';await assert.rejects(()=>fetchWebSource('https://example.com'),/HTTPS/);
  dns.lookup.mock.mockImplementation(async()=>[{address:'127.0.0.1',family:4}]);
  await assert.rejects(()=>fetchWebSource('https://example.com'),/no permitida/);
 }finally{mock.restoreAll();}
});
