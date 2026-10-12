import assert from 'node:assert/strict';
import test from 'node:test';
import { createBoardState } from '../site/board-state.js';

const catalog = {
  sources: [
    { id: 'alpha', title: 'Alpha Compute', summary: 'Stable outputs', preview: [{ label: '目标', text: 'Debug' }], body: 'BODY_ONLY_NEEDLE', type: 'article', status: 'draft', designs: ['kernel', 'shared'] },
    { id: 'beta', title: 'Beta Web', summary: 'Browser toolkit', type: 'open-source', status: 'pending', designs: ['shared', 'layout'] },
    { id: 'gamma', title: 'Gamma Graphics', summary: 'Drawing', type: 'course', status: 'reviewed', designs: ['vector'] },
  ],
  designs: [
    { id: 'kernel', title: 'Kernel Constraints', technologies: ['float'] },
    { id: 'shared', title: 'Shared Pipeline', technologies: ['fp32', 'cache'] },
    { id: 'layout', title: 'CSS Layout', technologies: ['cache', 'html'] },
    { id: 'vector', title: 'Vector Drawing', technologies: ['cache', 'svg'] },
    { id: 'orphan-method', title: 'Orphan Method', technologies: ['orphan-concept'] },
  ],
  technologies: ['float', 'fp32', 'cache', 'html', 'svg', 'orphan-concept'].map(id => ({ id, title: id.toUpperCase() })),
};

test('lower layers require a committed top-level choice, including during hover', () => {
  const state = createBoardState(catalog);
  assert.deepEqual(state.visible, [['alpha', 'beta', 'gamma'], [], []]);
  assert.deepEqual(state.preview(0, 'alpha').visible, state.visible);
  state.select(0, 'alpha');
  assert.deepEqual(state.visible, [['alpha', 'beta', 'gamma'], ['kernel', 'shared'], ['float', 'fp32', 'cache']]);
  state.select(1, 'shared');
  assert.deepEqual(state.related[2], ['fp32', 'cache']);
  assert.deepEqual(state.dimmed[2], ['float']);
  state.select(0, 'alpha');
  assert.deepEqual(state.selected, [null, null, null]);
  assert.deepEqual(state.visible[1], []);
  assert.deepEqual(state.visible[2], []);
  assert.equal(state.edges.length, 0);
  state.select(0, 'alpha');
  state.clearSelection();
  assert.deepEqual(state.visible, [['alpha', 'beta', 'gamma'], [], []]);
});

test('search intersects extensible filters without opening the lower layers', () => {
  const state = createBoardState(catalog);
  assert.deepEqual(state.setSourceFilter({ query: '  aLpHa \t CaChE  ' }).visible, [['alpha'], [], []]);
  state.select(0, 'alpha');
  assert.deepEqual(state.visible[2], ['float', 'fp32', 'cache']);
  assert.deepEqual(state.setSourceFilter({ query: 'Debug' }).visible[0], ['alpha']);
  assert.deepEqual(state.setSourceFilter({ query: 'CSS cache' }).visible, [['beta'], [], []]);
  assert.deepEqual(state.selected, [null, null, null]);
  assert.deepEqual(state.setSourceFilter({ query: '', type: 'course', status: 'reviewed' }).visible[0], ['gamma']);
  assert.deepEqual(state.setSourceFilter({ query: 'BODY_ONLY_NEEDLE', type: '', status: '' }).visible, [[], [], []]);
});

test('filters preserve valid paths, hover leaves order intact, and stale checkpoints cannot restore filtered origins', () => {
  const state = createBoardState(catalog);
  state.select(0, 'alpha');
  state.select(1, 'shared');
  state.select(2, 'cache');
  const fixed = state.snapshot();
  const preview = state.preview(1, 'kernel');
  assert.deepEqual(preview.related[2], ['float']);
  assert.deepEqual(preview.displayOrder, fixed.displayOrder);
  preview.displayOrder[2].reverse();
  assert.deepEqual(state.snapshot(), fixed);
  state.setSourceFilter({ type: 'article' });
  assert.deepEqual(state.selected, ['alpha', 'shared', 'cache']);
  const checkpoint = state.captureSelection();
  state.setSourceFilter({ type: 'course' });
  state.restoreSelection(checkpoint);
  assert.deepEqual(state.selected, [null, null, null]);
  assert.deepEqual(state.visible, [['gamma'], [], []]);
});

