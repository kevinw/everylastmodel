const fs = require("fs");
const path = require("path");

function randomWordFromFile(filename) {
  const wordLines = fs
    .readFileSync(path.resolve(__dirname, filename))
    .toString();
  const words = wordLines.split("\n");
  const word = words[Math.floor(Math.random() * words.length)]
    .replace("\r", "")
    .replace("\n", "");
  return word;
}

function randomText() {
  return randomWordFromFile("../scrapers/newwords/words.txt");
}

function randomThing() {
  return randomWordFromFile("../scrapers/things/things.txt");
}

module.exports = {
  randomText,
  randomThing,
  randomWordFromFile
};
