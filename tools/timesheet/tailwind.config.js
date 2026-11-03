// Tailwind v3 (cùng thế hệ với bản play CDN cdn.tailwindcss.com mà Timesheet dùng trước đây).
// Chỉ quét mã nguồn của Timesheet để sinh đúng các class đang dùng.
// Hệ thiết kế NI (css/ni.css): họ chữ Be Vietnam Pro, thang xám "slate" = xám NI, bo góc 6px (nút, ô nhập) / 10px (thẻ).
// Xanh blue-700 (#1d4ed8) đã trùng màu hành động --ni-action nên giữ nguyên thang blue.
module.exports = {
  content: ['./index.html', './src/**/*.jsx'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
      },
      colors: {
        slate: {
          50: '#f8f9fb', 100: '#f4f6f9', 200: '#e3e7ee', 300: '#c9d0db', 400: '#98a2b3',
          500: '#667085', 600: '#475467', 700: '#344054', 800: '#1d2939', 900: '#0f1b2d', 950: '#0a1320',
        },
      },
      borderRadius: { lg: '6px', xl: '10px', '2xl': '10px' },
    },
  },
  plugins: [],
};
