// Tailwind v3 (cùng thế hệ với bản play CDN cdn.tailwindcss.com mà Timesheet dùng trước đây).
// Chỉ quét mã nguồn của Timesheet để sinh đúng các class đang dùng.
module.exports = {
  content: ['./index.html', './src/**/*.jsx'],
  theme: { extend: {} },
  plugins: [],
};
