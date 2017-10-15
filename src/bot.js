var twit = require("twit");
var config = require("../.twitter_secrets.js");
var T = new twit(config);
T.post('statuses/update', { status: 'hello world!' }, function(err, data, _response) {
    console.log(data);
});
