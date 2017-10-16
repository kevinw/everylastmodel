const fs = require("fs");
const path = require("path");

const shortid = require("shortid");

const getModel = require("./modelTools").getModel;
const renderModelFile = require("./headless").renderModelFile;
const bot = require("./bot");

function randomWordFromFile(filename) {
    const wordLines = fs.readFileSync(path.resolve(__dirname, filename)).toString();
    const words = wordLines.split("\n");
    const word = words[Math.floor(Math.random() * words.length)].replace('\r','').replace('\n','');
    return word;
}

function generateText() {
    return randomWordFromFile("../scrapers/newwords/words.txt");
}

function pickRandomThing() {
    return randomWordFromFile("../scrapers/things/things.txt");
}

function searchRenderAndTween(term) {
    getModel(term, function(err, file) {
        if (err) throw err;
        const imageFile = path.resolve(__dirname, `../.images/${term}_${shortid.generate()}.png`);
        renderModelFile(file, imageFile, generateText(), function(err, imageFile) {
            if (err) throw err;
            bot.tweetImageFile('', imageFile, function(err, result) {
                if (err) throw err;
                console.log(result);
            });
        });
    });
}

if (require.main === module) {
    var term;
    if (process.argv.length < 3)
        term = pickRandomThing();
    else
        term = process.argv[2];

    searchRenderAndTween(term);
}
