/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",          // App Router pages/layouts
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",        // if you still have Pages Router anywhere
    "./components/**/*.{js,ts,jsx,tsx,mdx}",   // your Header, UserAvatar, etc.
    "./src/**/*.{js,ts,jsx,tsx,mdx}",    
          // if you use src/ folder
    // Add more if needed, e.g. "./features/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      // Put your custom colors, fonts, etc. here if you have any
    },
  },
  plugins: [],
  // No need for darkMode/variants/purge anymore unless you specifically want them
}