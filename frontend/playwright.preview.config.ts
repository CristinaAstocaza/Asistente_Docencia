import {defineConfig} from '@playwright/test';
// These tests mock the API and do not touch the teacher's running backend.
export default defineConfig({
 testDir:'./e2e',testMatch:'sources-chat.spec.ts',workers:1,timeout:60000,
 use:{baseURL:'http://localhost:3101',channel:'chrome',headless:true,trace:'retain-on-failure'},
 webServer:{command:'npm run start -- --port 3101',url:'http://localhost:3101/login',timeout:120000,reuseExistingServer:false},
});
