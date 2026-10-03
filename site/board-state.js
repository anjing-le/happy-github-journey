function collectForward(links, ids) {
  return new Set(ids.flatMap((id) => links[id] ?? []));
}

export function createBoardState(catalog) {
  const levels = [catalog.sources, catalog.designs, catalog.technologies].map(items => items.map(item => item.id));
  const sourceDesigns = Object.fromEntries(catalog.sources.map(item => [item.id, item.designs ?? []]));
  const designTechnologies = Object.fromEntries(catalog.designs.map(item => [item.id, item.technologies ?? []]));
  const selected = [null, null, null];
  let displayOrders = levels.map(ids => [...ids]);

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
    if (!snapshot().visible[level].includes(id)) {
      throw new RangeError('Board item is outside the current filter');
    }
  }

  function createSnapshot(visualSelection, previewTarget = null) {
    const visible = levels.map((ids) => [...ids]);

    if (visualSelection[0] !== null) {
      const designs = collectForward(sourceDesigns, [visualSelection[0]]);
      visible[1] = levels[1].filter((id) => designs.has(id));
      const technologies = collectForward(designTechnologies, visible[1]);
      visible[2] = levels[2].filter((id) => technologies.has(id));
    }

    const focusLevel = visualSelection[2] !== null ? 2 : visualSelection[1] !== null ? 1 : visualSelection[0] !== null ? 0 : -1;
    const path = [new Set(), new Set(), new Set()];
    if (focusLevel === 0) {
      path[0].add(visualSelection[0]);
      path[1] = new Set(visible[1]);
      path[2] = new Set(visible[2]);
    } else if (focusLevel === 1) {
      path[1].add(visualSelection[1]);
      path[2] = collectForward(designTechnologies, [visualSelection[1]]);
      path[0] = new Set(visible[0].filter(id => sourceDesigns[id].includes(visualSelection[1])));
    } else if (focusLevel === 2) {
      path[2].add(visualSelection[2]);
      path[1] = new Set(visible[1].filter(id => designTechnologies[id].includes(visualSelection[2])));
      path[0] = new Set(visible[0].filter(id => sourceDesigns[id].some(design => path[1].has(design))));
    }

    const related = visible.map((ids, level) => ids.filter(id => path[level].has(id)));
    const dimmed = visible.map((ids, level) => focusLevel < 0 ? [] : ids.filter(id => !path[level].has(id)));
    // Only fixed clicks update these orders; hover never moves existing cards.
    const displayOrder = visible.map((ids, level) => retainOrder(displayOrders[level], ids));
    const edges = [];
    for (const [fromLevel, links] of [[0, sourceDesigns], [1, designTechnologies]]) {
      const toLevel = fromLevel + 1;
      const destinations = new Set(visible[toLevel]);
      for (const fromId of visible[fromLevel]) {
        for (const toId of new Set(links[fromId])) {
          if (!destinations.has(toId)) continue;
          edges.push({
            fromLevel,
            fromId,
            toLevel,
            toId,
            highlight: path[fromLevel].has(fromId) && path[toLevel].has(toId),
          });
        }
      }
    }

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

  function snapshot() {
    return createSnapshot(selected);
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
      return levels.map((ids) => [...ids]);
    },
    get selected() {
      return snapshot().selected;
    },
    get visible() {
      return snapshot().visible;
    },
    get displayOrder() {
      return snapshot().displayOrder;
    },
    get related() {
      return snapshot().related;
    },
    get dimmed() {
      return snapshot().dimmed;
    },
    get edges() {
      return snapshot().edges;
    },
    snapshot,
    preview,
    captureSelection() {
      return { selected: [...selected], displayOrders: displayOrders.map(ids => [...ids]) };
    },
    restoreSelection(checkpoint) {
      checkpoint.selected.forEach((id, level) => {
        selected[level] = id;
      });
      displayOrders = checkpoint.displayOrders.map(ids => [...ids]);
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
      const next = snapshot();
      // Reorder only columns to the right, keeping both clicks of a double click
      // over the same button. A concept click preserves its current grouping.
      for (let downstream = level + 1; downstream < levels.length; downstream += 1) {
        displayOrders[downstream] = next.focus
          ? [...next.related[downstream], ...next.dimmed[downstream]]
          : [...next.visible[downstream]];
      }
      return snapshot();
    },
    clearSelection() {
      selected.fill(null);
      displayOrders = levels.map(ids => [...ids]);
      return snapshot();
    },
  };
}
