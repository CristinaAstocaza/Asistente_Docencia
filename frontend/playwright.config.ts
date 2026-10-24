import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',testIgnore:['platform.spec.ts','proxy-timeout.spec.ts'],workers:1,timeout:60000,use:{baseURL:'http://localhost:3100',channel:'chrome',headless:true,trace:'retain-on-failure'},
 webServer:[
  {command:'node test/serve.cjs',cwd:'../backend',url:'http://127.0.0.1:4000/api/health',timeout:120000,reuseExistingServer:false,env:{APP_ORIGIN:'http://localhost:3100'}},
  {command:'npm run start -- --port 3100',url:'http://localhost:3100/login',timeout:120000,reuseExistingServer:false},
 ],
});
