const path = require("path");
const shortid = require("shortid");

const generate = require("./generate");
const getModel = require("./modelTools").getModel;
const renderModelFile = require("./headless").renderModelFile;
const bot = require("./bot");

function searchRenderAndTween(term) {
  getModel(term, function(err, modelInfo) {
    if (err) throw err;

    console.assert(typeof modelInfo.filename === "string");

    const imageFile = path.resolve(
      process.cwd(),
      `.images/${term}_${shortid.generate()}.png`
    );
    renderModelFile(modelInfo.filename, imageFile, generate.randomText(), function(
      err,
      imageFile
    ) {
      if (err) throw err;
      bot.tweetImageFile(modelInfo.url, imageFile, function(err, result) {
        if (err) throw err;
        console.log(result);
      });
    });
  });
}

if (require.main === module) {
  const term =
    process.argv.length < 3 ? generate.randomThing() : process.argv[2];
  searchRenderAndTween(term);
}
