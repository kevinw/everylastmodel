const express = require("express");
const bodyParser = require("body-parser");
const router = exports.router = express.Router();
const modelTools = require("./modelTools");
router.use(bodyParser.json());

router.get("/model/:searchTerm", function (req, res) {
    const searchTerm = req.params.searchTerm;
    if (!searchTerm)
        throw new Error("must specify a search term");

    modelTools.getModel(searchTerm, function(err, filename) {
        if (err) throw err;
        res.send(filename);
    });

});

if (require.main === module) {
    const app = express();
    app.use(router);
    app.use(express.static("bin"));
    const PORT = 3000;
    app.listen(PORT, function() {
        console.log("Example app listening on port " + PORT);
    });
}
