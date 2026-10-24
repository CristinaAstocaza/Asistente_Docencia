const {mkdirSync,copyFileSync}=require('node:fs');
const {resolve,dirname}=require('node:path');
const entry=require.resolve('pptx-preview');
const target=resolve(__dirname,'../public/vendor/pptx-preview.umd.js');
mkdirSync(dirname(target),{recursive:true});
copyFileSync(resolve(dirname(entry),'pptx-preview.umd.js'),target);
