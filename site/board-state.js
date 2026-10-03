function collectForward(links, ids) {
  return new Set(ids.flatMap((id) => links[id] ?? []));
}

function reverseLinks(links, ids) {
  const reverse = Object.fromEntries(ids.map(id => [id, []]));
  for (const [from, destinations] of Object.entries(links)) {
    for (const to of destinations) reverse[to].push(from);
  }
  return reverse;
}

function copyLevels(levels) {
  return levels.map(ids => [...ids]);
}

function copySnapshot(value) {
  return {
    ...value,
    selected: [...value.selected],
    visible: copyLevels(value.visible),
    displayOrder: copyLevels(value.displayOrder),
    related: copyLevels(value.related),
    dimmed: copyLevels(value.dimmed),
    edges: value.edges.map(edge => ({ ...edge })),
    focus: value.focus ? { ...value.focus } : null,
    previewTarget: value.previewTarget ? { ...value.previewTarget } : null,
  };
}

export function createBoardState(catalog) {
  const levels = [catalog.sources, catalog.designs, catalog.technologies].map(items => items.map(item => item.id));
  const sourceDesigns = Object.fromEntries(catalog.sources.map(item => [item.id, [...new Set(item.designs ?? [])]]));
  const designTechnologies = Object.fromEntries(catalog.designs.map(item => [item.id, [...new Set(item.technologies ?? [])]]));
  const designSources = reverseLinks(sourceDesigns, levels[1]);
  const technologyDesigns = reverseLinks(designTechnologies, levels[2]);
  const sourceTechnologies = Object.fromEntries(catalog.sources.map(item => [item.id, [...collectForward(designTechnologies, sourceDesigns[item.id])]]));
  const titles = new Map([...catalog.designs, ...catalog.technologies].map(item => [item.id, item.title]));
  const searchText = new Map(catalog.sources.map(item => [item.id, [
    item.title,
    item.summary,
    ...(item.preview ?? []).map(row => row.text),
    ...sourceDesigns[item.id].map(id => titles.get(id)),
    ...sourceTechnologies[item.id].map(id => titles.get(id)),
  ].filter(Boolean).join(' ').toLowerCase()]));
  const relationEdges = [[0, sourceDesigns], [1, designTechnologies]].flatMap(([fromLevel, links]) =>
    Object.entries(links).flatMap(([fromId, destinations]) => destinations.map(toId => ({ fromLevel, fromId, toLevel: fromLevel + 1, toId }))));
  const selected = [null, null, null];
  let displayOrders = copyLevels(levels);
  let filters = { query: '', type: '', status: '' };
  let filteredVisible = copyLevels(levels);
  let cachedSnapshot = null;

  function retainOrder(order, visible) {
    const allowed = new Set(visible);
    const retained = order.filter(id => allowed.has(id));
    const included = new Set(retained);
    return [...retained, ...visible.filter(id => !included.has(id))];
  }

  function assertLevel(level) {
    if (!Number.isInteger(level) || level < 0 || level >= levels.length) {
      throw new RangeError('Unknown board level');
    }
  }

  function assertVisibleItem(level, id) {
    assertLevel(level);
    if (!levels[level].includes(id)) {
      throw new RangeError('Unknown board item');
    }
    if (!currentSnapshot().visible[level].includes(id)) {
      throw new RangeError('Board item is outside the current filter');
    }
  }

  function visibleFor(visualSelection) {
    const visible = copyLevels(filteredVisible);
    if (visualSelection[0] !== null) {
      const designs = collectForward(sourceDesigns, [visualSelection[0]]);
      visible[1] = visible[1].filter((id) => designs.has(id));
      const technologies = collectForward(sourceTechnologies, [visualSelection[0]]);
      visible[2] = visible[2].filter((id) => technologies.has(id));
    }
    return visible;
  }

  function createSnapshot(visualSelection, previewTarget = null) {
    const visible = visibleFor(visualSelection);
    const focusLevel = visualSelection[2] !== null ? 2 : visualSelection[1] !== null ? 1 : visualSelection[0] !== null ? 0 : -1;
    const path = [new Set(), new Set(), new Set()];
    if (focusLevel === 0) {
      path[0].add(visualSelection[0]);
      path[1] = new Set(visible[1]);
      path[2] = new Set(visible[2]);
    } else if (focusLevel === 1) {
      path[1].add(visualSelection[1]);
      path[2] = collectForward(designTechnologies, [visualSelection[1]]);
      path[0] = new Set(designSources[visualSelection[1]]);
    } else if (focusLevel === 2) {
      path[2].add(visualSelection[2]);
      const availableDesigns = new Set(visible[1]);
      path[1] = new Set(technologyDesigns[visualSelection[2]].filter(id => availableDesigns.has(id)));
      path[0] = collectForward(designSources, [...path[1]]);
    }

    const related = visible.map((ids, level) => ids.filter(id => path[level].has(id)));
    const dimmed = visible.map((ids, level) => focusLevel < 0 ? [] : ids.filter(id => !path[level].has(id)));
    // Only fixed clicks update these orders; hover never moves existing cards.
    const displayOrder = visible.map((ids, level) => retainOrder(displayOrders[level], ids));
    const visibleSets = visible.map(ids => new Set(ids));
    const edges = relationEdges.filter(edge => visibleSets[edge.fromLevel].has(edge.fromId) && visibleSets[edge.toLevel].has(edge.toId))
      .map(edge => ({ ...edge, highlight: path[edge.fromLevel].has(edge.fromId) && path[edge.toLevel].has(edge.toId) }));

    return {
      selected: [...selected],
      visible,
      displayOrder,
      related,
      dimmed,
      edges,
      focus: focusLevel < 0 ? null : { level: focusLevel, id: visualSelection[focusLevel] },
      previewTarget: previewTarget ? { ...previewTarget } : null,
    };
  }

  function currentSnapshot() {
    cachedSnapshot ??= createSnapshot(selected);
    return cachedSnapshot;
  }

  function snapshot() {
    return copySnapshot(currentSnapshot());
  }

  function pruneSelection() {
    if (selected[0] !== null && !filteredVisible[0].includes(selected[0])) {
      selected.fill(null);
      displayOrders = copyLevels(levels);
      return;
    }
    const visible = visibleFor(selected);
    let removedSelection = false;
    for (let level = 1; level < levels.length; level += 1) {
      if (selected[level] !== null && !visible[level].includes(selected[level])) {
        selected[level] = null;
        removedSelection = true;
      }
    }
    if (removedSelection && !selected.some(Boolean)) displayOrders = copyLevels(levels);
  }

  function setSourceFilter(next = {}) {
    const updated = Object.fromEntries(Object.keys(filters).map(key => [key, key in next ? String(next[key] ?? '').trim() : filters[key]]));
    if (Object.keys(filters).every(key => updated[key] === filters[key])) return snapshot();
    filters = updated;
    if (!filters.query && !filters.type && !filters.status) filteredVisible = copyLevels(levels);
    else {
      const terms = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
      const sources = catalog.sources.filter(item => (!filters.type || item.type === filters.type)
        && (!filters.status || item.status === filters.status)
        && terms.every(term => searchText.get(item.id).includes(term))).map(item => item.id);
      const designs = collectForward(sourceDesigns, sources);
      const technologies = collectForward(sourceTechnologies, sources);
      filteredVisible = [sources, levels[1].filter(id => designs.has(id)), levels[2].filter(id => technologies.has(id))];
    }
    pruneSelection();
    cachedSnapshot = null;
    return snapshot();
  }

  function preview(level, id) {
    assertVisibleItem(level, id);
    const visualSelection = [...selected];
    visualSelection[level] = id;
    for (let downstream = level + 1; downstream < visualSelection.length; downstream += 1) {
      visualSelection[downstream] = null;
    }
    if (level === 2 && visualSelection[1] !== null && !designTechnologies[visualSelection[1]].includes(id)) {
      visualSelection[1] = null;
    }
    return createSnapshot(visualSelection, { level, id });
  }

  return {
    get levels() {
      return copyLevels(levels);
    },
    get filters() {
      return { ...filters };
    },
    get selected() {
      return [...selected];
    },
    get visible() {
      return copyLevels(currentSnapshot().visible);
    },
    get displayOrder() {
      return copyLevels(currentSnapshot().displayOrder);
    },
    get related() {
      return copyLevels(currentSnapshot().related);
    },
    get dimmed() {
      return copyLevels(currentSnapshot().dimmed);
    },
    get edges() {
      return currentSnapshot().edges.map(edge => ({ ...edge }));
    },
    snapshot,
    preview,
    setSourceFilter,
    captureSelection() {
      return { selected: [...selected], displayOrders: displayOrders.map(ids => [...ids]) };
    },
    restoreSelection(checkpoint) {
      checkpoint.selected.forEach((id, level) => {
        selected[level] = id;
      });
      displayOrders = checkpoint.displayOrders.map(ids => [...ids]);
      // Filters belong to the current view, never to a delayed click checkpoint.
      pruneSelection();
      cachedSnapshot = null;
      return snapshot();
    },
    select(level, id) {
      assertVisibleItem(level, id);
      selected[level] = selected[level] === id ? null : id;
      for (let downstream = level + 1; downstream < selected.length; downstream += 1) {
        selected[downstream] = null;
      }
      if (level === 2 && selected[2] !== null && selected[1] !== null && !designTechnologies[selected[1]].includes(selected[2])) {
        selected[1] = null;
      }
      cachedSnapshot = null;
      const next = currentSnapshot();
      // Reorder only columns to the right, keeping both clicks of a double click
      // over the same button. A concept click preserves its current grouping.
      for (let downstream = level + 1; downstream < levels.length; downstream += 1) {
        displayOrders[downstream] = next.focus
          ? [...next.related[downstream], ...next.dimmed[downstream]]
          : [...next.visible[downstream]];
      }
      next.displayOrder = next.visible.map((ids, index) => retainOrder(displayOrders[index], ids));
      return snapshot();
    },
    clearSelection() {
      selected.fill(null);
      displayOrders = copyLevels(levels);
      cachedSnapshot = null;
      return snapshot();
    },
  };
}
