const util = require("util");
const path = require("path");
const fs = require("fs");

const express = require("express");
const router = (exports.router = express.Router());
const bodyParser = require("body-parser");
const filesize = require("filesize");

const modelTools = require("./modelTools");
const generate = require("./generate");

router.use(bodyParser.json());

const {downloadFolder} = require("./common");

function handleFile(req, res, { filename, searchTerm }) {
  const indexTemplate = fs
    .readFileSync(path.resolve(__dirname, "../index.html"))
    .toString();
  const root = path.resolve(".");
  if (!filename.startsWith(root))
    throw new Error(`expected '${filename}' to start with '${root}'`);
  const relativePath = filename.substr(root.length).replace("\\", "/");
  const vars = `
window.modelUrl = ${util.inspect(relativePath)};
window.displayText = ${util.inspect(searchTerm)};
`;

  const filePart = path.relative(path.resolve(downloadFolder), filename);
  const humanReadableSize = filesize(fs.statSync(filename).size);

  const debugInfo = `
<pre>
search: "${searchTerm}"
<a href="/file/${filePart}">${filePart}</a> (${humanReadableSize})
</pre>`;

  const index = indexTemplate
    .replace("//defineVars", vars)
    .replace("<!--debuginfo-->", debugInfo);
  res.send(index);
}

router.get(/\/file\/(.*)/, (req, res) => {
  var param = req.params[0];
  var searchTerm = path.basename(param, path.extname(param));
  var filename = path.resolve(downloadFolder, param);
  handleFile(req, res, { searchTerm, filename });
});

function showViewerForSearchTerm(searchTerm, req, res) {
  modelTools.getModel(searchTerm, function(err, filename) {
    if (err) {
      console.error(err.stack);
      res.status(500).send(util.format("<pre>%s</pre>", err.stack));
    } else {
      handleFile(req, res, { filename, searchTerm });
    }
  });
}

router.get("/random", (req, res) => {
  const searchTerm = generate.randomThing();
  showViewerForSearchTerm(searchTerm, req, res);
});

router.get("/model/:searchTerm", (req, res) => {
  const searchTerm = req.params.searchTerm;
  if (!searchTerm) throw new Error("must specify a search term");

  showViewerForSearchTerm(searchTerm, req, res);
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
