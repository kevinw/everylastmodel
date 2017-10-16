const sharp = require("sharp");
const assert = require("assert");

function loadImage(filename, cb) {
    const image = sharp(filename);
    let metadata;
    image.metadata()
        .then((md) => {
            metadata = md;
            return image.raw().toBuffer();
        })
        .then((buf) => {
            console.log(buf);
            const {width, height, channels} = metadata;
            const expectedLength = width * height * channels;
            assert.equal(buf.length, expectedLength);
            cb(null, {width, height, channels, data: buf});
        })
        .catch((err) => cb(err));
}