test('practice entry reuses methods and concepts, includes direct concepts, and never revives an old path', () => {
  const state = createBoardState({ ...catalog, practices: [
    { id: 'practice', title: 'Repeatable Pipeline', status: 'draft', designs: ['shared'], technologies: ['float'] },
    { id: 'direct', title: 'Direct Concept', status: 'reviewed', designs: [], technologies: ['html'] },
  ] });
  state.select(0, 'alpha');
  const checkpoint = state.captureSelection();
  assert.deepEqual(state.setEntryMode('practices').visible, [['practice', 'direct'], [], []]);
  state.restoreSelection(checkpoint);
  assert.deepEqual(state.selected, [null, null, null]);
  state.select(0, 'practice');
  assert.deepEqual(state.visible[1], ['shared']);
  assert.deepEqual(state.visible[2], ['float', 'fp32', 'cache']);
  assert(state.edges.some(edge => edge.fromId === 'practice' && edge.toId === 'float' && edge.toLevel === 2));
  state.select(1, 'shared');
  assert.deepEqual(state.dimmed[2], ['float']);
  state.select(2, 'float');
  assert.deepEqual(state.selected, ['practice', null, 'float']);
  assert(state.related[0].includes('practice'));
  state.select(0, 'direct');
  assert.deepEqual(state.visible[1], []);
  assert.deepEqual(state.visible[2], ['html']);
  state.setEntryMode('sources');
  assert.deepEqual(state.visible, [['alpha', 'beta', 'gamma'], [], []]);
  state.setEntryMode('practices');
  assert.deepEqual(state.setSourceFilter({ query: 'cache' }).visible[0], ['practice']);
  assert.deepEqual(state.setSourceFilter({ status: 'reviewed' }).visible, [[], [], []]);
});

test('an empty practice entry is an empty catalog view, not placeholder knowledge', () => {
  const state = createBoardState(catalog);
  assert.deepEqual(state.setEntryMode('practices').visible, [[], [], []]);
  assert.equal(state.edges.length, 0);
  assert.throws(() => state.select(1, 'shared'), /outside/);
});

test('source concepts can skip the method layer and remain searchable and traceable', () => {
  const state = createBoardState({
    ...catalog,
    sources: [
      ...catalog.sources,
      { id: 'direct-source', title: 'Direct source', type: 'article', status: 'draft', designs: [], technologies: ['html'] },
      { id: 'mixed-source', title: 'Mixed source', type: 'article', status: 'draft', designs: ['shared'], technologies: ['cache', 'html'] },
    ],
  });
  assert.deepEqual(state.setSourceFilter({ query: 'direct html' }).visible, [['direct-source'], [], []]);
  state.select(0, 'direct-source');
  assert.deepEqual(state.visible, [['direct-source'], [], ['html']]);
  assert.deepEqual(state.edges, [{ fromLevel: 0, fromId: 'direct-source', toLevel: 2, toId: 'html', highlight: true }]);
  state.select(2, 'html');
  assert.deepEqual(state.related, [['direct-source'], [], ['html']]);
  state.setSourceFilter({ query: 'mixed html' });
  assert.deepEqual(state.selected, [null, null, null]);
  state.select(0, 'mixed-source');
  assert.deepEqual(state.visible, [['mixed-source'], ['shared'], ['fp32', 'cache', 'html']]);
  assert.equal(state.edges.filter(edge => edge.fromId === 'mixed-source' && edge.toId === 'cache').length, 1);
  state.select(1, 'shared');
  assert.deepEqual(state.related[2], ['fp32', 'cache']);
  assert.deepEqual(state.dimmed[2], ['html']);
  assert.equal(state.edges.find(edge => edge.toId === 'html').highlight, false);
  state.select(2, 'html');
  assert.deepEqual(state.selected, ['mixed-source', null, 'html']);
  assert.deepEqual(state.related, [['mixed-source'], [], ['html']]);
  assert.equal(state.edges.find(edge => edge.toId === 'html').highlight, true);
});
