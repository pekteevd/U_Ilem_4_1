'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=__dirname;
const PORT=Number(process.env.PORT||4173);
const MODEL=process.env.OLLAMA_MODEL||'qwen3:4b';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
function reply(res,status,data,type='application/json; charset=utf-8'){
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});
  res.end(type.startsWith('application/json')?JSON.stringify(data):data);
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let body='',size=0;
    req.on('data',chunk=>{size+=chunk.length;if(size>128*1024){reject(new Error('Request too large'));req.destroy();}else body+=chunk;});
    req.on('end',()=>{try{resolve(JSON.parse(body||'{}'));}catch(e){reject(e);}});
    req.on('error',reject);
  });
}
const SYSTEM=[
 'Ты помощник команды симулятора У Илем. Разбери поручение и предложи реалистичный план.',
 'Верни только JSON без markdown: {"reply":"короткий ответ по-русски","tasks":[{"title":"конкретное действие","person":"имя из списка людей","hours":4,"object":"существующий id объекта","materials":[{"name":"точное название ресурса","qty":2,"unit":"шт"}],"priority":"Обычный"}]}.',
 'Не утверждай, что работа уже сделана. Не списывай ресурсы, не меняй деньги, состояние объектов или статусы.',
 'Если данных не хватает, предложи сначала осмотр или уточнение. Указывай только существующие id объектов из контекста.'
].join(' ');
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:'+PORT);
  if(req.method==='GET'&&url.pathname==='/api/health')return reply(res,200,{ok:true,model:MODEL});
  if(req.method==='POST'&&url.pathname==='/api/ollama/chat'){
    try{
      const input=await readBody(req),message=String(input.message||'').trim().slice(0,6000);
      if(!message)return reply(res,400,{error:'Пустое сообщение'});
      const context=input.context&&typeof input.context==='object'?input.context:{};
      const response=await fetch('http://127.0.0.1:11434/api/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:MODEL,stream:false,format:'json',options:{temperature:0.2},messages:[
          {role:'system',content:SYSTEM},
          {role:'user',content:JSON.stringify({request:message,gameContext:context})}
        ]}),
        signal:AbortSignal.timeout(120000)
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)return reply(res,502,{error:result.error||('Ollama HTTP '+response.status)});
      const content=result.message&&result.message.content;
      if(!content)return reply(res,502,{error:'Ollama вернула пустой ответ'});
      return reply(res,200,{ok:true,model:MODEL,content});
    }catch(e){return reply(res,e.name==='TimeoutError'?504:503,{error:e.message||'Ollama недоступна'});}
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,{error:'Method not allowed'});
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/')pathname='/U_Ilem_4_1.html';
  const target=path.resolve(ROOT,'.'+pathname);
  if(!target.startsWith(ROOT+path.sep)&&target!==ROOT)return reply(res,403,{error:'Forbidden'});
  fs.stat(target,(err,stat)=>{
    if(err||!stat.isFile())return reply(res,404,{error:'Not found'});
    res.writeHead(200,{'Content-Type':MIME[path.extname(target).toLowerCase()]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store'});
    if(req.method==='HEAD')return res.end();
    fs.createReadStream(target).pipe(res);
  });
});
server.listen(PORT,'127.0.0.1',()=>console.log('У Илем: http://127.0.0.1:'+PORT+' | Ollama model: '+MODEL));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
