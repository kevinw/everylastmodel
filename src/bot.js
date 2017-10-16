var twit = require("twit");
var fs = require("fs");
var config = require("../.twitter_secrets.js");
var T = new twit(config);

function tweetImageFile(text, imageFile) {
    var b64content = fs.readFileSync(imageFile, { encoding: 'base64' });

    // first we must post the media to Twitter
    T.post('media/upload', { media_data: b64content }, function (err, data, _response) {
        if (err)
            return console.error(err);
        // now we can assign alt text to the media, for use by screen readers and
        // other text-based presentations and interpreters
        var mediaIdStr = data.media_id_string;
        var altText = "Small flowers in a planter on a sunny balcony, blossoming.";
        var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } };

        T.post('media/metadata/create', meta_params, function (err, _data, _response) {
            if (err)
                console.error(err);
            else {
                // now we can reference the media and post a tweet (media will attach to the tweet)
                var params = { status: text, media_ids: [mediaIdStr] };

                T.post('statuses/update', params, function (err, data, _response) {
                    if (err)
                        console.error(err);
                    else
                        console.log("tweeted " + data.id_str);
                });
            }
        });
    });
}

module.exports.tweetImageFile = tweetImageFile;

if (require.main === module) {
    var imageFile = process.argv[2];
    if (!fs.existsSync(imageFile))
        throw new Error("image not found: " + imageFile);
    tweetImageFile(imageFile);
}
