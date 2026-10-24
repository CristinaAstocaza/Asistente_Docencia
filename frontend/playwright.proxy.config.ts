import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'proxy-timeout.spec.ts',workers:1,timeout:90000,use:{baseURL:'http://localhost:3104',channel:'chrome',headless:true},webServer:[
 {command:'node test/serve.cjs',cwd:'../backend',url:'http://127.0.0.1:4104/api/health',timeout:120000,reuseExistingServer:false,env:{PORT:'4104',APP_ORIGIN:'http://localhost:3104',TEST_PLATFORM_AI:'1',TEST_PLATFORM_AI_DELAY_MS:'35000'}},
 {command:'npm run dev -- --port 3104',url:'http://localhost:3104/login',timeout:120000,reuseExistingServer:false,env:{API_URL:'http://127.0.0.1:4104',NEXT_DIST_DIR:'.next-proxy'}},
]});
