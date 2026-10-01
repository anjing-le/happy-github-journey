const INITIAL_LEVELS = [
  ['source-1', 'source-2', 'source-3', 'source-4', 'source-5'],
  ['design-1', 'design-2', 'design-3', 'design-4', 'design-5'],
  ['tech-1', 'tech-2', 'tech-3', 'tech-4', 'tech-5'],
];

const SOURCE_DESIGNS = {
  'source-1': ['design-1', 'design-2'],
  'source-2': ['design-2', 'design-3'],
  'source-3': ['design-3'],
  'source-4': ['design-4', 'design-5'],
  'source-5': ['design-5'],
};

const DESIGN_TECHNOLOGIES = {
  'design-1': ['tech-1', 'tech-2'],
  'design-2': ['tech-2', 'tech-3'],
  'design-3': ['tech-3'],
  'design-4': ['tech-4'],
  'design-5': ['tech-4', 'tech-5'],
};

function collectForward(links, ids) {
  return new Set(ids.flatMap((id) => links[id] ?? []));
}

function collectReverse(links, ids) {
  return new Set(
    Object.entries(links)
      .filter(([, linked]) => linked.some((id) => ids.has(id)))
      .map(([id]) => id),
  );
}

export function createBoardState() {
  const manualOrder = INITIAL_LEVELS.map((ids) => [...ids]);
  let displayOrder = manualOrder.map((ids) => [...ids]);
  let active = null;

  function assertLevel(level) {
    if (!Number.isInteger(level) || level < 0 || level >= manualOrder.length) {
      throw new RangeError('Unknown board level');
    }
  }

  function assertItem(level, id) {
    assertLevel(level);
    if (!manualOrder[level].includes(id)) {
      throw new RangeError('Unknown board item');
    }
  }

  function relatedSets() {
    const result = [new Set(), new Set(), new Set()];
    if (!active) return result;

    if (active.level === 0) {
      result[1] = collectForward(SOURCE_DESIGNS, [active.id]);
    } else if (active.level === 1) {
      result[0] = collectReverse(SOURCE_DESIGNS, new Set([active.id]));
      result[2] = collectForward(DESIGN_TECHNOLOGIES, [active.id]);
    } else {
      result[1] = collectReverse(DESIGN_TECHNOLOGIES, new Set([active.id]));
    }
    return result;
  }

  function snapshot() {
    const sets = relatedSets();
    const related = displayOrder.map((ids, level) => ids.filter((id) => sets[level].has(id)));
    const selected = manualOrder.map((_, level) => active?.level === level ? active.id : null);
    return {
      active: active ? { ...active } : null,
      selected,
      ordered: displayOrder.map((ids) => [...ids]),
      related,
    };
  }

  function bubbleRelated() {
    const sets = relatedSets();
    displayOrder = manualOrder.map((ids, level) => {
      // A clicked block stays in place; only connected columns bubble.
      if (!active) return [...ids];
      if (active.level === level) return [...displayOrder[level]];
      return [
        ...ids.filter((id) => sets[level].has(id)),
        ...ids.filter((id) => !sets[level].has(id)),
      ];
    });
  }

  return {
    get levels() {
      return manualOrder.map((ids) => [...ids]);
    },
    get active() {
      return active ? { ...active } : null;
    },
    get selected() {
      return snapshot().selected;
    },
    get ordered() {
      return snapshot().ordered;
    },
    get related() {
      return snapshot().related;
    },
    snapshot,
    select(level, id) {
      assertItem(level, id);
      active = { level, id };
      bubbleRelated();
      return snapshot();
    },
    move(level, id, targetId = null) {
      assertItem(level, id);
      if (targetId !== null) assertItem(level, targetId);
      if (id !== targetId) {
        const ids = displayOrder[level];
        ids.splice(ids.indexOf(id), 1);
        const targetIndex = targetId === null ? ids.length : ids.indexOf(targetId);
        ids.splice(targetIndex, 0, id);
        manualOrder[level] = [...ids];
      }
      return snapshot();
    },
    clearSelection() {
      active = null;
      displayOrder = manualOrder.map((ids) => [...ids]);
      return snapshot();
    },
  };
}
