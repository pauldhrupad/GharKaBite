const starterImages = {
  "veg-home-meal": ["/images/bengali-thali.jpg", "/images/categories/veg-thali.webp"],
  "egg-curry-meal": ["/images/dal-rice.jpg", "/images/categories/egg-thali.webp"],
  "chicken-home-meal": ["/images/chicken-meal.jpg", "/images/categories/chicken-thali.webp"],
  "fish-curry-meal": ["/images/home-table.jpg", "/images/categories/fish-thali.webp"],
};

export function thaliPreviewImage(meal) {
  const starter = starterImages[meal.id];
  const illustration = Boolean(starter && meal.image === starter[0]);
  return { src: illustration ? starter[1] : meal.image || "", illustration };
}

export function requiredChoiceProgress(meal, choices) {
  const required = meal.choiceGroups.filter((group) => (group.minSelections ?? (group.required ? 1 : 0)) > 0);
  const completed = required.filter((group) => {
    const ids = choices[group.id];
    return Array.isArray(ids) && new Set(ids).size === ids.length && ids.length >= (group.minSelections ?? 1) && ids.length <= (group.maxSelections ?? 1) && ids.every((id) => group.options.some((option) => option.id === id && option.active !== false));
  }).length;
  return { completed, total: required.length };
}

// Recovery maps are applied only after the customer explicitly requests removal.
export function reviewThaliSelections(meal, choices = {}, addOns = {}, previous = {}) {
  const issues = [];
  const cleanChoices = {};
  const cleanAddOns = {};
  const oldGroups = Array.isArray(previous.choiceSummary) ? previous.choiceSummary : [];
  const oldExtras = Array.isArray(previous.addOnSummary) ? previous.addOnSummary : [];
  for (const [groupId, ids] of Object.entries(choices)) {
    const group = meal.choiceGroups.find((entry) => entry.id === groupId);
    const oldGroup = oldGroups.find((entry) => entry.groupId === groupId);
    const valid = [];
    for (const id of Array.isArray(ids) ? ids : []) {
      const option = group?.options.find((entry) => entry.id === id);
      if (!option || option.active === false || valid.includes(id)) {
        const name = option?.name || oldGroup?.options?.find((entry) => entry.id === id)?.name || id;
        issues.push(`${oldGroup?.groupName || group?.name || groupId}: ${name} is no longer available.`);
      } else valid.push(id);
    }
    if (!Array.isArray(ids)) issues.push(`Review the saved choices for ${group?.name || groupId}.`);
    if (group) cleanChoices[groupId] = valid;
    else if (!Array.isArray(ids) || !ids.length) issues.push(`${oldGroup?.groupName || groupId} is no longer available.`);
  }
  for (const [id, count] of Object.entries(addOns)) {
    const extra = meal.addOns.find((entry) => entry.id === id);
    if (!extra || extra.active === false) issues.push(`${extra?.name || oldExtras.find((entry) => entry.id === id)?.name || id} is no longer available.`);
    else cleanAddOns[id] = count;
  }
  return { issues, cleanChoices, cleanAddOns };
}
