// Local snapshots (in-browser) so a bad update can be rolled back.
// A snapshot is taken automatically before destructive operations
// (full import, bulk delete, restore). Keeps the 5 most recent.
const Backup = (() => {
  const MAX_KEEP = 5;

  async function snapshot(label) {
    const [employees, projects, timesheets] = await Promise.all([
      DB.getAll('employees'), DB.getAll('projects'), DB.getAll('timesheets'),
    ]);
    if (!employees.length && !projects.length && !timesheets.length) return null;
    let specHeaders = null;
    try { specHeaders = JSON.parse(localStorage.getItem('specHeaders') || 'null'); } catch (e) { /* ignore */ }
    await DB.put('backups', {
      ts: new Date().toISOString(),
      label: label || '',
      specHeaders, employees, projects, timesheets,
    });
    const all = await DB.getAll('backups');
    all.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    for (const old of all.slice(MAX_KEEP)) await DB.remove('backups', old.id);
  }

  async function list() {
    const all = await DB.getAll('backups');
    return all
      .sort((a, b) => (a.ts < b.ts ? 1 : -1))
      .map(b => ({
        id: b.id, ts: b.ts, label: b.label,
        employees: b.employees.length, projects: b.projects.length, timesheets: b.timesheets.length,
      }));
  }

  async function restore(id) {
    const all = await DB.getAll('backups');
    const b = all.find(x => x.id === id);
    if (!b) throw new Error('Không tìm thấy bản sao lưu');
    await snapshot('Trước khi khôi phục (tự động)');
    await DB.clear('employees');
    await DB.clear('projects');
    await DB.clear('timesheets');
    await DB.bulkPut('employees', b.employees);
    await DB.bulkPut('projects', b.projects);
    await DB.bulkPut('timesheets', b.timesheets);
    if (b.specHeaders) {
      try { localStorage.setItem('specHeaders', JSON.stringify(b.specHeaders)); } catch (e) { /* ignore */ }
    }
    return { employees: b.employees.length, projects: b.projects.length, timesheets: b.timesheets.length };
  }

  return { snapshot, list, restore };
})();
