const test=require('node:test');const assert=require('node:assert/strict');
const C=require('../core.js');
const make=mode=>{const r=C.createRoom({code:'TEST',name:'A',title:'Test',mode,maxPlayers:4,playerId:'host'});r.started=true;return r;};
test('Grundspiel und Seefahrer: zwei Zahlenwürfel',()=>{for(const mode of ['base','seafarers']){const r=make(mode);for(let i=0;i<20;i++){const w=C.roll(r,'host');assert.equal(w.event,null);assert.equal(w.sum,w.red+w.white);}assert.equal(r.barbarianSteps,0);}});
test('Städte & Ritter und kombiniert: dritter Würfel mit Symbolen',()=>{for(const mode of ['cities','combined']){const r=make(mode),w=C.roll(r,'host',()=>.8);assert.equal(w.event,'politics');assert.equal(w.sum,10);}});
test('Würfelseiten des Ereigniswürfels',()=>{const result=[];for(let i=0;i<6;i++){const r=make('cities');const seq=[.1,.1,(i+.1)/6];let index=0;result.push(C.roll(r,'host',()=>seq[index++]).event);}assert.deepEqual(result,['ship','ship','ship','science','politics','trade']);});
test('Barbaren erreichen nach sieben Schiffen Catan',()=>{const r=make('cities');for(let i=0;i<7;i++){C.roll(r,'host',()=>0);assert.equal(r.barbarianSteps,i+1);}assert.equal(r.attackPending,true);assert.throws(()=>C.roll(r,'host'));C.resolveAttack(r);assert.equal(r.barbarianSteps,0);});
test('Statistiken pro Spieler',()=>{const r=make('base');r.players.push({id:'guest',name:'B'});C.roll(r,'host',()=>0);C.roll(r,'guest',()=>.999);assert.equal(C.stats(r.history,'all').total,2);assert.equal(C.stats(r.history,'host').sums[2],1);assert.equal(C.stats(r.history,'guest').sums[12],1);});
