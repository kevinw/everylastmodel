const getModel = require("./modelTools").getModel;
const renderModelFile = require("./headless").renderModelFile;
const bot = require("./bot");

function searchRenderAndTween(term) {
    getModel(term, function(err, file) {
        if (err) throw err;
        renderModelFile(file, function(err, imageFile) {
            if (err) throw err;
            bot.tweetImageFile(imageFile, function(err, result) {
                if (err) throw err;
                console.log(result);
            });
        });
    });
}

if (require.main === module) {
    var term = process.argv[2];
    searchRenderAndTween(term);
}
