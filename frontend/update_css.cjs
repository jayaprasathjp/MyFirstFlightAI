const fs = require('fs');
let css = fs.readFileSync('e:/promptwars/MyFirstFlightAI/frontend/src/App.css', 'utf8');
const splitIndex = css.indexOf('/* PC Compatibility');
if (splitIndex !== -1) {
  css = css.substring(0, splitIndex);
}

const newCss = `/* PC Compatibility (Dashboard Layout) */
@media (min-width: 768px) {
  body { padding: 0; background: var(--bg); }
  .app { 
    max-width: none; 
    margin: 0; 
    border-radius: 0; 
    border: none; 
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    background: var(--bg);
  }
  
  .app:has(.stepper) {
    grid-template-columns: 280px 1fr;
  }
  .app:not(:has(.stepper)) {
    grid-template-columns: 1fr;
  }
  
  .top {
    grid-column: 1 / -1;
    padding: 0 48px;
    height: 70px;
    background: var(--app);
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
    z-index: 20;
  }
  
  .stepper {
    grid-column: 1 / 2;
    grid-row: 2 / 4;
    border-bottom: none;
    border-right: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    padding: 32px 24px;
    gap: 8px;
    background: var(--app);
    position: sticky;
    top: 70px;
    height: calc(100vh - 70px);
    overflow-y: auto;
  }
  
  .stepper button {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 16px;
    text-align: left;
    padding: 16px 20px;
    border-radius: 12px;
    font-size: 15px;
    width: 100%;
  }
  .stepper button.on { background: var(--brand-soft); }
  .stepper button:hover { opacity: 0.8; }
  
  .screen {
    grid-column: 2 / 3;
    grid-row: 2 / 3;
    padding: 48px 64px;
    max-width: 1000px;
    width: 100%;
    margin: 0 auto;
    background: transparent;
    padding-bottom: 40px;
  }
  .app:not(:has(.stepper)) .screen {
    grid-column: 1 / -1;
  }
  
  .foot {
    grid-column: 2 / 3;
    grid-row: 3 / 4;
    padding: 24px 64px 48px;
    text-align: left;
    display: flex;
    gap: 24px;
    justify-content: flex-start;
  }
  .app:not(:has(.stepper)) .foot {
    grid-column: 1 / -1;
    justify-content: center;
  }
  
  .dock {
    inset-inline-end: 40px;
    bottom: 40px;
    position: fixed;
  }
  
  /* Modals as centered dialogs */
  .lost, .sheet {
    top: 50%; left: 50%; right: auto; bottom: auto;
    transform: translate(-50%, -50%);
    width: 90vw;
    max-width: 800px;
    max-height: 85vh;
    border-radius: 24px;
    box-shadow: 0 0 0 100vmax rgba(0,0,0,0.5), 0 24px 80px rgba(0,0,0,0.3);
    border: 1px solid var(--line);
    margin: 0;
    padding: 40px;
  }
  
  .langs { grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .pax { grid-template-columns: repeat(2, 1fr); gap: 20px; }
  .prog { grid-template-columns: repeat(2, 1fr); align-items: start; gap: 20px; }
  .boardingform { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .row2.even { grid-template-columns: 1fr 1fr; }
  
  .lostgrid { display: grid; grid-template-columns: 1fr 1fr; }
  .lostgrid > div { border-bottom: 0; border-right: 1px solid var(--line); }
  .lostgrid > div:nth-child(even) { border-right: 0; }
  .lostgrid > div:nth-child(1), .lostgrid > div:nth-child(2) { border-bottom: 1px solid var(--line); }

  .tripsgrid { grid-template-columns: repeat(2, 1fr); gap: 24px; max-width: 800px; margin: 0 auto; width: 100%; }
}

@media (min-width: 1200px) {
  .langs { grid-template-columns: repeat(4, 1fr); }
  .pax { grid-template-columns: repeat(3, 1fr); }
  .prog { grid-template-columns: repeat(3, 1fr); }
  .tripsgrid { grid-template-columns: repeat(3, 1fr); }
}
`;

fs.writeFileSync('e:/promptwars/MyFirstFlightAI/frontend/src/App.css', css + newCss);
