"use strict";

var path = require('path')
var fs = require('fs');
var createContext = require("headless-gl")
var utils = require('./utils')
var PNG = require('pngjs').PNG;

var width = 512;
var height = 512;

function writePNG(gl, path, callback) {
    var png = new PNG({width: width, height: height});
    var data = png.data;
    var pixels = new Uint8Array(4 * width * height);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    // lines are vertically flipped in the FBO / need to unflip them
    var j, l, i, n, ref, ref1;
    for (j = l = 0, ref = height; 0 <= ref ? l < ref : l > ref; j = 0 <= ref ? ++l : --l) {
        for (i = n = 0, ref1 = width; 0 <= ref1 ? n < ref1 : n > ref1; i = 0 <= ref1 ? ++n : --n) {
            var k = j * width + i;
            var r = pixels[4 * k];
            var g = pixels[4 * k + 1];
            var b = pixels[4 * k + 2];
            var a = pixels[4 * k + 3];
            var m = (height - j + 1) * width + i;
            data[4 * m] = r;
            data[4 * m + 1] = g;
            data[4 * m + 2] = b;
            data[4 * m + 3] = a;
        }
    }
    var stream = fs.createWriteStream(path);
    png.pack().pipe(stream);

    stream.on('close', function() {
        console.log("Image written: " + path);
        if (callback)
            callback();
    });
}

var gl = createContext(width, height);

const renderFrame = require("./fractal.js");

renderFrame(gl, function() {
    var filename = path.resolve(__dirname, "../output.png");
    writePNG(gl, filename, function() {
      gl.destroy()
    });
});
