import test from 'node:test';
import assert from 'node:assert/strict';
import {historyCategories} from './engine-value.mjs';
test('history categories use only recorded category snapshots and leave older splits unknown',()=>{
 const old=historyCategories({total:100,marketTotal:90,ownerTotal:10});assert.deepEqual(old.map(x=>x.value),[null,null,null,null]);
 const current=historyCategories({categoryVersion:1,marketTotal:80,comparisonTotal:10,ownerTotal:10,provisionalTotal:25});assert.deepEqual(current.map(x=>x.value),[80,10,10,25]);
});
