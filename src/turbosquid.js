const cheerio = require("cheerio");
const path = require("path");
const request = require("request").defaults({jar: true});
const util = require("util");
const fs = require("fs");
const {allowedFormats} = require("./common");

const DOMAIN = "https://www.turbosquid.com/";
const LOGIN_URL = DOMAIN + "Login/Index.cfm";
const SEARCH_URL = DOMAIN + "3d-model/%s?max_price=0&min_price=0";
const DOWNLOAD_URL = DOMAIN + "AssetManager/Index.cfm?stgAction=getFiles&subAction=Download&intID=%s&intType=3";
const FILE_URL = "https://storage9.turbosquid.com/Download/index.php?ID=%s_%s";

function ensureLoggedIn(cb) {
    if (!process.env.TURBOSQUID_USERNAME || !process.env.TURBOSQUID_PASSWORD)
        throw new Error("must set TURBOSQUID_USERNAME and TURBOSQUID_PASSWORD in env");

    request(LOGIN_URL, function(err, response, html) {
        if (err) throw err;

        const $ = cheerio.load(html);
        const formData = $("form#formLogin").serializeArray();

        const formInput = {};
        for (const {name, value} of formData)
            formInput[name] = value;
        formInput["LoginUsername"] = process.env.TURBOSQUID_USERNAME;
        formInput["LoginPassword"] = process.env.TURBOSQUID_PASSWORD;

        request.post({
            url: LOGIN_URL,
            form: formInput,
        }, function (err, _response, _body) {
            if (err) throw err;
            cb();
        });
    });
}

function followRedirect(_resp) {
    //console.log("REDIRECT", resp);
    return true;
}

function download(term, cb) {
    ensureLoggedIn(function() {
        const searchUrl = util.format(SEARCH_URL, term);
        console.log("opening " + searchUrl);
        request({url: searchUrl, followRedirect}, function (err, response, html) {
            fs.writeFileSync("output.html", html);
            if (err) return cb(err);
            if (html.indexOf("Sorry, no results were found for your search.") !== -1)
                return cb(new Error(`no turbosquid results for ${term}`));
            const $ = cheerio.load(html);
            let idStr;
            if ($("body").attr("id") === "FullPreview")
            {
                const productId = $("#ProductID");
                console.log("product", productId);
                idStr = productId.text();
                console.log("!", idStr);
                if (!idStr)
                    return cb(new Error("expected td#ProductId"));
            }
            else
            {
                const resultDivs = $("#SearchResultAssets > div").filter((_idx, el) => {
                    // peek at this model's available file formats and discard
                    // it if we don't know any of them
                    const formats = $(el).find(".formatInfo").text().split(" ").map((s) => s.trim());
                    for (const f of formats)
                        if (allowedFormats.indexOf(f) !== -1)
                            return true;
                    return false;
                });
                const nth = Math.floor(Math.random() * resultDivs.length);
                const randomResult = resultDivs[nth];
                console.log(`picked result ${nth} from ${resultDivs.length}`);
                idStr = randomResult.attribs.id;
                if (!idStr || idStr.substr(0, 5) !== "Asset")
                    return cb(new Error("expected id to be AssetXXX:\n\n" + util.inspect(randomResult)));
                idStr = idStr.substr(5);
            }
            const id = parseInt(idStr, 10);
            if (isNaN(id))
                return cb(new Error("expected a parsable int: " + idStr));

            console.log("randomly selected model id", id);

            const downloadUrl = util.format(DOWNLOAD_URL, id);
            console.log("triggering download url " + downloadUrl);
            request(downloadUrl, function (err, response, html) {
                if (err) {
                    console.error(err);
                    return cb(err);
                }

                console.log("got " + html.length + " bytes response");

                const match = html.match(/purchasedProductFileJSON = (.*);/);
                if (!match)
                    return cb(new Error("no products json in result page"));

                const productJSON = match[1];
                if (!productJSON)
                    return cb(new Error("expected purchasedProductFileJSON in result"));

                const products = JSON.parse(productJSON);
                //console.dir(products);
                //
                let didRequest = false;

                for (const file of products.FILE_SYSTEM) {
                    if (file.PRODUCT_ID === id && file.ISMAINFILE === 1 && file.IS_FILE === 1)
                    {
                        if (allowedFormats.indexOf(file.SHORTFILEFORMAT) === -1)
                            continue;

                        const fileUrl = util.format(FILE_URL, id, file.FILEITEMID);

                        const modelsDirectory = path.resolve(__dirname, "..", ".downloaded");
                        if (!fs.existsSync(modelsDirectory))
                            fs.mkdirSync(modelsDirectory);
                        const name = path.resolve(modelsDirectory, file.NAME);

                        console.log(util.format("downloading %s (%s)", file.NAME, file.SIZE_KB));
                        didRequest = true;
                        request(fileUrl)
                            .on('error', function(err) { return cb(err); })
                            .pipe(fs.createWriteStream(name))
                            .on('finish', function() {
                                cb(null, name);
                            });

                        break;
                    }
                }

                if (!didRequest)
                    return cb(new Error("no matching product_ids:\n\n" + util.inspect(products)));
            });
        });
    });
}

module.exports.download = download;
module.exports.allowedFormats = allowedFormats;
