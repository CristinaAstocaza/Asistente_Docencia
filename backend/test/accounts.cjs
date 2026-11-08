// There is no public sign-up: tests create accounts through the seeded administrator.
// Test-only administrator password: the real one lives in .env and never in the repository.
process.env.ADMIN_PASSWORD='Prueba-Admin-2026';
const ADMIN={email:'DocenteLino2026',password:process.env.ADMIN_PASSWORD};
const cookieHeader=response=>response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
async function login(base,email,password){
 const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 if(!r.ok)throw new Error(`login ${email}: ${r.status}`);return {user:await r.json(),cookies:cookieHeader(r)};
}
/** Creates a teacher as admin and returns {user, cookies} of a fresh session for that teacher. */
async function createTeacher(base,data){
 const admin=await login(base,ADMIN.email,ADMIN.password);
 const r=await fetch(base+'/auth/users',{method:'POST',headers:{'Content-Type':'application/json',Cookie:admin.cookies},body:JSON.stringify(data)});
 if(r.status!==201)throw new Error(`create ${data.email}: ${r.status} ${await r.text()}`);
 return login(base,data.email,data.password);
}
module.exports={ADMIN,login,createTeacher};
