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

const {downloadFolder, canShowFormats} = require("./common");

const read = (dir) =>
  fs.readdirSync(dir)
    .reduce((files, file) =>
      fs.statSync(path.join(dir, file)).isDirectory() ?
        files.concat(read(path.join(dir, file))) :
        files.concat(path.join(dir, file)),
    []);


const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const getRandomShowableFile = () => {
  return pickRandom(read(downloadFolder).filter((f) => {
    for (const canshow of canShowFormats)
      if (f.endsWith("." + canshow))
        return true;
    return false;
  }));
};

function handleFile(req, res, { filename, searchTerm, url }) {
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
<a href="${url}">turbosquid url</a>
</pre>`;

  const index = indexTemplate
    .replace("//defineVars", vars)
    .replace("<!--debuginfo-->", debugInfo);
  res.send(index);
}

router.get("/file/random", (req, res) => {
  const filename = path.resolve(getRandomShowableFile());
  var searchTerm = path.basename(filename, path.extname(filename));
  handleFile(req, res, {searchTerm, filename, url: ""});
});

router.get(/\/file\/(.*)/, (req, res) => {
  var param = req.params[0];
  var searchTerm = path.basename(param, path.extname(param));
  var filename = path.resolve(downloadFolder, param);
  handleFile(req, res, { searchTerm, filename, url: "" });
});

function showViewerForSearchTerm(searchTerm, req, res) {
  modelTools.getModel(searchTerm, function(err, {filename, url}) {
    if (err) {
      console.error(err.stack);
      res.status(500).send(util.format("<pre>%s</pre>", err.stack));
    } else {
      handleFile(req, res, { filename, searchTerm, url });
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
