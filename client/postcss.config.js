export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {
      flexbox: true,
      grid: true,
      // Removed deprecated `browsers` option; rely on browserslist (add to package.json if needed)
    },
  },
  "browserslist": [
    ">0.5%",
    "last 2 versions",
    "not dead"
  ]
};
