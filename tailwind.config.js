module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        glovo: {
          yellow: '#FFC244',
          green:  '#00A082',
          dark:   '#1C1C1E',
          darker: '#111113',
          card:   '#2C2C2E',
          border: '#3A3A3C',
        }
      }
    }
  },
  plugins: [],
}