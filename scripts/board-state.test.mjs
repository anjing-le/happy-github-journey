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

test('source search uses case-insensitive AND and intersects extensible type/status filters', () => {
  const state = createBoardState(catalog);
  assert.deepEqual(state.visible, state.levels, 'Unfiltered catalog includes unlinked entries');
  assert.deepEqual(state.setSourceFilter({ query: '  aLpHa \t CaChE  ' }).visible,
    [['alpha'], ['kernel', 'shared'], ['float', 'fp32', 'cache']]);
  assert.deepEqual(state.setSourceFilter({ query: 'Debug' }).visible[0], ['alpha'], 'Preview text is searchable');
  assert.deepEqual(state.setSourceFilter({ query: 'CSS cache' }).visible[0], ['beta'], 'Method and concept titles are searchable');
  assert.deepEqual(state.setSourceFilter({ query: 'Shared' }).visible,
    [['alpha', 'beta'], ['kernel', 'shared', 'layout'], ['float', 'fp32', 'cache', 'html']], 'Shared relationships are deduplicated');
  assert.deepEqual(state.setSourceFilter({ type: 'open-source' }).visible[0], ['beta'], 'Partial updates keep the search term');
  assert.deepEqual(state.setSourceFilter({ status: 'draft' }).visible, [[], [], []], 'Type and status must both match');
  assert.deepEqual(state.setSourceFilter({ query: '', type: 'course', status: 'reviewed' }).visible,
    [['gamma'], ['vector'], ['cache', 'svg']], 'New source types need no state changes');
  assert.deepEqual(state.setSourceFilter({ query: 'BODY_ONLY_NEEDLE', type: '', status: '' }).visible, [[], [], []], 'Body text is excluded');
  assert.equal(state.edges.length, 0);
});

test('filters retain valid shared selections and prune out-of-scope concepts or the whole source path', () => {
  const state = createBoardState(catalog);
  state.select(1, 'shared');
  state.select(2, 'cache');
  state.setSourceFilter({ type: 'article' });
  assert.deepEqual(state.selected, [null, 'shared', 'cache']);
  assert.deepEqual(state.displayOrder[2], ['fp32', 'cache', 'float'], 'Existing grouping survives narrowing');
  state.setSourceFilter({ type: 'course' });
  assert.deepEqual(state.selected, [null, null, 'cache'], 'A shared concept survives an invalid method');
  state.select(2, 'svg');
  state.setSourceFilter({ type: 'article' });
  assert.deepEqual(state.selected, [null, null, null], 'An unavailable concept is cleared');
  state.select(0, 'alpha');
  state.select(1, 'shared');
  state.select(2, 'cache');
  state.setSourceFilter({ type: 'course' });
  assert.deepEqual(state.selected, [null, null, null], 'A removed source clears its path even when its concept still exists');
  assert.deepEqual(state.visible, [['gamma'], ['vector'], ['cache', 'svg']]);
});

test('hover leaves fixed order intact and delayed checkpoints cannot restore a filtered source', () => {
  const state = createBoardState(catalog);
  state.setSourceFilter({ query: 'Alpha' });
  state.select(0, 'alpha');
  state.select(1, 'shared');
  const checkpoint = state.captureSelection();
  const fixed = state.snapshot();
  const filters = state.filters;
  const preview = state.preview(1, 'kernel');
  assert.deepEqual(preview.related[2], ['float']);
  assert.deepEqual(preview.displayOrder, fixed.displayOrder);
  preview.edges[0].highlight = !preview.edges[0].highlight;
  preview.displayOrder[2].reverse();
  assert.deepEqual(state.snapshot(), fixed);
  assert.deepEqual(state.filters, filters);
  state.setSourceFilter({ query: '', type: 'course' });
  state.restoreSelection(checkpoint);
  assert.deepEqual(state.selected, [null, null, null]);
  assert.deepEqual(state.filters, { query: '', type: 'course', status: '' }, 'Checkpoint never restores old filters');
  assert.deepEqual(state.visible, [['gamma'], ['vector'], ['cache', 'svg']]);
});

test('filtering out a standalone method resets order while an empty-selection checkpoint preserves its saved grouping', () => {
  const state = createBoardState(catalog);
  const canonical = state.levels;
  state.select(1, 'shared');
  assert.deepEqual(state.displayOrder[2].slice(0, 2), ['fp32', 'cache']);
  state.setSourceFilter({ query: 'Gamma' });
  assert.deepEqual(state.selected, [null, null, null]);
  state.setSourceFilter({ query: '' });
  assert.deepEqual(state.displayOrder, canonical, 'Clearing the filter cannot revive grouping from a removed method');

  state.select(1, 'shared');
  state.select(2, 'float');
  state.select(2, 'float');
  const checkpoint = state.captureSelection();
  const grouped = state.displayOrder;
  assert.deepEqual(state.selected, [null, null, null]);
  assert.notDeepEqual(grouped, canonical, 'Concept cancellation keeps its current position for double clicks');
  state.clearSelection();
  assert.deepEqual(state.displayOrder, canonical);
  state.restoreSelection(checkpoint);
  assert.deepEqual(state.displayOrder, grouped, 'An intentionally empty checkpoint is distinct from a selection invalidated by filtering');
});
