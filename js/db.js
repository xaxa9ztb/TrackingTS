// IndexedDB wrapper: 3 stores - employees, projects, timesheets
const DB = (() => {
  const DB_NAME = 'timesheet_app_db';
  const DB_VERSION = 2;
  let dbPromise = null;

  // Bản máy chủ: đánh dấu "bảng công trên máy này có thay đổi chưa lưu lên máy chủ" để lần đồng bộ sau không ghi đè.
  // Việc đồng bộ từ máy chủ tự ghi vào IndexedDB nên chạy trong quietly() để không bị tính là sửa tay.
  let quiet = 0;
  const markEdit = (storeName) => {
    if (storeName === 'timesheets' && !quiet) { try { localStorage.setItem('tsLocalEdits', '1'); } catch (e) { /* ignore */ } }
  };
  async function quietly(fn) { quiet++; try { return await fn(); } finally { quiet--; } }

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('employees')) {
          db.createObjectStore('employees', { keyPath: 'empId' });
        }
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'wbs' });
        }
        if (!db.objectStoreNames.contains('timesheets')) {
          const ts = db.createObjectStore('timesheets', { keyPath: 'id', autoIncrement: true });
          ts.createIndex('empId', 'empId');
          ts.createIndex('wbs', 'wbs');
          ts.createIndex('date', 'date');
        }
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  async function getAll(storeName) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(storeName, value) {
    markEdit(storeName);
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function bulkPut(storeName, values) {
    markEdit(storeName);
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      values.forEach(v => store.put(v));
      store.transaction.oncomplete = () => resolve();
      store.transaction.onerror = () => reject(store.transaction.error);
    });
  }

  async function bulkRemove(storeName, keys) {
    markEdit(storeName);
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      keys.forEach(k => store.delete(k));
      store.transaction.oncomplete = () => resolve();
      store.transaction.onerror = () => reject(store.transaction.error);
    });
  }

  async function remove(storeName, key) {
    markEdit(storeName);
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function clear(storeName) {
    markEdit(storeName);
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function count(storeName) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return { open, getAll, put, bulkPut, remove, bulkRemove, clear, count, quietly, markEdit };
})();
