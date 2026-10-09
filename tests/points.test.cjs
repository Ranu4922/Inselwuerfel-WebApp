const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');

function room() {
  const state=C.createRoom({code:'TEST',name:'Host',title:'Score test',mode:'cities',maxPlayers:4,playerId:'host'});
  state.players.push({id:'guest',name:'Gast',color:'blau',online:true,points:0});
  state.started=true;
  return state;
}

test('Jeder Spieler beginnt mit null Siegespunkten',()=>{
  const r=room();
  assert.equal(r.players[0].points,0);
  assert.equal(r.players[1].points,0);
});

test('Siegespunkte von Spielern unabhängig ändern',()=>{
  const r=room();
  assert.equal(C.setPoints(r,'host',9),9);
  assert.equal(C.setPoints(r,'guest',7),7);
  assert.equal(r.players[0].points,9);
  assert.equal(r.players[1].points,7);
});

test('Gültige Punkte: nur ganze Werte zwischen 0 und 99',()=>{
  const r=room();
  for(const bad of [-1,100,1.5,'abc',Infinity,NaN])assert.throws(()=>C.setPoints(r,'host',bad));
  assert.equal(C.setPoints(r,'host',0),0);
  assert.equal(C.setPoints(r,'host',99),99);
  assert.throws(()=>C.setPoints(r,'unbekannt',4));
});

test('Punkte bleiben beim Würfeln und Speichern erhalten',()=>{
  const r=room();C.setPoints(r,'host',6);C.setPoints(r,'guest',8);
  C.roll(r,'host',()=>.8);
  const restored=JSON.parse(JSON.stringify(r));
  assert.equal(restored.players[0].points,6);
  assert.equal(restored.players[1].points,8);
});
