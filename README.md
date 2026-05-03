# Momentum Habit Tracker

A polished React habit/task tracker with:

- Sticky product-style header
- Dashboard with stats, trends, target progress, and streaks
- Daily marking page
- Week view
- Month view with heatmap
- Year contribution-style heatmap
- Targets page to group multiple habits/goals
- Habit start and end dates
- Future-day locking
- Achieved habits retire from future daily lists

## Run locally

```bash
npm install
npm run dev
```

Then open the URL shown in your terminal, usually:

```bash
http://localhost:5173
```

## Build for production

```bash
npm run build
npm run preview
```

## Project structure

```txt
momentum-habit-tracker/
  index.html
  package.json
  tailwind.config.js
  postcss.config.js
  src/
    App.jsx
    main.jsx
    styles.css
```

## Notes

This is currently a frontend-only prototype. Data is stored in React state, so it resets on page refresh.

Good next upgrades:

- Save data to localStorage
- Add editing for start/end dates
- Add custom emoji/color per habit
- Add authentication and database
- Add real charts using Recharts
