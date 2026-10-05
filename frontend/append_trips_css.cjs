const fs = require('fs');
let css = fs.readFileSync('e:/promptwars/MyFirstFlightAI/frontend/src/App.css', 'utf8');

const newCss = `

@media (min-width: 768px) {
  .tripsgrid { grid-template-columns: repeat(2, 1fr); gap: 24px; max-width: 800px; margin: 0 auto; width: 100%; }
}
@media (min-width: 1200px) {
  .tripsgrid { grid-template-columns: repeat(3, 1fr); }
}
`;

fs.writeFileSync('e:/promptwars/MyFirstFlightAI/frontend/src/App.css', css + newCss);
