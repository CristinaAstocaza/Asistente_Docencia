import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'platform.spec.ts',workers:1,timeout:90000,use:{baseURL:'http://localhost:3103',channel:'chrome',headless:true,trace:'retain-on-failure'},webServer:[
 {command:'node test/serve.cjs',cwd:'../backend',url:'http://127.0.0.1:4103/api/health',timeout:120000,reuseExistingServer:false,env:{PORT:'4103',APP_ORIGIN:'http://localhost:3103',TEST_PLATFORM_AI:'1'}},
 {command:'npm run start -- --port 3103',url:'http://localhost:3103/login',timeout:120000,reuseExistingServer:false,env:{API_URL:'http://127.0.0.1:4103',NEXT_DIST_DIR:'.next-platform-production'}},
]});
