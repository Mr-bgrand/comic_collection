import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeLabel} from './model.js';
test('dual PSA grades keep card and autograph grades distinct',()=>{
 assert.equal(gradeLabel({grader:'PSA',grade:'10',autographGrade:'8'}),'PSA 10 · Auto 8');
 assert.equal(gradeLabel({grader:'PSA',grade:'8',autographGrade:'10'}),'PSA 8 · Auto 10');
 assert.equal(gradeLabel({grader:'PSA',grade:'9'}),'PSA 9');
});
