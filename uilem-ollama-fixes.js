/* U Ilem 4.1: Ollama, safe task completion, lighthouse warehouse marker */
(function(){
  const copy = x => JSON.parse(JSON.stringify(x));
  const oldSave = window.save;
  window.__uilemSaveOk = true;
  window.save = function(show){
    let ok=false;
    try {
      oldSave.call(window,false);
      const data=JSON.parse(localStorage.getItem(SAVE_PREFIX+ACTIVE_SLOT)||'null');
      ok=!!data && JSON.stringify(data.state)===JSON.stringify(G);
    } catch(e) { console.error(e); }
    window.__uilemSaveOk=ok;
    if(show) toast(ok?'Сохранено в ячейку '+ACTIVE_SLOT:'Ошибка сохранения.');
    return ok;
  };

  if(!G.objects.warehouse) G.objects.warehouse={name:'Общий склад у Маяка',state:0,condition:'Планируется рядом с водонапорной башней',cost:45000};
  const scene=document.getElementById('scene');
  if(scene&&!scene.querySelector('[data-object="warehouse"]')){
    const b=document.createElement('button');
    b.className='hotspot'; b.type='button'; b.dataset.object='warehouse'; b.textContent='📦 Общий склад';
    b.style.cssText='left:76%;top:33%;background:#65471fee;border:1px solid #d7b77a';
    b.addEventListener('click',()=>{G.selected='warehouse';render();});
    scene.appendChild(b);
  }
  save();

  function executeTaskTransaction(id){
    const t=G.tasks.find(x=>String(x.id)===String(id));
    if(!t)return toast('Поручение не найдено.');
    if(t.status==='Выполнена'||t.operationId)return toast('Повторное выполнение запрещено.');
    if(t.status!=='Запланирована')return toast('Сначала утвердите поручение.');
    if(typeof saveReviewFields==='function')saveReviewFields(t);
    const p=G.people.find(x=>x.name===t.person);
    if(!p)return toast('Исполнитель не найден.');
    const hours=Math.max(0,Number(t.hours)||0);
    if(p.hours<hours)return toast('Недостаточно свободных часов у '+p.name+'.');
    const rawNeeds=Array.isArray(t.materials)&&t.materials.length?t.materials:(Array.isArray(t.purchases)?t.purchases:[]);
    const needs=rawNeeds.map(x=>Array.isArray(x)?{name:String(x[0]),qty:Number(x[1])||0}:{name:String(x.name||''),qty:Number(x.qty)||0}).filter(x=>x.name&&x.qty>0);
    const missing=needs.filter(n=>{const s=G.inventory.find(x=>x.name.toLowerCase()===n.name.toLowerCase());return !s||Number(s.qty)<n.qty;});
    if(missing.length)return toast('Не хватает материалов: '+missing.map(x=>x.name+' ('+x.qty+')').join(', ')+'. Сначала пополните склад.');
    const before=copy(G);
    try{
      needs.forEach(n=>{const s=G.inventory.find(x=>x.name.toLowerCase()===n.name.toLowerCase());s.qty=Number((s.qty-n.qty).toFixed(4));s.used=(Number(s.used)||0)+n.qty;});
      p.hours-=hours;p.energy=Math.max(0,p.energy-Math.ceil(hours*1.5));
      t.status='Выполнена';t.doneAt=G.day+'.'+G.month+'.'+G.year;t.completedAt=new Date().toISOString();t.operationId='task-'+t.id+'-'+t.completedAt;
      if(Array.isArray(t.actions))t.actions.forEach(a=>a.done=true);
      const obj=G.objects[t.object];
      if(obj&&t.effect==='work'){
        obj.state=Math.min(100,(Number(obj.state)||0)+Math.max(1,Math.min(15,Math.round(hours/4))));
        obj.condition=obj.state>=70?'Рабочее состояние':'Требует дальнейших работ';
        const stage=G.stages.find(x=>String(x.id)===String(t.stageId)&&x.object===t.object);
        if(stage)stage.progress=Math.min(100,(Number(stage.progress)||0)+Math.max(1,Math.round(hours/Math.max(1,Number(stage.hours)||hours)*100)));
      }
      log(p.name+' выполнил поручение «'+t.title+'». Потрачено '+hours+' ч.');
      if(!save())throw new Error('Сохранение не подтверждено.');
      render();if(typeof renderLiveTasks==='function')renderLiveTasks();toast('Поручение выполнено. Ресурсы списаны один раз.');
      if(typeof closeModal==='function')closeModal();
    }catch(e){G=before;save();render();if(typeof renderLiveTasks==='function')renderLiveTasks();toast('Операция отменена: '+e.message);}
  }
  window.ilemExecuteTask=executeTaskTransaction;
  window.finishTask=executeTaskTransaction;

  function commitTaskMutation(id,mutate,successMessage){
    const t=G.tasks.find(x=>String(x.id)===String(id));if(!t)return toast('Поручение не найдено.');
    const before=copy(G);
    try{mutate(t);if(!save())throw new Error('Сохранение не подтверждено.');render();if(typeof renderLiveTasks==='function')renderLiveTasks();if(typeof closeModal==='function')closeModal();if(successMessage)addChat('У Илем',successMessage,'system');}
    catch(e){G=before;save();render();if(typeof renderLiveTasks==='function')renderLiveTasks();toast('Изменение отменено: '+e.message);}
  }
  window.ilemApproveTask=function(id){commitTaskMutation(id,t=>{if(typeof saveReviewFields==='function')saveReviewFields(t);t.status='Запланирована';},'План утверждён. Выполнение и списание ресурсов остаются отдельными действиями.');};
  window.ilemRejectTask=function(id){commitTaskMutation(id,t=>{t.status='Отклонена';},'Поручение отклонено.');};
  window.ilemSaveTaskReview=function(id){commitTaskMutation(id,t=>{if(typeof saveReviewFields==='function')saveReviewFields(t);t.object=Object.keys(G.objects).find(k=>G.objects[k].name===document.getElementById('reviewObject')?.value)||t.object;t.reviewedAt=G.day+'.'+G.month+'.'+G.year;},'Разбор поручения сохранён.');};
  function updateOllamaStatus(){
    const head=document.querySelector('#taskChat .chatbox h2');if(!head)return;
    let badge=document.getElementById('ollamaStatus');
    if(!badge){badge=document.createElement('span');badge.id='ollamaStatus';badge.style.cssText='display:inline-block;margin-left:10px;padding:4px 8px;border-radius:20px;font:11px Arial;background:#8b5e2a;color:#fff';head.appendChild(badge);}
    badge.textContent='Проверка Ollama…';
    fetch('/api/health').then(r=>r.json()).then(x=>{
      badge.textContent=x.ollamaConnected?(x.modelInstalled?'Ollama · '+x.model:'Ollama подключена · нет модели '+x.model):'Ollama не подключена';
      badge.style.background=x.ollamaConnected&&x.modelInstalled?'#356b43':'#8b5e2a';
    }).catch(()=>{badge.textContent='Локальный сервер не запущен';badge.style.background='#8b3d35';});
  }
  updateOllamaStatus();


  const oldExecute=window.executeStage;
  const locks=new Set();
  window.executeStage=function(id){
    const s=G.stages.find(x=>String(x.id)===String(id));
    if(!s)return toast('Этап не найден.');
    if(Number(s.progress)>=100||s.operationId)return toast('Этап уже завершён. Повторное списание запрещено.');
    if(locks.has(String(id)))return;
    locks.add(String(id));
    const before=copy(G);
    try {
      window.__uilemSaveOk=false;
      oldExecute.call(window,id);
      if(Number(s.progress)>=100){
        if(!window.__uilemSaveOk)throw new Error('Сохранение не подтверждено.');
        s.completedAt=new Date().toISOString();s.operationId='stage-'+s.id+'-'+s.completedAt;
        if(!save())throw new Error('Не удалось сохранить этап.');
        render();
      }
    } catch(e) {G=before;save();render();toast('Этап отменён: '+e.message);}
    finally {locks.delete(String(id));}
  };

  function parsePlan(raw){
    let x=String(raw||'').replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
    x=x.replace(/^\s*```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'');
    const a=x.indexOf('{'),b=x.lastIndexOf('}');
    if(a>=0&&b>a)x=x.slice(a,b+1);
    return JSON.parse(x);
  }
  function fallback(message){
    const text=message.toLowerCase();let titles;
    if(/территор|обустрой|участ|сануз|душев/.test(text))titles=['Осмотреть территорию','Определить площадки под хозяйственные объекты','Подготовить список материалов'];
    else if(/дом|кровл|фундамент|ремонт|стро/.test(text))titles=['Осмотреть конструкции и дефекты','Составить последовательность ремонтных работ','Подготовить ведомость материалов'];
    else if(/сад|огород|яблон|дерев/.test(text))titles=['Осмотреть сад','Составить сезонный план ухода'];
    else titles=['Уточнить объём поручения','Подготовить список действий и ресурсов'];
    return {reply:'Ollama недоступна. Создан предварительный локальный план.',tasks:titles.map((title,i)=>({title,person:pickPerson(message).name,hours:estimateTask(title),object:G.selected||'mainHouse',materials:[],priority:i?'Плановый':'Обычный'}))};
  }
  window.sendCommand=async function(){
    const input=document.getElementById('chatInput'),message=input&&input.value.trim();if(!message)return;
    input.value='';addChat('Дмитрий',message);
    const button=document.querySelector('.chatinput button');if(button)button.disabled=true;
    let plan;
    try{
      const r=await fetch('/api/ollama/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,context:{people:G.people.map(p=>({name:p.name,role:p.role,skill:p.skill,hours:p.hours})),objects:Object.entries(G.objects).map(([id,o])=>({id,name:o.name,condition:o.condition})),stages:G.stages.map(x=>({id:x.id,title:x.title,object:x.object,progress:x.progress,hours:x.hours})),inventory:G.inventory.map(x=>({name:x.name,qty:x.qty,unit:x.unit})).slice(0,80)}})});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const data=await r.json();plan=parsePlan(data.content);
    }catch(e){console.warn('Ollama unavailable',e);plan=fallback(message);}
    finally{if(button)button.disabled=false;}
    addChat('Команда У Илем',String(plan.reply||'Подготовлен черновик.'),'system');
    let count=0;
    for(const item of (Array.isArray(plan.tasks)?plan.tasks.slice(0,8):[])){
      const title=String(item.title||'').trim().slice(0,180);if(!title)continue;
      if(G.tasks.some(t=>String(t.title||'').toLowerCase()===title.toLowerCase()&&!['Выполнена','Отклонена'].includes(t.status)))continue;
      const p=G.people.find(x=>x.name===item.person)||pickPerson(message);
      const materials=(Array.isArray(item.materials)?item.materials:[]).slice(0,20).map(m=>({name:String(m.name||''),qty:Math.max(0,Number(m.qty)||0),unit:String(m.unit||'шт')})).filter(m=>m.name&&m.qty>0);
      G.tasks.push({id:Date.now()+count,title,person:p.name,object:G.objects[item.object]?item.object:(G.selected||'mainHouse'),stageId:G.stages.some(s=>String(s.id)===String(item.stageId)&&s.object===(G.objects[item.object]?item.object:(G.selected||'mainHouse')))?item.stageId:null,effect:item.effect==='work'?'work':'inspection',hours:Math.max(.25,Math.min(80,Number(item.hours)||estimateTask(title))),status:'На согласовании',source:message,materials,priority:String(item.priority||'Плановый'),aiGenerated:true});
      count++;
    }
    addChat('У Илем',count?'Создано черновиков: '+count+'. Ничего не выполняется и не списывается без утверждения.':'Новых задач не добавлено.','system');
    log('Команда разобрала поручение: '+message);save();renderTasks();renderChat();renderLiveTasks();
  };
})();
