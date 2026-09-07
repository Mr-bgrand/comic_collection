import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesSearch, searchShortcuts} from './engine-search.mjs';

const records = [
  {kind:'comic', title:'Amazing Spider-Man #1 : Foil Edition', cert:'0012345678', grade:'CGC 9.8'},
  {kind:'comic', title:'Miles Morales: Spider-Man #2', searchTerms:'Signed · Original Sketch'},
  {kind:'comic', title:'Batman #1', variant:'Virgin Edition'},
  {kind:'card', title:'2025 POKEMON #1 PIKACHU', short:'PIKACHU', grade:'PSA 10'},
  {kind:'card', title:'2025 TOPPS #1 SHOHEI OHTANI', short:'SHOHEI OHTANI', grade:'PSA 10'},
];

test('No value yet combines with text search and treats an explicit zero as valued',()=>{
  const copies=[{title:'Venom',cert:'1',value:null},{title:'Venom',cert:'2',value:0},{title:'Venom',cert:'3',value:85},{title:'Batman',cert:'4',value:null},{title:'Venom',cert:'5'}];
  assert.deepEqual(copies.filter(c=>matchesSearch(c,'Venom',{unvaluedOnly:true})).map(c=>c.cert),['1','5']);
  assert.equal(copies.filter(c=>matchesSearch(c,'',{unvaluedOnly:true})).length,3);
  assert.equal(copies.filter(c=>matchesSearch(c,'Venom')).length,4);
});

test('Japanese names remain searchable and do not collapse into an empty match', () => {
  const c = { title: "シロナのロズレイド CYNTHIA'S ROSERADE", cert: 'Q9937497' };
  assert.equal(matchesSearch(c, 'シロナ'), true);
  assert.equal(matchesSearch(records[0], 'シロナ'), false);
  assert.equal(matchesSearch(c, 'Cynthia'), true);
});

test('grader searches do not mistake Heritage for TAG', () => {
  assert.equal(matchesSearch({title:'TOPPS HERITAGE',grader:'PSA',grade:'PSA 10'}, 'TAG'), false);
  assert.equal(matchesSearch({title:'SCREAM TAIL',grader:'TAG',grade:'TAG 10'}, 'TAG'), true);
});
test('search tolerates accents and character spelling, but retains full cert identity', () => {
  assert.equal(matchesSearch(records[0], 'spiderman'), true);
  assert.equal(matchesSearch(records[1], 'Spider–Man'), true);
  assert.equal(matchesSearch(records[3], 'Pokémon'), true);
  assert.equal(matchesSearch(records[0], '0012345678'), true);
  assert.equal(matchesSearch(records[0], '0012345679'), false);
});
test('each shortcut count is its actual result count, including cross-category names', () => {
  const mixed = [...records, {kind:'card',title:'AMAZING SPIDER-MAN/PETER PARKER',short:'AMAZING SPIDER-MAN/PETER PARKER'}];
  const shortcuts = searchShortcuts(mixed);
  assert.equal(shortcuts.names.find(item => item.label === 'Spider-Man').count, 3);
  for (const item of [...shortcuts.names, ...shortcuts.keywords]) {
    assert.equal(item.count, mixed.filter(record => matchesSearch(record, item.query)).length);
    assert.ok(item.count > 0);
  }
  assert.ok(!shortcuts.names.some(item => item.label === 'Wolverine'));
});
test('card subjects become readable shortcuts and keywords include recorded signature metadata', () => {
  const shortcuts = searchShortcuts(records);
  assert.ok(shortcuts.names.some(item => item.label === 'Shohei Ohtani'));
  assert.ok(shortcuts.names.some(item => item.label === 'Pikachu'));
  assert.ok(shortcuts.keywords.some(item => item.label === 'Signed'));
  assert.ok(shortcuts.keywords.some(item => item.label === 'Pokémon'));
});
test('empty collections and configured limits produce no filler shortcuts', () => {
  assert.deepEqual(searchShortcuts([]), {names:[],keywords:[]});
  const shortcuts = searchShortcuts(records, {nameLimit:2,keywordLimit:1});
  assert.equal(shortcuts.names.length, 2); assert.equal(shortcuts.keywords.length, 1);
});
