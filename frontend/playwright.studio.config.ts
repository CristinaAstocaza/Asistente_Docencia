import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',testMatch:['studio.spec.ts','evaluations.spec.ts','upload.spec.ts','sources-chat.spec.ts','flow.spec.ts'],workers:1,timeout:90000,
 use:{baseURL:'http://localhost:3102',channel:'chrome',headless:true,trace:'retain-on-failure'},
 webServer:[
  {command:'node test/serve.cjs',cwd:'../backend',url:'http://127.0.0.1:4102/api/health',timeout:120000,reuseExistingServer:false,env:{PORT:'4102',APP_ORIGIN:'http://localhost:3102'}},
  {command:'npm run dev -- --port 3102',url:'http://localhost:3102/login',timeout:120000,reuseExistingServer:false,env:{API_URL:'http://127.0.0.1:4102',NEXT_DIST_DIR:'.next-studio'}},
 ],
});
