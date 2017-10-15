var twit = require("twit");
var config = require("../.twitter_secrets.js");
var T = new twit(config);

if (require.main === module) {
    var fs = require("fs");
    var b64content = fs.readFileSync('output.png', { encoding: 'base64' });
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
                var params = { status: 'loving life #nofilter', media_ids: [mediaIdStr] };

                T.post('statuses/update', params, function (err, data, _response) {
                    if (err)
                        console.error(err);
                    else
                        console.log(data);
                });
            }
        });
    });
}
