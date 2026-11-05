'use strict';
const fs=require('node:fs');
const file='U_Ilem_4_1.html';
let html=fs.readFileSync(file,'utf8');
const map=(html.match(/src="(data:image[^"]+)"/)||[])[1];
if(!map)throw new Error('Не найдена встроенная карта. Остановка без изменений.');
if(!html.includes('src="./uilem-ollama-fixes.js"')){
  if(!html.includes('</body>'))throw new Error('Не найден </body>.');
  html=html.replace('</body>','<script src="./uilem-ollama-fixes.js"></script>\n</body>');
}
if((html.match(/src="(data:image[^"]+)"/)||[])[1]!==map)throw new Error('Фоновая карта изменилась.');
if(!html.includes('data-object="lighthouse"'))throw new Error('Маркер Маяка не найден.');
fs.writeFileSync(file,html,'utf8');
console.log('PATCH_OK',Buffer.byteLength(html));
