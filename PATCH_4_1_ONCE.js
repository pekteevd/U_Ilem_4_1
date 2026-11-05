const fs = require("node:fs");

const file = "U_Ilem_4_1.html";
let html = fs.readFileSync(file, "utf8");

function replaceExact(source, from, to, label) {
  if (!source.includes(from)) throw new Error("Не найден фрагмент: " + label);
  return source.replace(from, to);
}

const originalMap = (html.match(/src="(data:image\\/png;base64,[^"]+)"/) || [])[1];
if (!originalMap) throw new Error("Не найдена встроенная карта. Изменения отменены.");

html = replaceExact(html,
  "<title>У Илем | Живая усадьба · 3D</title>",
  "<title>У Илем | Живая усадьба</title>",
  "заголовок"
);

html = replaceExact(html,
  '<button id="toggle3d" type="button">🏡 Объёмные постройки</button>',
  "",
  "кнопка 3D"
);

const sceneStart = html.indexOf('<div id="scene3d"');
const weatherStart = html.indexOf('<div class="weatherfx" id="weatherFx"></div>', sceneStart);
if (sceneStart < 0 || weatherStart < 0) throw new Error("Не найдена граница экспериментальной 3D-сцены.");
html = html.slice(0, sceneStart) + html.slice(weatherStart);

const styleStart = html.indexOf('<style id="ilem-3d-fix-style">');
const styleEnd = html.indexOf("</style>", styleStart);
if (styleStart < 0 || styleEnd < 0) throw new Error("Не найден стиль 3D-эксперимента.");
const weatherStyle = '<style id="ilem-weather-style">\\n' +
  '.rain{position:absolute;inset:0;overflow:hidden;pointer-events:none;opacity:.72;background:none!important;background-image:none!important}\\n' +
  '.rain-drop{position:absolute;top:-18%;width:1.5px;height:17px;border-radius:2px;background:linear-gradient(to bottom,transparent,#dcecf2b8 65%,#f7fcff);box-shadow:0 0 2px #e7f5ff55;animation:rainFall var(--dur) linear var(--delay) infinite;transform:rotate(12deg)}\\n' +
  '@keyframes rainFall{0%{transform:translate3d(0,-8vh,0) rotate(12deg);opacity:0}12%{opacity:.72}88%{opacity:.6}100%{transform:translate3d(-5vw,115vh,0) rotate(12deg);opacity:0}}\\n' +
  '</style>';
html = html.slice(0, styleStart) + weatherStyle + html.slice(styleEnd + 8);

const moduleStart = html.indexOf('<script type="module">');
const moduleEnd = html.indexOf("</script>", moduleStart);
if (moduleStart < 0 || moduleEnd < 0) throw new Error("Не найден модульный 3D-скрипт.");
html = html.slice(0, moduleStart) + html.slice(moduleEnd + 9);

const lakeButton = '<button class="hotspot" style="left:75%;top:78%" data-object="lake">🌊 Озеро</button>';
html = replaceExact(html, lakeButton,
  lakeButton + '<button class="hotspot" style="left:84%;top:24%;background:#65471fee;border:1px solid #f0cf83;box-shadow:0 0 0 2px #f2d28b55,0 0 14px #ffd77b88" data-object="lighthouse">🗼 Маяк У Илем</button>',
  "маркер озера"
);

html = replaceExact(html,
  "lake:{name:'Озеро и спуск',state:55,condition:'Требует обустройства',cost:30000}}",
  "lake:{name:'Озеро и спуск',state:55,condition:'Требует обустройства',cost:30000},lighthouse:{name:'Маяк У Илем',state:0,condition:'Планируется',cost:null}}",
  "модель маяка"
);

html = replaceExact(html,
  "state:old.state===undefined||old.state===null||old.state===''?null:(Number.isFinite(Number(old.state))?Math.max(0,Math.min(100,Number(old.state))):null),\\n     condition:old.condition||'Не оценено',cost:old.cost===undefined||old.cost===null?null:old.cost,",
  "state:old.state===undefined?def.state:(old.state===null||old.state===''?null:(Number.isFinite(Number(old.state))?Math.max(0,Math.min(100,Number(old.state))):null)),\\n     condition:old.condition||def.condition||'Не оценено',cost:old.cost===undefined?def.cost:old.cost,",
  "миграция новых объектов"
);

const stageStart = html.indexOf("function openStage(obj){");
const needsStart = html.indexOf("\\nlet needs=s.need.map", stageStart);
if (stageStart < 0 || needsStart < 0) throw new Error("Не найдена граница функции openStage.");
const newStagePrefix = "function openStage(obj){const objectId=obj||G.selected;let s=G.stages.find(x=>x.object===objectId&&x.progress<100);if(!s){modal(`<h2>Новый этап</h2><label class=\"field\">Название<input id=\"newStage\" placeholder=\"Например, заменить окна\"></label><label class=\"field\">Объект<select id=\"newObj\">${Object.entries(G.objects).map(([k,v])=>`<option value=\"${k}\" ${k===objectId?'selected':''}>${v.name}</option>`).join('')}</select></label><div class=\"actions\"><button onclick=\"closeModal()\">Отмена</button><button onclick=\"createStage()\">Создать</button></div>`);return}";
html = html.slice(0, stageStart) + newStagePrefix + html.slice(needsStart);

const mapAfter = (html.match(/src="(data:image\\/png;base64,[^"]+)"/) || [])[1];
if (mapAfter !== originalMap) throw new Error("Встроенная карта изменилась. Изменения отменены.");
if (html.includes("scene3d") || html.includes("toggle3d") || html.includes("cdn.jsdelivr.net") || html.includes('<script type="module">')) {
  throw new Error("В HTML остались элементы 3D-эксперимента.");
}
if (!html.includes('data-object="lighthouse"') || !html.includes("lighthouse:{name:'Маяк У Илем'")) {
  throw new Error("Маяк не добавлен полностью.");
}
if (!html.includes("x=>x.object===objectId&&x.progress<100")) {
  throw new Error("Исправление привязки этапа не найдено.");
}

fs.writeFileSync(file, html, "utf8");
console.log("PATCH_OK", html.length);
