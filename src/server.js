const express = require("express");
const util = require("util");
const bodyParser = require("body-parser");
const router = exports.router = express.Router();
const modelTools = require("./modelTools");
router.use(bodyParser.json());

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
