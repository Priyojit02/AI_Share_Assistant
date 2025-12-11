/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff8f0',   // Very light orange
          100: '#fff0e0',  // Light orange
          200: '#ffe0b3',  // Lighter orange
          300: '#ffd280',  // Light orange
          400: '#ffb74d',  // Medium light orange
          500: '#ffb612',  // PwC Light Orange
          600: '#ff9d00',  // Darker orange
          700: '#e68900',  // Dark orange
          800: '#cc7600',  // Very dark orange
          900: '#b36600',  // Deep orange
        },
        secondary: {
          50: '#f0f4f8',   // Very light navy
          100: '#e1e8f0',  // Light navy
          200: '#c8d4e0',  // Lighter navy
          300: '#9bb0c7',  // Light navy
          400: '#6b8fb8',  // Medium light navy
          500: '#003366',  // PwC Navy Blue
          600: '#002d5c',  // Darker navy
          700: '#00264d',  // Dark navy
          800: '#001f3f',  // Very dark navy
          900: '#001a33',  // Deep navy
        },
        accent: {
          50: '#ffffff',   // White
          100: '#f8f9fa',  // Off white
          200: '#e9ecef',  // Light gray
          300: '#dee2e6',  // Light gray
          400: '#ced4da',  // Medium light gray
          500: '#adb5bd',  // Medium gray
          600: '#6c757d',  // Dark gray
          700: '#495057',  // Darker gray
          800: '#343a40',  // Very dark gray
          900: '#212529',  // Almost black
        },
        create: {
          500: '#b22222',  // Deep reddish orange for create button
          600: '#a01c1c',  // Darker reddish orange for hover
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}