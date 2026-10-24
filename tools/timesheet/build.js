// Build Timesheet (không cần khi chỉ dùng app — GitHub Pages phục vụ thẳng các file đã build).
//   cd tools/timesheet && npm install && npm run build
// 1) src/app.jsx  --(Babel, JSX → JS)-->  app.js
// 2) src/tailwind.css + các class trong mã nguồn  --(Tailwind v3)-->  tailwind.css
// Sửa giao diện/logic: sửa src/app.jsx (KHÔNG sửa app.js), rồi chạy lại build và commit cả hai.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Babel = require('@babel/standalone');

const here = (...p) => path.join(__dirname, ...p);
const src = fs.readFileSync(here('src', 'app.jsx'), 'utf8');
const { code } = Babel.transform(src, { presets: ['react'], comments: true, retainLines: false });
const banner = '/* FILE ĐƯỢC SINH TỰ ĐỘNG từ src/app.jsx bằng `npm run build` — đừng sửa trực tiếp. */\n';
fs.writeFileSync(here('app.js'), banner + code + '\n');
console.log('app.js        ', fs.statSync(here('app.js')).size, 'bytes');

const tw = require.resolve('tailwindcss/lib/cli.js');
execFileSync(process.execPath, [tw, '-c', here('tailwind.config.js'), '-i', here('src', 'tailwind.css'), '-o', here('tailwind.css'), '--minify'],
  { cwd: __dirname, stdio: ['ignore', 'ignore', 'inherit'] });
console.log('tailwind.css  ', fs.statSync(here('tailwind.css')).size, 'bytes');
