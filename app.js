
/* Inselwürfel: frontend and WebRTC multiplayer via PeerJS Cloud (only loaded for online play). */
(() => {
  'use strict';
  const C = window.CatanCore;
  const app = document.getElementById('app');
  const STORAGE = 'inselwuerfel-session-v1';
  const DEVICE = 'inselwuerfel-device-v1';
  const deviceId = localStorage.getItem(DEVICE) || C.makeId();
  localStorage.setItem(DEVICE, deviceId);
  const COLORS = ['#df5950', '#3b9ddb', '#efa84d', '#35bb7e', '#a67cdd', '#3ac2bc'];
  const defaultSetup = { mode: 'base', name: '', title: 'Catan-Abend', maxPlayers: 4 };
  const ui = { screen: 'home', tab: 'roll', selectedStatsPlayer: 'all', setup: { ...defaultSetup }, joinCode: new URLSearchParams(location.search).get('room') || '', connecting: false, connected: false, loadingRoll: false, lastSeenRoll: '', showAttack: false, installPrompt: null, toastTimer: null, roomStatus: '' };
  let room = null, role = null, selfId = deviceId, peer = null, hostConn = null;
  const guestConnections = new Map();
  let currentPeerLoaded = null;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const latest = () => room?.history?.[room.history.length - 1];
  const mode = () => C.MODES[room?.mode || ui.setup.mode];
  const amHost = () => role === 'host' || role === 'offline';
  const isOnline = () => role === 'host' || role === 'guest';
  const player = id => room?.players?.find(p => p.id === id);
  const me = () => player(selfId);
  const time = ms => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const icon = (type, cls = '') => {
    if (type === 'ship') return `<svg class="event-svg ${cls}" viewBox="0 0 64 64" aria-label="Barbarenschiff"><path d="M7 43l8 11h32l10-11-18 4-14-2z"/><path d="M29 8v35M31 9l20 28H31z" fill="none" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><path d="M26 12L13 35h13z"/></svg>`;
    if (['science', 'trade', 'politics'].includes(type)) {
      const tint = { science:'#248d49',trade:'#d8a028',politics:'#3279bb' }[type];
      return `<svg class="event-svg ${cls}" style="stroke:${tint};fill:${tint}" viewBox="0 0 64 64" aria-label="${esc(C.EVENT_LABELS[type])}"><path d="M11 52V24l21-16 21 16v28h-10V35H21v17z"/><path d="M18 28h28" fill="none" stroke="${tint}" stroke-width="5"/><path d="M27 53V40h10v13" fill="none" stroke="${tint}" stroke-width="4"/></svg>`;
    }
    return '';
  };
  const pipPositions = {1:[[50,50]],2:[[27,27],[73,73]],3:[[27,27],[50,50],[73,73]],4:[[27,27],[73,27],[27,73],[73,73]],5:[[27,27],[73,27],[50,50],[27,73],[73,73]],6:[[27,24],[73,24],[27,50],[73,50],[27,76],[73,76]]};
  function dieMarkup(value, color='cream', animate=false) {
    if (color==='event') return `<div class="die event ${animate?'animated':''}" title="${esc(C.EVENT_LABELS[value])}">${icon(value)}</div>`;
    const dots=(pipPositions[value]||[]).map(([x,y])=>`<circle cx="${x}" cy="${y}" r="9" fill="var(--pip)"/>`).join('');
    return `<div class="die ${color==='red'?'red':''} ${animate?'animated':''}" aria-label="${value} Augen"><svg viewBox="0 0 100 100" role="img"><title>${value} Augen</title>${dots}</svg></div>`;
  }
  function tinyDie(n, color='cream') { return `<span class="small-die ${color==='red'?'red':color==='event'?'event':''}" title="${esc(color==='event'?C.EVENT_LABELS[n]:n)}">${color==='event'?({ship:'⛵',science:'⚗',politics:'♜',trade:'⚖'}[n]||'?'):n}</span>`; }
  function topbar(title, back, extra='') { return `<header class="topbar"><div class="topbar-left">${back ? `<button class="iconbtn" data-action="${back}" aria-label="Zurück">‹</button>` : `<span style="font-size:22px;color:var(--gold)">⬡</span>`}</div><h1>${esc(title)}</h1><div class="topbar-right">${extra || '<span style="width:32px"></span>'}</div></header>`; }
  function scene() { return `<svg class="scene" viewBox="0 0 480 405" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#122c40"/><stop offset=".5" stop-color="#b86845"/><stop offset=".85" stop-color="#f4b866"/><stop offset="1" stop-color="#152e34"/></linearGradient><radialGradient id="sun"><stop stop-color="#fff0aa"/><stop offset="1" stop-color="#f4ae65"/></radialGradient></defs><rect width="480" height="405" fill="url(#sky)"/><circle cx="244" cy="223" r="72" fill="url(#sun)" opacity=".92"/><path d="M0 248L43 179 80 223 121 147 181 230 237 180 279 240 328 156 373 220 416 172 480 234v171H0" fill="#304651" opacity=".65"/><path d="M0 277l55-42 49 38 57-43 48 40 57-29 43 40 69-43 47 23 55-30v174H0" fill="#183c43"/><path d="M0 343l62-43 50 22 46-48 50 23 52-31 62 41 38-20 67 31 53-12v100H0" fill="#153a32"/><path d="M0 369l60-21 56 26 70-33 50 15 77-25 47 20 50-22 70 23v75H0" fill="#102d32"/><g fill="#091f2a"><path d="M26 384v-67l-14 29h27l-12-33h-4l-12 27h26M90 393v-84l-22 43h44l-21-43M397 393v-84l-22 45h44l-21-45M450 396v-87l-21 48h42l-19-48"/></g><path d="M188 335v-33h15v-14l19-20 19 20v14h12v33z" fill="#152c2c"/><path d="M217 265v-27h8v27m-26 36v-16h9v16m34 0v-16h9v16" fill="#122426"/></svg>`; }
  function barbarianScene() { return `<svg viewBox="0 0 420 210" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="dusk" x2="0" y2="1"><stop stop-color="#d69c65"/><stop offset=".5" stop-color="#6d6b4e"/><stop offset="1" stop-color="#24483d"/></linearGradient></defs><circle cx="220" cy="70" r="54" fill="#e9a75b" opacity=".23"/><path d="M0 149l64-37 55 34 70-47 61 48 77-40 93 48v55H0" fill="#244442" opacity=".55"/><path d="M0 175l80-30 60 14 76-27 70 34 70-26 64 12v60H0" fill="#204039"/><g stroke="#172c28" stroke-width="5" fill="#162d2a"><path d="M31 147l16-17 15 12 2 21-10-3-11 4z"/><path d="M41 133l-6-20 12-11 15 20" fill="none"/><path d="M76 146l15-20 16 14 3 21-12-6-13 8z"/><path d="M86 130l-6-25 12-8 12 23" fill="none"/><path d="M124 149l14-18 17 12 4 18-14-7-12 9z"/><path d="M136 136l-7-26 10-8 14 24" fill="none"/></g><g fill="#f1ce80" stroke="#b17a45" stroke-width="2"><path d="M338 161v-74h15V70h17v17h14v74z"/><path d="M329 161v-60h12v60m33 0v-60h12v60"/><path d="M354 161v-29h14v29" fill="#2c4140"/><path d="M342 88V63l7-7 7 7v25m8 0V51l8-7 8 7v37"/></g><path d="M190 141h112" fill="none" stroke="#b94235" stroke-width="12" stroke-linecap="round"/><path d="M290 123l28 18-28 18" fill="#c44a32"/><path d="M0 200l53-21 77 14 75-22 72 18 71-11 72 22v10H0" fill="#142d2a"/></svg>`; }
  function save() { if(room) localStorage.setItem(STORAGE,JSON.stringify({room,role,selfId,at:Date.now()})); }
  function toast(message) { const t=$('toast'); t.textContent=message; t.classList.add('visible'); clearTimeout(ui.toastTimer);ui.toastTimer=setTimeout(()=>t.classList.remove('visible'),3100); }
  function render() {
    const screen = ui.screen;
    if(screen==='home')app.innerHTML=renderHome();
    if(screen==='create')app.innerHTML=renderCreate();
    if(screen==='join')app.innerHTML=renderJoin();
    if(screen==='lobby')app.innerHTML=renderLobby();
    if(screen==='game')app.innerHTML=renderGame();
    if(screen==='help')app.innerHTML=renderHelp();
    if(screen==='game' && room?.attackPending && ui.showAttack) app.insertAdjacentHTML('beforeend',renderAttackModal());
  }
  function renderHome() {
    const saved=(()=>{try{return JSON.parse(localStorage.getItem(STORAGE))}catch{return null}})();
    return `<section class="screen"><div class="hero">${scene()}<div class="crest">⬡</div><h1 class="brand">INSEL<br>WÜRFEL</h1><div class="brand-small">DEIN WÜRFELBEGLEITER</div></div><div class="home-actions stack gap-8"><button class="btn warm full" data-action="go-create"><span>⚄</span> Neues Spiel</button><button class="btn secondary full" data-action="go-join"><span>♧</span> Spiel beitreten</button><button class="btn secondary full" data-action="start-demo"><span>✦</span> Offline ausprobieren</button>${saved?.room?`<button class="btn ghost full" data-action="resume">↻ Letztes Spiel fortsetzen</button>`:''}<button class="btn ghost full" data-action="go-help">ⓘ Infos & Installation</button></div><div class="home-footer">Für CATAN und Erweiterungen · Inoffiziell</div></section>`;
  }
  function renderCreate() {
    return `<section class="screen">${topbar('Neues Spiel','go-home')}<div class="eyebrow">Dein Spieleabend</div><h2 class="page-title">Eine Runde starten</h2><p class="lead">Wähle eure Erweiterung. Die Würfel passen sich automatisch an.</p><label class="input-label" for="player-name">Dein Spielername</label><input class="input" id="player-name" maxlength="22" autocomplete="nickname" placeholder="z. B. Alex" value="${esc(ui.setup.name)}"><div class="field"><label class="input-label" for="room-title">Name der Spielrunde</label><input class="input" id="room-title" maxlength="36" placeholder="Catan-Abend" value="${esc(ui.setup.title)}"></div><div class="input-label">Spielmodus</div><div class="mode-list">${Object.entries(C.MODES).map(([id,m])=>`<button class="mode ${ui.setup.mode===id?'selected':''}" data-action="select-mode" data-value="${id}"><span class="mode-icon">${m.event?'♜':m.sea?'⛵':'⬡'}</span><span class="mode-body"><b>${esc(m.label)}</b><small>${m.event?'3 Würfel · Barbaren': '2 Zahlenwürfel'} · ${esc(m.sub)}</small></span><span class="mode-check">${ui.setup.mode===id?'●':'○'}</span></button>`).join('')}</div><div class="field"><div class="input-label">Maximale Spielerzahl</div><div class="toggle-options">${[2,3,4,5,6].map(n=>`<button class="option ${ui.setup.maxPlayers===n?'active':''}" data-action="set-players" data-value="${n}">${n}</button>`).join('')}</div></div><div class="stack space-top"><button class="btn primary full" data-action="create-online">⌁ Online-Raum erstellen</button><button class="btn secondary full" data-action="create-offline">⚄ Auf diesem Gerät spielen</button></div><p class="footer-copy">Für den Online-Raum wird eine Internetverbindung benötigt.</p></section>`;
  }
  function renderJoin() {
    return `<section class="screen">${topbar('Spiel beitreten','go-home')}<div class="center" style="padding:40px 8px 25px"><span style="font-size:50px">♧</span><h2 class="page-title" style="margin-top:17px">Gemeinsam spielen</h2><p class="lead">Gib den vierstelligen Raumcode von eurem Gastgeber ein.</p></div><label class="input-label" for="join-name">Dein Spielername</label><input class="input" id="join-name" maxlength="22" placeholder="z. B. Lena" autocomplete="nickname" value="${esc(ui.setup.name)}"><div class="field"><label class="input-label" for="join-code">Raumcode</label><input class="input" id="join-code" maxlength="4" autocapitalize="characters" placeholder="7KQ3" style="letter-spacing:8px;text-transform:uppercase;text-align:center;font-size:26px;font-weight:800" value="${esc(ui.joinCode.toUpperCase())}"></div><button class="btn primary full" data-action="join-online" ${ui.connecting?'disabled':''}>${ui.connecting?'<span class="spinner"></span> Verbinde…':'Spiel beitreten →'}</button>${ui.roomStatus?`<p class="alert error">${esc(ui.roomStatus)}</p>`:''}<div class="alert space-top">Der Gastgeber muss die Web-App geöffnet haben und mit dem Internet verbunden sein. Die Geräte dürfen in unterschiedlichen WLANs sein.</div></section>`;
  }
  function renderLobby() {
    if(!room)return renderHome();
    const online=isOnline();
    return `<section class="screen">${topbar(room.title,'leave-session')}<div class="eyebrow center space-top">${online?'Gemeinsamer Spielraum':'Offline-Spiel'}</div><div class="panel center space-top"><div class="small muted">${online?'Dein Raumcode':'Auf diesem Gerät'}</div><div class="code">${online?esc(room.code):'LOCAL'}</div>${online?`<div class="row" style="justify-content:center;gap:7px"><button class="btn sm secondary" data-action="copy-code">⧉ Code kopieren</button><button class="btn sm secondary" data-action="share">↗ Einladung teilen</button></div>`:'<div class="small muted">Alle Würfe werden lokal gespeichert</div>'}</div><div class="row mini-header"><span>Mitspieler</span><span class="pill">${room.players.length} / ${room.maxPlayers}</span></div><div class="panel">${room.players.map(p=>playerLine(p)).join('')} ${room.players.length===1?'<div class="center small muted" style="padding:17px 0 2px">'+(online?'Warte auf deine Mitspieler …':'Du kannst direkt starten.')+'</div>':''}</div><div class="panel row space-top"><div><div style="font-weight:800">${esc(mode().label)}</div><div class="small muted" style="margin-top:5px">${mode().event?'3 Würfel · mit Ereigniswürfel':'2 Zahlenwürfel'}${mode().event?' · Barbaren':''}</div></div><span style="font-size:32px">${mode().event?'♜':'⚄'}</span></div><div class="connection"><span class="status-dot ${online?(ui.connected?'ok':'warn'):'ok'}"></span>${online?(ui.connected?'Spielraum verbunden':'Verbinde mit dem Spielraum …'):'Offline bereit'}</div>${ui.roomStatus?`<div class="alert error">${esc(ui.roomStatus)}</div>`:''}${amHost()?`<button class="btn primary full" data-action="start-game">Spiel starten →</button>`:`<div class="alert">Der Gastgeber startet die Partie. Dann erscheinen alle Würfe automatisch auf deinem Gerät.</div>`}${online&&!ui.connected?`<button class="btn secondary full space-top" data-action="retry-online">↻ Verbindung erneut versuchen</button>`:''}</section>`;
  }
  function playerLine(p) {
    const idx=room.players.findIndex(x=>x.id===p.id);
    return `<div class="player-line"><span class="avatar" style="background:${COLORS[idx%COLORS.length]}">${esc((p.name||'?').slice(0,1).toUpperCase())}</span><span class="player-details"><strong>${esc(p.name)}${p.id===selfId?' (du)':''}</strong><small>${idx===0?'Gastgeber':p.online?'Verbunden':'Nicht verbunden'}</small></span>${idx===0?'<span class="gold" title="Gastgeber">♛</span>':p.online?'<span class="round-tag">✓ Bereit</span>':'<span class="tiny">offline</span>'}</div>`;
  }
  function renderGame() {
    if(!room)return renderHome();
    const tabs=[['roll','⚄','Würfeln'], ...(mode().event?[['barbarians','♜','Barbaren']]:[]), ['stats','▥','Statistik'], ['history','☷','Verlauf'], ['players','♙','Spieler']];
    const extra=`<span class="status-dot ${ui.connected||role==='offline'?'ok':'warn'}" title="${isOnline()?(ui.connected?'Verbunden':'Verbindung getrennt'):'Offline'}"></span><button class="iconbtn" data-action="game-options" aria-label="Spieloptionen">⚙</button>`;
    return `<section class="screen with-nav">${topbar(room.title,null,extra)}${!ui.connected&&isOnline()?`<div class="alert error">Keine Verbindung zum Spielraum. <button class="btn sm secondary space-top" data-action="retry-online">Erneut verbinden</button></div>`:''}${ui.tab==='roll'?renderRoll():''}${ui.tab==='barbarians'&&mode().event?renderBarbarians():''}${ui.tab==='stats'?renderStats():''}${ui.tab==='history'?renderHistory():''}${ui.tab==='players'?renderPlayers():''}<nav class="nav" aria-label="Spielnavigation">${tabs.map(([id,symbol,label])=>`<button data-action="tab" data-value="${id}" class="${ui.tab===id?'selected':''}" aria-label="${label}" ${ui.tab===id?'aria-current="page"':''}><span class="nav-icon">${symbol}</span><span>${label}</span></button>`).join('')}</nav></section>`;
  }
  function renderRoll() {
    const last=latest();
    const animate=last?.id!==ui.lastSeenRoll;
    if(last)ui.lastSeenRoll=last.id;
    const name=last ? (player(last.playerId)?.name||'Ehem. Spieler') : '';
    const desc=last?.event?{ship:'⚑ Die Barbaren rücken vor',science:'Grünes Stadttor · Wissenschaft',politics:'Blaues Stadttor · Politik',trade:'Gelbes Stadttor · Handel'}[last.event]:'';
    const blocked=room.attackPending || (isOnline()&&!ui.connected) || ui.loadingRoll;
    return `<div class="eyebrow center">${esc(mode().label)} · ${mode().event?'3 Würfel':'2 Würfel'}</div><div class="dice-stage"><div class="light-halo"></div>${last?`<div class="dice-row">${dieMarkup(last.red,'red',animate)}${dieMarkup(last.white,'cream',animate)}${mode().event?dieMarkup(last.event,'event',animate):''}</div><div class="sum">${last.sum}</div><div class="rolled-by">Gewürfelt von <b>${esc(name)}</b> · ${time(last.ts)}</div>${mode().event?`<div class="event-mark">${desc}</div>`:''}`:`<div class="dice-row">${dieMarkup(5,'red')}${dieMarkup(3)}${mode().event?dieMarkup('ship','event'):''}</div><div class="sum empty">Bereit zum Würfeln?</div><div class="rolled-by">Alle sehen denselben Wurf</div>`}</div><button class="roll-cta" data-action="roll" ${blocked?'disabled':''}><span class="dice-mini">⚄</span>${ui.loadingRoll?'Würfelt …':room.attackPending?'Barbarenangriff läuft':(isOnline()&&!ui.connected?'Keine Verbindung':'Jetzt würfeln')}</button><div class="dice-help">${room.attackPending?'Zuerst den Angriff abschließen':mode().event?'Roter + weißer Würfel und Ereigniswürfel':'Zwei faire, unabhängige Zahlenwürfel'}</div>${mode().event?`<div class="last-roll"><div><b style="font-size:14px">♜ Barbaren</b><div class="roll-tag" style="margin-top:5px">${room.attackPending?'Die Barbaren sind angekommen!':`Noch ${7-room.barbarianSteps} Schiffssymbole bis zum Angriff`}</div></div><button class="btn sm secondary" data-action="tab" data-value="barbarians">Ansehen →</button></div>`:''}${last?.event&&last.event!=='ship'?`<div class="alert"><b>${desc}</b><br>Ob ein Spieler eine Fortschrittskarte bekommt, hängt von seinem Stadtausbau und der <b>roten ${last.red}</b> ab.</div>`:''}${last?.sum===7?`<div class="alert">⚠ Eine 7 wurde gewürfelt. Räuberregel wie gewohnt am Spielbrett ausführen.</div>`:''}<div class="footer-copy">Würfe: ${room.history.length} · ${room.players.length} Spieler · ${role==='offline'?'Offline':'Synchronisiert'}</div>`;
  }
  function renderBarbarians() {
    return `<div class="eyebrow center space-top">STÄDTE & RITTER</div><h2 class="page-title center">Die Barbaren</h2><p class="lead center">${room.attackPending?'Die Barbaren haben Catan erreicht!':'Die Barbaren kommen näher …'}</p><div class="barbarian-art">${barbarianScene()}</div><div class="track">${Array.from({length:7},(_,i)=>`<div class="track-dot ${i<room.barbarianSteps?'done':''}" title="Schritt ${i+1}">${i<room.barbarianSteps?'●':''}</div>`).join('')}</div><div class="barbarian-caption">${room.attackPending?'⚔ Angriff auf Catan!':room.barbarianSteps===0?'Die Küste ist noch sicher':`${7-room.barbarianSteps} ${7-room.barbarianSteps===1?'Schritt':'Schritte'} entfernt`}</div><div class="barbarian-sub">${room.attackPending?'Wertet die aktiven Ritter und Städte am Spielbrett aus.':`Bei jedem Barbarenschiff auf dem Ereigniswürfel rücken sie ein Feld vor.`}</div>${room.attackPending?amHost()?`<button class="btn primary full" data-action="resolve-attack">Angriff abgeschlossen · Zurücksetzen</button>`:`<div class="alert center">Der Gastgeber setzt den Tracker nach dem Angriff zurück.</div>`:`<div class="panel center"><div class="small muted">Bisherige Barbarenangriffe</div><div style="font:700 33px Georgia,serif;margin-top:7px">${room.attacks}</div></div>`}<div class="footer-copy">Die Anzeige bewegt sich bei Schiffswürfen automatisch. Keine zusätzlichen Spielinformationen nötig.</div>`;
  }
  function renderAttackModal() {
    return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Barbarenangriff"><div class="modal"><div class="center" style="font-size:42px">⚔</div><h2>Die Barbaren sind da!</h2><div class="barbarian-art" style="min-height:190px">${barbarianScene()}</div><p>Die Barbaren haben Catan erreicht! Vergleicht jetzt die Stärke der aktiven Ritter mit der Zahl eurer Städte.</p>${amHost()?`<button class="btn primary full" data-action="resolve-attack">Angriff beendet · Neustart</button>`:`<button class="btn primary full" data-action="close-attack">Verstanden</button><div class="center small muted space-top">Der Gastgeber setzt den Tracker zurück.</div>`}<button class="btn ghost full space-top" data-action="close-attack">Erst am Brett auswerten</button></div></div>`;
  }
  function renderStats() {
    const s=C.stats(room.history,ui.selectedStatsPlayer);
    const max=Math.max(1,...Object.values(s.sums));
    const filtered=ui.selectedStatsPlayer==='all'?'Gesamt':(player(ui.selectedStatsPlayer)?.name||'Spieler');
    return `<div class="eyebrow center space-top">WÜRFELSTATISTIK</div><h2 class="page-title center">Alle Würfe im Blick</h2><div class="tab-filter"><button class="${ui.selectedStatsPlayer==='all'?'selected':''}" data-action="stats-person" data-value="all">Gesamt</button>${room.players.length===1?'':`<button class="${ui.selectedStatsPlayer!=='all'?'selected':''}" data-action="stats-cycle">${ui.selectedStatsPlayer==='all'?'Nach Spieler ▾':esc(filtered)+' ▾'}</button>`}</div><div class="panel"><div class="row"><b>Zahlensummen</b><span class="tiny">2 bis 12</span></div><div class="stat-graph">${Object.entries(s.sums).map(([n,count])=>`<div class="stat-column" title="${n}: ${count}×"><div class="count">${count||''}</div><div class="colbar" style="height:${Math.max(2,count/max*155)}px"></div><div class="number">${n}</div></div>`).join('')}</div><div class="stat-cards"><div class="stat-card"><small>Gesamtwürfe</small><b>${s.total}</b></div><div class="stat-card"><small>Am häufigsten</small><b>${s.total?s.most[0]:'–'}</b></div><div class="stat-card"><small>Gewürfelte 7</small><b>${s.sums[7]}</b></div></div></div>${mode().event?`<div class="mini-header">Ereigniswürfel</div><div class="event-stat">${[['ship','⛵'],['science','♧'],['politics','♜'],['trade','⚖']].map(([e,em])=>`<div class="panel"><div class="row"><b>${em} ${esc(C.EVENT_LABELS[e])}</b><b>${s.events[e]}</b></div></div>`).join('')}</div>`:''}<div class="alert space-top">Die Grafik zählt nur die Summe aus den beiden Zahlenwürfeln. Der Ereigniswürfel wird separat ausgewertet.</div>`;
  }
  function renderHistory() {
    return `<div class="eyebrow center space-top">SPIELVERLAUF</div><h2 class="page-title center">Letzte Würfe</h2><p class="lead center">${room.history.length} Würfelwürfe in dieser Partie</p>${!room.history.length?`<div class="empty-state"><div class="emoji">⚄</div><b>Noch keine Würfe</b>Der Verlauf wird nach dem ersten Würfeln angezeigt.</div>`:`<div class="panel">${[...room.history].reverse().slice(0,100).map(r=>`<div class="history-item"><span class="avatar tiny-avatar" style="background:${COLORS[Math.max(0,room.players.findIndex(p=>p.id===r.playerId))%COLORS.length]}">${esc((player(r.playerId)?.name||'?')[0])}</span><div class="player-details"><strong>${esc(player(r.playerId)?.name||'Spieler')}</strong><small>${time(r.ts)}${r.event?` · ${esc(C.EVENT_LABELS[r.event])}`:''}</small></div><div class="tiny-dice">${tinyDie(r.red,'red')}${tinyDie(r.white)}${r.event?tinyDie(r.event,'event'):''}</div><b class="history-sum">${r.sum}</b></div>`).join('')}</div>`}${amHost()&&room.history.length>room.attackResetAt?`<button class="btn ghost full space-top" data-action="undo">↶ Letzten Wurf rückgängig</button>`:''}`;
  }
  function renderPlayers() {
    return `<div class="eyebrow center space-top">GEMEINSAM SPIELEN</div><h2 class="page-title center">Mitspieler</h2><div class="panel">${room.players.map(p=>playerLine(p)).join('')}</div>${isOnline()?`<div class="panel center space-top"><div class="small muted">Spielraum</div><div class="code" style="font-size:36px">${esc(room.code)}</div><button class="btn sm secondary full" data-action="share">↗ Mit Freunden teilen</button><div class="connection"><span class="status-dot ${ui.connected?'ok':'warn'}"></span>${ui.connected?'Verbunden':'Offline / Verbindung wird hergestellt'}</div></div>`:''}${amHost()?`<div class="mini-header">Gastgeber-Aktionen</div><button class="btn secondary full" data-action="undo" ${!room.history.length||room.history.length<=room.attackResetAt?'disabled':''}>↶ Letzten Wurf zurücknehmen</button>${room.players.length>1?`<button class="btn ghost full space-top" data-action="cleanup-players">Nicht verbundene Spieler entfernen</button>`:''}<button class="btn danger full space-top" data-action="reset-game">Partie neu starten</button>`:''}<button class="btn ghost full space-top" data-action="leave-session">Spiel verlassen</button><div class="footer-copy">Das Gerät des Gastgebers muss für die Live-Synchronisierung aktiv bleiben.</div>`;
  }
  function renderHelp() {
    return `<section class="screen">${topbar('Infos & Installation','go-home')}<h2 class="page-title">Auf jedem Handy</h2><p class="lead">Inselwürfel ist eine installierbare Web-App. Kein App Store und keine APK nötig.</p><div class="panel"><h3 style="margin-top:0">Auf dem iPhone</h3><p class="small muted">1. Die veröffentlichte Webseite in <b>Safari</b> öffnen.<br>2. Auf <b>Teilen</b> tippen.<br>3. <b>Zum Home-Bildschirm</b> wählen.</p><hr class="line"><h3>Auf Android</h3><p class="small muted">1. Die veröffentlichte Webseite in Chrome öffnen.<br>2. Browsermenü → <b>App installieren</b> oder <b>Zum Startbildschirm hinzufügen</b>.</p></div><div class="panel space-top"><h3 style="margin-top:0">Gemeinsam würfeln</h3><p class="small muted">Ein Spieler erstellt einen Online-Raum und teilt den Code. Andere geben ihn auf ihrem Gerät ein. Die Verbindung läuft direkt zwischen den Handys. Der Gastgeber sollte die App offen halten; ohne Verbindung ist nur der Offline-Modus möglich.</p><p class="small muted">Online werden der kostenlose öffentliche PeerJS-Vermittlungsdienst und WebRTC verwendet. Bei besonders strengen Netzwerken kann die Verbindung scheitern.</p></div><div class="panel space-top"><h3 style="margin-top:0">Würfelregeln</h3><p class="small muted">Grundspiel & Seefahrer: zwei Würfel. Städte & Ritter: roter und weißer Zahlenwürfel plus Symbolwürfel mit drei Schiffen und je einem grünen, blauen und gelben Stadttor. Der Schiffswurf bewegt den Barbaren-Tracker um ein Feld.</p></div>${ui.installPrompt?`<button class="btn primary full space-top" data-action="install">App installieren</button>`:''}<p class="footer-copy">Inoffizielle Fan-App. Keine Verbindung zu CATAN GmbH oder CATAN Studio.</p></section>`;
  }
  function readSetup() { ui.setup.name=($('player-name')||$('join-name'))?.value?.trim().slice(0,22)||ui.setup.name;ui.setup.title=$('room-title')?.value?.trim().slice(0,36)||ui.setup.title;ui.joinCode=$('join-code')?.value?.trim().toUpperCase()||ui.joinCode; }
  function secureCode() {
    // Independent fair base-36 rolls, rejecting the four values above the 32-letter alphabet.
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result='';
    while(result.length<4){
      const n=(C.die()-1)*6+(C.die()-1);
      if(n<chars.length)result+=chars[n];
    }
    return result;
  }
  function createRoom(offline) {
    readSetup();
    if(!ui.setup.name){toast('Bitte zuerst deinen Spielernamen eingeben');$('player-name')?.focus();return;}
    disposeConnection();selfId=deviceId;
    room=C.createRoom({code:offline?'LOCAL':secureCode(),name:ui.setup.name,title:ui.setup.title,mode:ui.setup.mode,maxPlayers:ui.setup.maxPlayers,playerId:selfId});
    role=offline?'offline':'host';ui.screen='lobby';ui.connected=offline;ui.roomStatus='';ui.tab='roll';ui.lastSeenRoll='';ui.selectedStatsPlayer='all';save();render();
    if(!offline)startHost();
  }
  function proceedJoin() {
    readSetup();ui.joinCode=(ui.joinCode||'').replace(/[^A-Z0-9]/g,'');
    if(!ui.setup.name){toast('Bitte deinen Namen eingeben');return;}
    if(ui.joinCode.length!==4){toast('Der Raumcode besteht aus vier Zeichen');return;}
    disposeConnection();room=null;role='guest';selfId=deviceId;ui.connecting=true;ui.connected=false;ui.roomStatus='';render();
    startGuest(ui.joinCode);
  }
  function safeSend(conn, payload) { try {if(conn?.open)conn.send(payload);}catch(e){console.warn('Senden fehlgeschlagen',e);} }
  function broadcast() { if(!amHost()||!room)return;save();for(const conn of guestConnections.values())safeSend(conn,{type:'state',state:room});render(); }
  function loadPeerJS() {
    if(window.Peer)return Promise.resolve(window.Peer);
    if(currentPeerLoaded)return currentPeerLoaded;
    currentPeerLoaded=new Promise((resolve,reject)=>{
      const urls=['https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js','https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js'];
      const attempt=n=>{ if(n>=urls.length){reject(new Error('Die Netzwerkbibliothek ist nicht erreichbar'));return;}const s=document.createElement('script');s.src=urls[n];s.async=true;s.onload=()=>window.Peer?resolve(window.Peer):attempt(n+1);s.onerror=()=>{s.remove();attempt(n+1)};document.head.appendChild(s);};attempt(0);
    }).catch(err=>{currentPeerLoaded=null;throw err;});
    return currentPeerLoaded;
  }
  function disposeConnection() { guestConnections.forEach(c=>{try{c.close()}catch{}});guestConnections.clear();if(hostConn){try{hostConn.close()}catch{}}hostConn=null;if(peer){try{peer.destroy()}catch{}}peer=null;ui.connected=false;ui.connecting=false; }
  async function startHost() {
    const assignedCode=room?.code;
    ui.connected=false;ui.roomStatus='';render();
    try {
      const Peer=await loadPeerJS();
      if(role!=='host'||room?.code!==assignedCode)return;
      peer=new Peer('inselwuerfel-'+assignedCode.toLowerCase());
      peer.on('open',()=>{ui.connected=true;ui.roomStatus='';render();});
      peer.on('connection',connection=>{
        connection.on('data', data=>handleHostMessage(connection,data));
        connection.on('close',()=>guestClosed(connection));
        connection.on('error',()=>guestClosed(connection));
      });
      peer.on('error',err=>{ui.connected=false;ui.roomStatus=err?.type==='unavailable-id'?'Dieser Raumcode ist vergeben. Erstelle bitte einen neuen Raum.':'Online-Verbindung fehlgeschlagen: '+(err?.type||'Netzwerkfehler');render();});
      peer.on('disconnected',()=>{ui.connected=false;ui.roomStatus='Verbindung zum Vermittlungsdienst unterbrochen.';render();});
    }catch(err){ui.connected=false;ui.roomStatus=err.message;render();}
  }
  function guestClosed(conn) {
    if(!room||!amHost()||!conn.playerId)return;
    if(guestConnections.get(conn.playerId)!==conn)return;
    guestConnections.delete(conn.playerId);
    const p=player(conn.playerId);if(p)p.online=false;
    broadcast();
  }
  function handleHostMessage(conn,data) {
    if(!data||typeof data!=='object'||!room||role!=='host')return;
    if(data.type==='join'){
      const id=String(data.playerId||'').slice(0,100),name=String(data.name||'').trim().slice(0,22);
      if(!id||!name||!data.protocol||data.protocol!==1){safeSend(conn,{type:'error',message:'Ungültige App-Version oder Spielername'});return;}
      let p=player(id);
      if(!p && room.players.length>=room.maxPlayers){safeSend(conn,{type:'error',message:'Dieser Spielraum ist voll'});setTimeout(()=>conn.close(),500);return;}
      if(!p){p={id,name,color:C.COLOR_NAMES[room.players.length%C.COLOR_NAMES.length],online:true};room.players.push(p);}else{p.online=true;p.name=name;}
      const old=guestConnections.get(id);if(old&&old!==conn){try{old.close()}catch{}}
      conn.playerId=id;guestConnections.set(id,conn);safeSend(conn,{type:'welcome',state:room});broadcast();return;
    }
    if(!conn.playerId || guestConnections.get(conn.playerId)!==conn)return;
    if(data.type==='roll')handleRoll(conn.playerId);
    if(data.type==='leave'){const p=player(conn.playerId);if(p)p.online=false;conn.close();guestClosed(conn);}
  }
  async function startGuest(code) {
    try {
      const Peer=await loadPeerJS();
      if(role!=='guest')return;
      peer=new Peer();
      peer.on('open',()=>{
        if(role!=='guest')return;
        hostConn=peer.connect('inselwuerfel-'+code.toLowerCase(),{reliable:true});
        hostConn.on('open',()=>{safeSend(hostConn,{type:'join',playerId:deviceId,name:ui.setup.name,protocol:1});});
        hostConn.on('data',handleGuestMessage);
        hostConn.on('close',()=>{ui.connected=false;ui.connecting=false;ui.roomStatus='Verbindung zum Gastgeber getrennt.';render();});
        hostConn.on('error',()=>{ui.connected=false;ui.connecting=false;ui.roomStatus='Verbindung zum Gastgeber fehlgeschlagen.';render();});
        setTimeout(()=>{if(role==='guest'&&!ui.connected){ui.connecting=false;ui.roomStatus='Keine Verbindung zum Gastgeber. Prüft den Raumcode und ob sein Handy aktiv ist.';render();}},13000);
      });
      peer.on('error',err=>{ui.connected=false;ui.connecting=false;ui.roomStatus='Verbindung fehlgeschlagen: '+(err?.type||'Netzwerkfehler');render();});
      peer.on('disconnected',()=>{ui.connected=false;ui.connecting=false;ui.roomStatus='Verbindung zum Vermittlungsdienst verloren.';render();});
    }catch(err){ui.connecting=false;ui.connected=false;ui.roomStatus=err.message;render();}
  }
  function handleGuestMessage(data) {
    if(!data||typeof data!=='object')return;
    if(data.type==='error'){ui.connected=false;ui.connecting=false;ui.roomStatus=String(data.message||'Verbindungsfehler');ui.screen='join';render();return;}
    if((data.type==='welcome'||data.type==='state')&&data.state){
      const oldId=latest()?.id,oldPending=room?.attackPending;
      room=data.state;ui.connected=true;ui.connecting=false;ui.roomStatus='';ui.loadingRoll=false;
      if(!room.players.some(p=>p.id===selfId)){ui.roomStatus='Du wurdest aus dem Spielraum entfernt.';ui.connected=false;}
      ui.screen=room.started?'game':'lobby';
      if(room.attackPending&&!oldPending)ui.showAttack=true;
      if(latest()?.id!==oldId)ui.lastSeenRoll='';
      save();render();
    }
  }
  function handleRoll(playerId) {
    if(!room||!amHost())return;
    try { C.roll(room,playerId);ui.lastSeenRoll='';if(room.attackPending)ui.showAttack=true; broadcast(); }
    catch(e){ toast(e.message); }
  }
  function guestRoll() { if(!hostConn?.open||!ui.connected){toast('Keine Verbindung zum Gastgeber');return;}ui.loadingRoll=true;render();safeSend(hostConn,{type:'roll'});setTimeout(()=>{if(ui.loadingRoll){ui.loadingRoll=false;render()}},5000); }
  function shareRoom() {
    const url=new URL(location.href);url.searchParams.set('room',room.code);
    if(navigator.share){navigator.share({title:'Inselwürfel',text:`Komm in meinen Inselwürfel-Spielraum! Code: ${room.code}`,url:url.toString()}).catch(()=>{});}
    else copy(`${room.code} – ${url.toString()}`);
  }
  async function copy(text) {try{await navigator.clipboard.writeText(text);toast('In Zwischenablage kopiert')}catch{toast(`Raumcode: ${room.code}`)}}
  function leave() {
    if(role==='guest')safeSend(hostConn,{type:'leave'});
    disposeConnection();room=null;role=null;localStorage.removeItem(STORAGE);ui.screen='home';ui.tab='roll';ui.roomStatus='';render();
  }
  function retryOnline() {
    if(role==='offline'){toast('Diese Partie wurde als Offline-Spiel gestartet');return;}
    if(role==='host'){if(ui.roomStatus.includes('vergeben')){room.code=secureCode();save();}disposeConnection();startHost();}
    else if(role==='guest'){const code=room?.code||ui.joinCode;disposeConnection();startGuest(code);}
  }
  function resume() {
    try {
      const cached=JSON.parse(localStorage.getItem(STORAGE));
      if(!cached?.room||!cached?.role)throw Error();
      disposeConnection();room=cached.room;role=cached.role;selfId=deviceId;ui.connected=role==='offline';ui.screen=room.started?'game':'lobby';ui.tab='roll';ui.roomStatus='';ui.lastSeenRoll='';ui.joinCode=room.code;
      if(role==='host'){room.players.forEach(p=>p.online=p.id===selfId);startHost();}
      if(role==='guest'){room.players.forEach(p=>p.online=false);startGuest(room.code);}
      render();
    }catch{toast('Kein gespeichertes Spiel gefunden')}
  }
  async function act(action,value) {
    switch(action){
      case 'go-home':ui.screen='home';render();break;
      case 'go-create':ui.screen='create';render();break;
      case 'go-join':ui.roomStatus='';ui.screen='join';render();break;
      case 'go-help':ui.screen='help';render();break;
      case 'select-mode':readSetup();ui.setup.mode=value;render();break;
      case 'set-players':readSetup();ui.setup.maxPlayers=Number(value);render();break;
      case 'create-online':createRoom(false);break;
      case 'create-offline':createRoom(true);break;
      case 'start-demo':ui.setup.name='Du';ui.setup.title='Offline-Testspiel';ui.setup.mode='cities';createRoom(true);room.started=true;ui.screen='game';save();render();break;
      case 'join-online':proceedJoin();break;
      case 'start-game':if(amHost()){room.started=true;broadcast();ui.screen='game';render();}break;
      case 'roll':if(room?.attackPending)return;if(amHost())handleRoll(selfId);else guestRoll();break;
      case 'tab':ui.tab=value;ui.showAttack=false;render();break;
      case 'close-attack':ui.showAttack=false;render();break;
      case 'resolve-attack':if(amHost()){C.resolveAttack(room);ui.showAttack=false;broadcast();}break;
      case 'copy-code':copy(room.code);break;
      case 'share':shareRoom();break;
      case 'retry-online':retryOnline();break;
      case 'stats-person':ui.selectedStatsPlayer=value;render();break;
      case 'stats-cycle':{const ids=['all',...room.players.map(p=>p.id)];const next=(ids.indexOf(ui.selectedStatsPlayer)+1)%ids.length;ui.selectedStatsPlayer=ids[next];render();break;}
      case 'undo':if(amHost()){try{C.undo(room);ui.lastSeenRoll='';broadcast();toast('Letzter Wurf zurückgenommen')}catch(e){toast(e.message)}}break;
      case 'cleanup-players':if(amHost()){room.players=room.players.filter(p=>p.id===selfId||p.online);broadcast();toast('Nicht verbundene Spieler entfernt')}break;
      case 'reset-game':if(amHost()&&confirm('Wirklich den kompletten Würfelverlauf und Barbarenstand zurücksetzen?')){room.history=[];room.barbarianSteps=0;room.attackPending=false;room.attacks=0;room.attackResetAt=0;ui.selectedStatsPlayer='all';ui.lastSeenRoll='';broadcast();}break;
      case 'leave-session':if(confirm(role==='host'?'Spielraum verlassen? Die anderen Geräte verlieren dann die Verbindung.':'Spiel wirklich verlassen?'))leave();break;
      case 'resume':resume();break;
      case 'game-options':ui.tab='players';render();break;
      case 'install':if(ui.installPrompt){ui.installPrompt.prompt();ui.installPrompt=null;}break;
    }
  }
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-action]');if(!el||el.disabled)return;
    act(el.dataset.action,el.dataset.value).catch?.(err=>{console.error(err);toast('Ein Fehler ist aufgetreten')});
  });
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&ui.screen==='join'){e.preventDefault();proceedJoin();}});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();ui.installPrompt=e;if(ui.screen==='help')render();});
  window.addEventListener('online',()=>{if(isOnline()&&!ui.connected)retryOnline();});
  window.addEventListener('pagehide',()=>{if(role==='host'||role==='offline')save();});
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  if(ui.joinCode)ui.screen='join';
  render();
})();

