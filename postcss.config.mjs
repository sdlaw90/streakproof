/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Tailwind 4 moved its PostCSS plugin into its own package, and handles
    // vendor prefixing itself — autoprefixer is no longer needed.
    "@tailwindcss/postcss": {},
  },
};

export default config;
