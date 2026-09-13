import base from '../../playwright.config.js';
export default { ...base, testDir:'../../e2e', webServer:undefined, use:{...base.use,baseURL:'http://127.0.0.1:5173'} };
