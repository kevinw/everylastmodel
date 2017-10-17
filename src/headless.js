"use strict";

const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const fs = require("fs");
const path = require("path");
const PNG = require("pngjs").PNG;
const sharp = require("sharp");
const assert = require("assert");
const THREE = require("three");

function loadImage(filename, cb) {
  const image = sharp(filename);
  let metadata;
  image
    .metadata()
    .then(md => {
      metadata = md;
      return image.raw().toBuffer();
    })
    .then(buf => {
      const { width, height, channels } = metadata;
      const expectedLength = width * height * channels;
      assert.equal(buf.length, expectedLength);
      cb(null, { width, height, channels, data: buf });
    })
    .catch(err => cb(err));
}

//const oldLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function load(
  url,
  onLoad,
  onProgress,
  onError
) {
  if (url === undefined) url = "";
  url = this.path + url;
  const scope = this;
  scope.manager.itemStart(url);
  const texture = new THREE.DataTexture(); //data, width, height, format);
  texture.image = { data: null, width: 0, height: 0 };
  loadImage(url, (err, image) => {
    try {
      if (err) {
        if (onError) onError(err);
        else console.error(err.stack);
        scope.manager.itemEnd(url);
        scope.manager.itemError(url);
        return;
      }

      const { data, width, height, channels } = image;
      texture.image = { data, width, height };
      let format = THREE.RGBAFormat;
      if (channels === 3) format = THREE.RGBFormat;
      else if (channels === 4) format = THREE.RGBAFormat;
      else {
        const msg = "unknown number of channels: " + channels;
        console.error(msg);
        if (onError) onError(msg);
        scope.manager.itemEnd(url);
        scope.manager.itemError(url);
        return;
      }
      texture.format = format;
      texture.minFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      if (onLoad) onLoad(texture);
      scope.manager.itemEnd(url);
    } catch (err) {
      console.error(err.stack);
      scope.manager.itemEnd(url);
      scope.manager.itemError(url);
      throw err;
    }
  });
  return texture;
  //return oldLoad.call(this, url, onLoad, onProgress, onError);
};

// hack in FileLoader for nodejs
THREE.FileLoader.prototype.load = function load(
  url,
  onLoad,
  onProgress,
  onError
) {
  if (url === undefined) url = "";
  if (this.path !== undefined) url = this.path + url;
  this.manager.itemStart(url);
  if (url.startsWith("/")) url = url.substr(1);
  if (!fs.existsSync(url)) {
    this.manager.itemEnd(url);
    this.manager.itemError(url);
    throw new Error(url);
  }
  fs.readFile(url, (err, data) => {
    if (err) onError(err);
    else onLoad(data.toString());

    this.manager.itemEnd(url);
    if (err) this.manager.itemError(url);
  });
};

global.window = {
  addEventListener: function() {},
  removeEventListener: function() {},
  isHeadless: true,
  THREE: THREE
};
global.XMLHttpRequest = XMLHttpRequest;
global.THREE = THREE;

require("../js/loaders/OBJLoader.js");
require("../js/loaders/AssimpJSONLoader.js");

const gl = require("headless-gl")(512, 512);
const width = 600;
const height = 400;
const png = new PNG({width: width, height: height});

const scene = new THREE.Scene();

const VIEW_ANGLE = 45;
var camera = new THREE.PerspectiveCamera(VIEW_ANGLE, width / height, 0.1, 100);
scene.add(camera);

camera.position.set(0, 2, 2);
camera.lookAt(scene.position);

const canvas = new Object();
console.assert(gl);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  width: 0,
  height: 0,
  canvas: canvas,
  context: gl
});
renderer.clearColor = new THREE.Color(0, 0, 0, 1);

const rtTexture = new THREE.WebGLRenderTarget(width, height, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.NearestFilter,
  format: THREE.RGBAFormat
});

function filePathToLocalUrl(filename) {
  let relativePath = path.relative(path.resolve(__dirname, ".."), filename);
  relativePath = relativePath.replace("\\", "/");
  return relativePath;
}

const renderModelFile = (module.exports.renderModelFile = function renderModelFile(
  filename,
  outputPath,
  displayText,
  cb
) {
  filename = path.resolve(filename);
  if (!fs.existsSync(filename)) throw new Error("not found: " + filename);

  const outputFile = path.resolve(outputPath);
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) mkdirsSync(outputDir);

  global.window.modelUrl = filePathToLocalUrl(filename);
  global.window.displayText = displayText;

  require("../js/modelviewer").start(renderer, rtTexture, function() {
    var glLocal = renderer.getContext();
    var pixels = new Uint8Array(4 * width * height);

    glLocal.readPixels(
      0,
      0,
      width,
      height,
      glLocal.RGBA,
      glLocal.UNSIGNED_BYTE,
      pixels
    );

    let j, l, i, n, k, ref, ref1;

    for (
      j = l = 0, ref = height;
      0 <= ref ? l < ref : l > ref;
      j = 0 <= ref ? ++l : --l
    ) {
      for (
        i = n = 0, ref1 = width;
        0 <= ref1 ? n < ref1 : n > ref1;
        i = 0 <= ref1 ? ++n : --n
      ) {
        k = j * width + i;
        const r = pixels[4 * k];
        const g = pixels[4 * k + 1];
        const b = pixels[4 * k + 2];
        const a = pixels[4 * k + 3];
        const m = (height - j + 1) * width + i;
        png.data[4 * m] = r;
        png.data[4 * m + 1] = g;
        png.data[4 * m + 2] = b;
        png.data[4 * m + 3] = a;
      }
    }

    const stream = fs.createWriteStream(outputPath);
    png.pack().pipe(stream);
    stream.on("close", function() {
      console.log("Image written: " + outputPath);
      if (cb) cb(null, outputPath);
    });
  });
});

function mkdirsSync(targetDir) {
  const fs = require("fs");
  const path = require("path");
  const sep = path.sep;
  const initDir = path.isAbsolute(targetDir) ? sep : "";
  targetDir.split(sep).reduce((parentDir, childDir) => {
    const curDir = path.resolve(parentDir, childDir);
    if (!fs.existsSync(curDir)) fs.mkdirSync(curDir);
    return curDir;
  }, initDir);
}

if (require.main === module) {
  renderModelFile(process.argv[2], process.argv[3]);
}
