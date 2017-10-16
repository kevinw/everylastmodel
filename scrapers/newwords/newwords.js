const Crawler = require("crawler");
const fs = require("fs");
const path = require("path");

const ROOT = "http://nws.merriam-webster.com/opendictionary/newword_display_recent.php";
const outputStream = fs.createWriteStream(path.resolve(__dirname, "words.txt"));

let count = 0;

const c = new Crawler({
    maxConnections : 10,
    callback : function (error, res, done) {
        if (error) {
            console.log(error);
            return;
        }

        const $ = res.$;
        var oldCount = count;
        $(".nws_headword").each(function(e, el) {
            const word = $(el).text();
            console.log(word);
            ++count;
            outputStream.write(word + "\n");
        });
        if (oldCount !== count)
            c.queue(ROOT + "?last=" + count);

        done();
    }
});

c.queue(ROOT);
