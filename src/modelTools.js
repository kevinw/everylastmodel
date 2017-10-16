const fs = require("fs");
const child_process = require("child_process");
const path = require("path");
const turbosquid = require("./turbosquid");
const assert = require("assert");
const {isModelFile} = require("./common");

const ASSIMP_EXEC = require("../.localconfig.json").assimp2json.win;
if (!ASSIMP_EXEC) throw new Error("Must set ASSIMP_EXEC in .localconfig.json");

const loaders = ['obj'];

function replaceExtension(filename, newExt) {
    const dirname = path.dirname(filename);
    const ext = path.extname(filename);
    return path.join(dirname, path.basename(filename, ext) + "." + newExt);
}

assert.equal(replaceExtension("baz/foo.bar", "meep"), path.join("baz", "foo.meep"));

var getModel = module.exports.getModel = function getModel(searchTerm, cb) {
    turbosquid.download(searchTerm, function(err, filename) {
        if (err) return cb(err);
        afterDownload(filename, cb);
    });
};

function pickModelFile(files) {
    for (const file of files)
        if (isModelFile(file))
            return file;
}

function afterDownload(name, cb) {

    extractModel(name, function(err, files) {
        if (err) return cb(err);

        // pick which file out of the zip to use
        const file = pickModelFile(files);
        if (!file) return cb(new Error("no model found in: " + files.join(", ")));

        // transform the model into our common format
        console.log("found model " + file);

        // just return the original model if it's in a format we can show natively
        for (const loaderExt of loaders)
            if (file.toLowerCase().endsWith(loaderExt))
            {
                console.log("using " + file);
                return cb(null, file);
            }

        // otherwise convert it
        const outputFile = replaceExtension(file, "json");
        console.log("converting to JSON");
        if (file.toLowerCase().endsWith('.fbx'))
        {
            // FBX files need to be upgraded before being passed to assimp2json.
            const upgradedFile = path.join(path.dirname(file), path.basename(file) + "2.fbx");
            child_process.execFile(path.resolve('tools','win','FbxConverter.exe'), [file, upgradedFile], function (err, stdout, stderr) {
                if (err)
                {
                    console.error(stderr);
                    return cb(err);
                }
                console.log(stdout);
                if (!fs.existsSync(upgradedFile))
                    return cb(new Error("expected the fbx converter to make " + upgradedFile));

                doConvert(upgradedFile);

            });
        }
        else
            doConvert(file);


        function doConvert(file) {
            child_process.execFile(ASSIMP_EXEC, [file, outputFile], function(err, stdout, stderr) {
                if (err) {
                    console.error(stderr);
                    return cb(err);
                }
                console.log("wrote " + outputFile);
                return cb(null, outputFile);
            });
        }
    });
}

function isArchive(filename) {
    const f = filename.toLowerCase();
    for (const ext of [".zip", ".rar", ".7z"])
        if (f.endsWith(ext))
            return true;
    return false;
}

function extractModel(name, cb) {
    if (!fs.existsSync(name))
        return cb(new Error("extractModel give " + name + " but it doesn't exist on disk"));

    const extractTo = path.dirname(name);

    if (!isArchive(name))
        return cb(null, [name]);

    const Zip = require("node-7z");
    const task = new Zip();
    const results = [];
    task.list(name)
        .progress(function(files) {
            for (const {name} of files)
                results.push(path.resolve(extractTo, name));
        })
        .then(function() {
            task.extractFull(name, extractTo).then(function() {
                console.log("done");
                cb(null, results);
            })
                .catch(err => cb(err));
        }).catch(err => cb(err));
}

if (require.main === module) {
    var verb = process.argv[2];
    if (verb === "file")
    {
        const file = path.resolve(process.argv[3]);
        if (!fs.existsSync(file))
            throw new Error("file not found: " + file);
        afterDownload(file, function(err, res) {
            if (err) console.error(err.stack);
            console.log(res);
        });
    } else if (verb === "search") {
        const term = process.argv[3];
        getModel(term, function(err, result) {
            if (err) { console.error(err); console.error(err.stack); } 
            else {
                console.log(result);
                process.exit(0);
            }
        });
    }
}
