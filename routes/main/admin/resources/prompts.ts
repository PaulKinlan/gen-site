// Exmaple prompts.ts

const prompts = [
  `A fan site about Everton FC.

[page]
a brief history of the club, its most famous players, and its greatest achievements.

[page]
The club's current squad and recent results.

[page]
The club's stadium and the match-day experience.
  `,
  `A blog about the history of Ruthin, North Wales`,
  `A blog about the best places to eat in London.`,
  `A site about the history of the Roman Empire.`,
  `A blog about the best places to visit in Paris.`,
  `A fan site about the Beatles.`,
  `A blog about the best places to visit in New York.`,
  `A site about the history of the British Empire.`,
  `A fan site about the Rolling Stones.`,
  `A blog about the best places to eat in Tokyo.`,
  `A site about the history of the Ottoman Empire.`,
  `A fan site about the Who.`,
  `A blog about the best places to visit in Rome.`,
  `A site about the history of the Mongol Empire.`,
  `A fan site about the Kinks.`,
  `A blog about the best places to eat in Berlin.`,
  `A site about the history of the Spanish Empire.`,
  `A fan site about the Clash.`,
  `A blog about the best places to visit in Madrid.`,
  `A site about the history of the Russian Empire.`,
];

export function generatePrompt() {
  return prompts[Math.floor(Math.random() * prompts.length)];
}
