const express = require("express");
const util = require("util");
const bodyParser = require("body-parser");
const router = exports.router = express.Router();
const path = require("path");
const fs = require("fs");
const modelTools = require("./modelTools");
router.use(bodyParser.json());

function handleFile(req, res, {filename, searchTerm}) {
    var indexTemplate = fs.readFileSync(path.resolve(__dirname, "../index.html")).toString();
    var root = path.resolve(".");
    if (!filename.startsWith(root))
        throw new Error(`expected '${filename}' to start with '${root}'`);
    var relativePath = filename.substr(root.length).replace('\\', '/');
    var vars = `
window.modelUrl = ${util.inspect(relativePath)};
window.displayText = ${util.inspect(searchTerm)};
`;
    const index = indexTemplate.replace("//defineVars", vars);
    res.send(index);
}

router.get(/\/file\/(.*)/, function(req, res) {
    var param = req.params[0];
    var searchTerm = path.basename(param, path.extname(param));
    var filename = path.resolve(".downloaded", param);
    handleFile(req, res, {searchTerm, filename});
});

router.get("/model/:searchTerm", function (req, res) {
    const searchTerm = req.params.searchTerm;
    if (!searchTerm)
        throw new Error("must specify a search term");

    modelTools.getModel(searchTerm, function(err, filename) {
        if (err)
        {
            console.error(err.stack);
            res.status(500).send(util.format("<pre>%s</pre>", err.stack));
        }
        else
            handleFile(req, res, {filename, searchTerm});
    });

});

if (require.main === module) {
    const app = express();
    app.use(router);
    app.use(express.static("."));
    const PORT = 3000;
    app.listen(PORT, function() {
        console.log("Example app listening on port " + PORT);
    });
}
