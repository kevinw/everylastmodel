const fs = require("fs");
const child_process = require("child_process");
const path = require("path");
const turbosquid = require("./turbosquid");
const unzip = require("unzip");
const assert = require("assert");

function replaceExtension(filename, newExt) {
    const dirname = path.dirname(filename);
    const ext = path.extname(filename);
    return path.join(dirname, path.basename(filename, ext) + "." + newExt);
}

assert.equal(replaceExtension("baz/foo.bar", "meep"), path.join("baz", "foo.meep"));

function getModel(searchTerm, cb)
{
    turboSquid.download(searchTerm, function(err, filename) {
        if (err) return cb(err);
        afterDownload(filename, cb);
    });
}

function pickModelFile(files) {
    for (const file of files) {
        for (const ext of turbosquid.allowedFormats) {
            if (file.toLowerCase().endsWith(ext)) {
                return file;
            }
        }
    }
}

function afterDownload(name, cb) {
    const ASSIMP_EXEC = process.env.ASSIMP_EXEC;
    if (!ASSIMP_EXEC) return cb(new Error("Must set ASSIMP_EXEC in env"));

    extractModel(name, function(err, files) {
        if (err) return cb(err);

        // pick which file out of the zip to use
        const file = pickModelFile(files);
        if (!file) return cb(new Error("no model found in: " + files.join(", ")));

        // transform the model into our common format
        console.log("found model " + file);
        const outputFile = replaceExtension(file, "json");
        child_process.execFile(ASSIMP_EXEC, [file, outputFile], function(err, stdout, stderr) {
            if (err) {
                console.error(stderr);
                return cb(err);
            }
            return cb(null, outputFile);
        });
    });
}


function extractModel(name, cb) {
    if (!fs.existsSync(name))
        return cb(new Error("extractModel give " + name + " but it doesn't exist on disk"));
    const nameLower = name.toLowerCase();
    const extractTo = path.dirname(name);
    const results = [];
    if (nameLower.endsWith(".zip")) {
        console.log("unzipping", name);
        fs.createReadStream(name)
            .pipe(unzip.Parse())
            .on('entry', function (entry) {
                const fileName = entry.path;
                const absPath = path.resolve(extractTo, fileName);
                results.push(absPath);
                entry.pipe(fs.createWriteStream(absPath));
            })
            .on('close', function() {
                cb(null, results);
            });
    }
    else
        cb(null, [name]);
}

if (require.main === module) {
    const file = path.resolve(process.argv[2]);
    if (!fs.existsSync(file))
        throw new Error("file not found: " + file);
    afterDownload(file, function(err, res) {
        if (err) console.error(err.stack);
        console.log(res);
    });
}
