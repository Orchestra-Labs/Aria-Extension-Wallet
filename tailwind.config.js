import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontSize: {
      xs: ['11px', '13px'],
      sm: ['12px', '14px'],
      base: ['14px', '16px'],
      lg: ['16px', '20px'],
      xl: ['18px', '26px'],
    },
    colors: {
      transparent: 'transparent',
      inherit: 'inherit',
      white: '#F2F2FA',
      grey: {
        DEFAULT: '#D5D5E0',
        dark: '#6F7078',
      },
      'neutral-1': '#A2A2AA',
      'neutral-2': 'rgba(255, 255, 255, 0.06)',
      'neutral-3': 'rgba(82, 82, 90, 1)',
      'neutral-4': 'rgba(255, 255, 255, 0.09)',
      black: 'rgba(24, 24, 27, 1)',
      success: {
        DEFAULT: '#3FDBA8',
        dark: '#048A4E',
        darker: '#2D403A',
        light: '#00C896',
      },
      warning: {
        DEFAULT: '#D9B32E',
        dark: '#9C791C',
      },
      error: {
        DEFAULT: '#F75363',
        dark: '#9C0A36',
        light: '#FC2A58',
      },
      blue: {
        DEFAULT: '#61CBF4',
        darker: '#43ADD6',
        dark: '#2F99C2',
        light: '#4AB8D9',
        pressed: '#117BA4',
        hover: 'rgba(10, 103, 144, 0.42)',
        'pressed-secondary': 'rgba(0, 103, 144, 0.18)',
        'hover-secondary': 'rgba(87, 193, 234, 0.18)',
      },
      background: {
        black: 'rgba(10, 9, 13, 1)',
        'dark-grey': 'rgba(24, 24, 27, 1)',
        'dialog-overlay': 'rgba(19, 19, 19, 0.88)',
        'dialog-bg': 'rgba(34, 34, 37, 1)',
        'dropdown-bg': 'rgb(41 41 43)',
        gradient: 'linear-gradient(159.61deg, #202022 13.58%, rgba(51, 51, 70, 0.32) 86.49%)',
      },
    },
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
    },
    extend: {
      fontSize: {
        h1: ['32px', '44px'],
        h2: ['28px', '40px'],
        h3: ['24px', '34px'],
        h4: ['22px', '30px'],
        h5: ['20px', '28px'],
        h6: ['18px', '26px'],
      },
      animation: {
        'scale-up': 'scaleUp 0.3s ease-in-out',
        'slide-in-from-bottom': 'slideInFromBottom 0.3s ease-in-out',
        press: 'press 1.2s infinite',
        'press-effect': 'ripple 1.2s ease-out infinite',
      },
      keyframes: {
        scaleUp: {
          '0%': { transform: 'scale(0)' },
          '100%': { transform: 'scale(1)' },
        },
        slideInFromBottom: {
          '0%': { transform: 'translateY(100%)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        press: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(10px)' },
        },
        ripple: {
          '0%': { transform: 'scale(1)', opacity: 0.5 },
          '100%': { transform: 'scale(2.5)', opacity: 0 },
        },
      },
      height: {
        76: '18.75rem',
      },
      maxHeight: {
        76: '18.75rem',
      },
      minHeight: {
        76: '18.75rem',
      },
    },
  },
  plugins: [
    plugin(function ({ addVariant, addUtilities }) {
      addVariant('not-last', '&:not(:last-child)');
      addUtilities({
        '.hide-scrollbar': {
          /* Hide scrollbar for WebKit browsers (Chrome, Safari) */
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          /* Hide scrollbar for Firefox and Edge */
          'scrollbar-width': 'none', // Firefox
          '-ms-overflow-style': 'none', // IE and Edge
        },
      });
    }),
  ],
};
