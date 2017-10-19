const cheerio = require("cheerio");
const path = require("path");
const request = require("request").defaults({ jar: true });
const util = require("util");
const fs = require("fs");
const { allowedFormats, downloadFolder } = require("./common");

const { URL } = require('url');

const DOMAIN = "https://www.turbosquid.com/";
const LOGIN_URL = DOMAIN + "Login/Index.cfm";
const SEARCH_URL = DOMAIN + "3d-model/%s?max_price=0&min_price=0";
const DOWNLOAD_URL =
  DOMAIN +
  "AssetManager/Index.cfm?stgAction=getFiles&subAction=Download&intID=%s&intType=3";
const FILE_URL = "https://storage9.turbosquid.com/Download/index.php?ID=%s_%s";

function getLoginInfo() {
  let username = process.env.TURBOSQUID_USERNAME;
  let password = process.env.TURBOSQUID_PASSWORD;
  if (!username || !password)
  {
    const configFile = path.resolve("modelsLogin.json");
    if (!fs.existsSync(configFile))
      fs.writeFileSync(configFile, JSON.stringify({turbosquid: {username: "USERNAME", password: "PASSWORD"}}, null, 4));

    const json = fs.readFileSync(configFile);
    let config;
    try {
      config = JSON.parse(json);
    } catch (e) {
      console.error(`invalid json in ${configFile}`);
    }

    if (!config || !config.turbosquid || config.turbosquid.username === "USERNAME" || !config.turbosquid.username)
    {
      console.error(`Error: No turbosquid login found. Please set your username and password in ${configFile}.`);
      process.exit(1);
    }

    username = config.turbosquid.username;
    password = config.turbosquid.password;
  }

  return {username, password};
}

function ensureLoggedIn(cb) {
  const {username, password} = getLoginInfo();
  request(LOGIN_URL, function(err, response, html) {
    if (err)
      return cb(err);

    const $ = cheerio.load(html);
    const formData = $("form#formLogin").serializeArray();
    const formInput = {};
    for (const { name, value } of formData) formInput[name] = value;
    formInput["LoginUsername"] = username;
    formInput["LoginPassword"] = password;

    request.post(
      {
        url: LOGIN_URL,
        form: formInput
      },
      function(err, _response, _body) {
        if (err) return cb(err);
        //const numLoginForms = $("#PageBody #LoginForm").length;
        if (_body.indexOf("Wrong Password or Member Name") !== -1)// || numLoginForms > 0)
          return cb(new Error("invalid username or password"));
        cb();
      }
    );
  });
}

function followRedirect(_resp) {
  //
  // HACK:
  //
  // there's a bug where turbosquid redirects you to a broken url with two ?s
  // -- and you lose the fact that you're searching for free assets. this fixes
  // up the url in the middle of the redirect.
  //
  this.once("redirect", () => {
    const redirectUrl = this.uri.href;
    if (redirectUrl.indexOf("?synonym") !== -1 &&
      redirectUrl.indexOf("?") !== redirectUrl.lastIndexOf("?"))
    {
      const index = redirectUrl.lastIndexOf("?");
      const fixedUrl = redirectUrl.substr(0, index) + '&' + redirectUrl.substr(index + 1);
      this.uri = new URL(fixedUrl);
    }
  });

  return true;
}

const alreadyDownloadedIds = {};

function download(term, cb) {
  ensureLoggedIn(function(err) {
    if (err)
      return cb(err);
    const searchUrl = util.format(SEARCH_URL, term);
    //console.log("opening " + searchUrl);
    request({ url: searchUrl, followRedirect }, function(err, response, html) {
      //console.log("!!!");
      //console.log(response);
      fs.writeFileSync("output.html", html);
      if (err) return cb(err);
      if (html.indexOf("Sorry, no results were found for your search.") !== -1)
        return cb(new Error(`no turbosquid results for ${term}`));
      const $ = cheerio.load(html);
      let idStr;
      let modelCanonicalUrl;


      if ($("body").attr("id") === "FullPreview") {
        const productId = $("#ProductID");
        idStr = productId.text();
        modelCanonicalUrl = response.request.href; // TODO: not sure if this is correct.
        if (!idStr) return cb(new Error("expected td#ProductId"));
      } else {
        const parseDivId = (el) => {
          const idStr = el.attribs.id;
          if (idStr && idStr.substr(0, 5) === "Asset")
            return idStr.substr(5);
        };
        const resultDivs = $("#SearchResultAssets > div").filter((_idx, el) => {
          // peek at this model's available file formats and discard
          // it if we don't know any of them
          const formats = $(el)
            .find(".formatInfo")
            .text()
            .split(" ")
            .map(s => s.trim());
          modelCanonicalUrl = $(el).find("a").attr("href");
          const idStr = parseDivId(el);
          if (!idStr || alreadyDownloadedIds[idStr])
            return false;
          for (const f of formats)
            if (allowedFormats.indexOf(f) !== -1) return true;
          return false;
        });
        const nth = Math.floor(Math.random() * resultDivs.length);
        const randomResult = resultDivs[nth];
        idStr = parseDivId(randomResult);
        if (!idStr)
          return cb(new Error("expected id to be AssetXXX:\n\n" + util.inspect(randomResult)));
      }
      const id = parseInt(idStr, 10);
      if (isNaN(id)) return cb(new Error("expected a parsable int: " + idStr));

      //console.log("randomly selected model id", id);

      alreadyDownloadedIds[id] = true;
      const downloadUrl = util.format(DOWNLOAD_URL, id);
      //console.log(downloadUrl);
      //console.log("triggering download url " + downloadUrl);
      //console.log("id", id);
      //console.log("download url", downloadUrl);
      request(downloadUrl, function(err, response, html) {
        if (err) {
          console.error(err);
          return cb(err);
        }

        //console.log("got " + html.length + " bytes response");

        const match = html.match(/purchasedProductFileJSON = (.*);/);
        if (!match) return cb(new Error("no products json in result page"));

        const productJSON = match[1];
        if (!productJSON)
          return cb(new Error("expected purchasedProductFileJSON in result"));

        const products = JSON.parse(productJSON);
        //console.dir(products);
        //
        let didRequest = false;

        for (const file of products.FILE_SYSTEM) {
          if (
            file.PRODUCT_ID === id &&
            file.ISMAINFILE === 1 &&
            file.IS_FILE === 1
          ) {
            if (allowedFormats.indexOf(file.SHORTFILEFORMAT) === -1) continue;

            const fileUrl = util.format(FILE_URL, id, file.FILEITEMID);

            const modelsDirectory = path.resolve(process.cwd(), downloadFolder);
            if (!fs.existsSync(modelsDirectory)) fs.mkdirSync(modelsDirectory);
            const name = path.resolve(modelsDirectory, file.NAME);

            console.log(
              util.format("downloading %s (%s)", file.NAME, file.SIZE_KB)
            );
            didRequest = true;
            request(fileUrl)
              .on("error", function(err) {
                return cb(err);
              })
              .pipe(fs.createWriteStream(name))
              .on("finish", function() {
                cb(null, {filename: name, url: modelCanonicalUrl});
              });

            break;
          }
        }

        if (!didRequest)
          return cb(
            new Error("no matching product_ids:\n\n" + util.inspect(products))
          );
      });
    });
  });
}

module.exports.download = download;
module.exports.allowedFormats = allowedFormats;
