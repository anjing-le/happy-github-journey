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

export function createBoardState() {
  const levels = INITIAL_LEVELS.map((ids) => [...ids]);
  const selected = [null, null, null];

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

  function snapshot() {
    const visible = levels.map((ids) => [...ids]);
    const related = [[], [], []];

    if (selected[0] !== null) {
      const designs = collectForward(SOURCE_DESIGNS, [selected[0]]);
      visible[1] = levels[1].filter((id) => designs.has(id));
      related[1] = [...visible[1]];
    }

    if (selected[1] !== null || selected[0] !== null) {
      const designs = selected[1] === null ? visible[1] : [selected[1]];
      const technologies = collectForward(DESIGN_TECHNOLOGIES, designs);
      visible[2] = levels[2].filter((id) => technologies.has(id));
      related[2] = [...visible[2]];
    }

    return {
      selected: [...selected],
      visible,
      related,
    };
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
    get related() {
      return snapshot().related;
    },
    snapshot,
    select(level, id) {
      assertVisibleItem(level, id);
      selected[level] = selected[level] === id ? null : id;
      for (let downstream = level + 1; downstream < selected.length; downstream += 1) {
        selected[downstream] = null;
      }
      return snapshot();
    },
    clearSelection() {
      selected.fill(null);
      return snapshot();
    },
  };
}
