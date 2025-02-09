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
  `the history of Ruthin, North Wales, with the following features:**

* **Homepage:**
  * **Hero Image:** A captivating image of a prominent Ruthin landmark (e.g., Ruthin Castle, St Peter's Church) or a scenic view of the town.  Consider using a high-resolution image and ensuring proper attribution if necessary.
  * **Brief Overview:** A concise and engaging introduction to Ruthin's history, highlighting key periods and events.  Aim for a paragraph or two that sparks interest and encourages further exploration.
  * **Featured Articles:** Links to 3-5 in-depth articles on specific aspects of Ruthin's history (e.g., "The Medieval History of Ruthin," "Ruthin in the Industrial Revolution," "Famous Figures of Ruthin").  These can be internal links to other pages on the site or external links to reputable resources.
  * **About Section:** A short bio of the page creator or the organization behind the website.  This adds credibility and context.
  * **Contact Information:** An email address or a contact form for user inquiries.  Consider a simple contact form for ease of use.

* **About Ruthin:**
  * **Geographical Location:** A map of Ruthin and its surrounding region.  An embedded Google Map or similar would be ideal.
  * **Timeline of Key Events:** A chronological list of significant historical dates and events in Ruthin's past.  A timeline format or interactive element could be engaging.
  * **Historical Figures:** Profiles of prominent individuals associated with Ruthin's history.  Include images if available and properly attributed.

* **Historical Resources:**
  * **Links to External Resources:** Links to relevant historical archives, libraries, and museums (e.g., National Library of Wales, Denbighshire Archives).  Categorize these links for clarity.
  * **Bibliography:** A list of books, articles, and other sources used for the website content.  Proper citation format is important for academic integrity.

* **Visual Appeal:**
  * **High-quality Images:** Use a variety of high-resolution images throughout the website (e.g., historical photographs, architectural details, maps).  Ensure they are optimized for web use to avoid slow loading times.
  * **Clear and Concise Text:** Use easy-to-read fonts and layout, with appropriate headings and subheadings.  Use headings (H1, H2, etc.) to structure content logically.
`,
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
