export function sortEntryList(entries) {
  return [...entries].sort((a, b) => {
    const aOrder = Number(a.entry_order) > 0 ? Number(a.entry_order) : Infinity;
    const bOrder = Number(b.entry_order) > 0 ? Number(b.entry_order) : Infinity;
    if (aOrder !== bOrder) return aOrder < bOrder ? -1 : 1;
    return Number(a.start_number || 0) - Number(b.start_number || 0);
  });
}
