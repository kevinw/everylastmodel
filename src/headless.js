"use strict";

var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var fs = require('fs');
var path = require("path");

console.assert(XMLHttpRequest);

var THREE = require('three');

// hack in FileLoader for nodejs
THREE.FileLoader.prototype.load = (url, onLoad, onProgress, onError) => {
    if ( url === undefined ) url = '';
    if ( this.path !== undefined ) url = this.path + url;
    if (url.startsWith("/"))
        url = url.substr(1);
    if (!fs.existsSync(url))
        throw new Error(url);
    fs.readFile(url, (err, data) => {
        if (err) onError(err);
        else onLoad(data.toString());
    });
};

global.window = {
    addEventListener: function() {},
    removeEventListener: function() {},
    isHeadless: true,
};
global.XMLHttpRequest = XMLHttpRequest;


global.window.THREE = THREE;
global.THREE = THREE;

require("../js/loaders/OBJLoader.js");
require("../js/loaders/AssimpJSONLoader.js");

var PNG = require('pngjs').PNG;
var gl = require("headless-gl")(512, 512);
var width = 600;
var height = 400;
var png = new PNG({width: width, height: height});

var scene = new THREE.Scene();

var VIEW_ANGLE = 45;
var camera = new THREE.PerspectiveCamera(VIEW_ANGLE, width / height, 0.1, 100);
scene.add(camera);

camera.position.set(0, 2, 2);

camera.lookAt(scene.position);

var canvas = new Object();

console.assert(gl);

var renderer = new THREE.WebGLRenderer({
    antialias: true,
    width: 0,
    height: 0,
    canvas: canvas,
    context: gl
});
renderer.clearColor = new THREE.Color(0, 0, 0, 1);

var rtTexture = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat
});

function filePathToLocalUrl(filename) {
    let relativePath = path.relative(path.resolve(__dirname, ".."), filename);
    relativePath = relativePath.replace("\\", "/");
    return relativePath;
}

const renderModelFile = module.exports.renderModelFile = function renderModelFile(filename, outputPath, displayText, cb) {
    filename = path.resolve(filename);
    if (!fs.existsSync(filename))
        throw new Error("not found: " + filename);

    const outputFile = path.resolve(outputPath);
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir))
        mkdirsSync(outputDir);

    global.window.modelUrl = filePathToLocalUrl(filename);
    global.window.displayText = displayText;

    require("../js/modelviewer").start(renderer, rtTexture, function() {
        console.log("in callback");

        var glLocal = renderer.getContext();
        var pixels = new Uint8Array(4 * width * height);

        glLocal.readPixels(0, 0, width, height, glLocal.RGBA, glLocal.UNSIGNED_BYTE, pixels);

        var j, l, i, n, k, ref, ref1;

        for (j = l = 0, ref = height; 0 <= ref ? l < ref : l > ref; j = 0 <= ref ? ++l : --l) {
            for (i = n = 0, ref1 = width; 0 <= ref1 ? n < ref1 : n > ref1; i = 0 <= ref1 ? ++n : --n) {
                k = j * width + i;
                var r = pixels[4 * k];
                var g = pixels[4 * k + 1];
                var b = pixels[4 * k + 2];
                var a = pixels[4 * k + 3];
                var m = (height - j + 1) * width + i;
                png.data[4 * m] = r;
                png.data[4 * m + 1] = g;
                png.data[4 * m + 2] = b;
                png.data[4 * m + 3] = a;
            }
        }

        const stream = fs.createWriteStream(outputPath);
        png.pack().pipe(stream);
        stream.on('close', function() {
            console.log("Image written: " + outputPath);
            if (cb) cb(null, outputPath);
        });

    });
};

function mkdirsSync(targetDir)
{
    const fs = require('fs');
    const path = require('path');
    const sep = path.sep;
    const initDir = path.isAbsolute(targetDir) ? sep : '';
    targetDir.split(sep).reduce((parentDir, childDir) => {
        const curDir = path.resolve(parentDir, childDir);
        if (!fs.existsSync(curDir))
            fs.mkdirSync(curDir);
        return curDir;
    }, initDir);
}

if (require.main === module) {
    renderModelFile(process.argv[2], process.argv[3]);
}
