const fs = require("fs");
const child_process = require("child_process");
const path = require("path");
const turbosquid = require("./turbosquid");
const assert = require("assert");

const ASSIMP_EXEC = require("../.localconfig.json").assimp2json.win;
if (!ASSIMP_EXEC) throw new Error("Must set ASSIMP_EXEC in .localconfig.json");

const loaders = ['obj'];

function replaceExtension(filename, newExt) {
    const dirname = path.dirname(filename);
    const ext = path.extname(filename);
    return path.join(dirname, path.basename(filename, ext) + "." + newExt);
}

assert.equal(replaceExtension("baz/foo.bar", "meep"), path.join("baz", "foo.meep"));

module.exports.getModel = function getModel(searchTerm, cb)
{
    turbosquid.download(searchTerm, function(err, filename) {
        if (err) return cb(err);
        afterDownload(filename, cb);
    });
};

function isModelFile(file) {
    for (const ext of turbosquid.allowedFormats)
        if (file.toLowerCase().endsWith(ext))
            return true;
    return false;
}

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
        if (file.endsWith('.fbx'))
        {
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

/*
function mkdirs(targetDir)
{
    const fs = require('fs');
    const path = require('path');
    const sep = path.sep;
    const initDir = path.isAbsolute(targetDir) ? sep : '';
    targetDir.split(sep).reduce((parentDir, childDir) => {
        const curDir = path.resolve(parentDir, childDir);
        if (!fs.existsSync(curDir))
            fs.mkdirSync(curDir);
        return curDir;
    }, initDir);
}
*/

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

    /*
    if (nameLower.endsWith(".zip")) {
        console.log("unzipping", name);
        fs.createReadStream(name)
            .pipe(unzip.Parse())
            .on('entry', function (entry) {
                if (entry.type !== "File")
                    return entry.autodrain();

                //console.log(util.inspect(entry));
                const fileName = entry.path;
                const absPath = path.resolve(extractTo, fileName);
                const dirname = path.dirname(absPath);
                mkdirs(dirname);
                const stat = fs.lstatSync(dirname);
                if (!stat.isDirectory())
                    return cb(new Error("expected a directory, but something else: " + dirname));
                const writePipe = fs.createWriteStream(absPath);
                entry.pipe(writePipe);
                results.push(absPath);
            })
            .on('close', function() {
                cb(null, results);
            });
    }
    else if (nameLower.endsWith(".rar")) {
        child_process.execFile("unrar", ['x', '-y', '-r', name], function(err, stdout, stderr) {
            for (let line of stdout.split("\n")) {
                line = line.replace('\r', '').replace('\n', '');
                if (line.startsWith("Extracting from") || line.length === 0)
                    continue;
                if (!line.startsWith("Extracting"))
                    continue;
                console.log(line);
                const match = line.match(/Extracting\s(.*)\sOK/);
                if (!match)
                    return cb(new Error("no match for " + line));
                console.log(match[1]);

            }
            console.error("----stderr----");
            console.error(stderr);
            console.error("----endstderr----");
        });
        */
    /*
unrar x -y -r - .downloaded\370zfbx.rar
        const extractor = unrar.createExtractorFromFile(name, extractTo);
        const list = extractor.getFileList();
        const results = [];
        if (list[0].state !== "SUCCESS")
            return cb(new Error(list[0].state));

        for (const {name} of list[1].fileHeaders)
            if (isModelFile(name))
                results.push(path.resolve(extractTo, name));

        const list2 = extractor.extractAll();
        if (list2[0].state !== "SUCCESS")
            return cb(new Error(list2[0].state));

        for (const file of list2[1].files)
        {
            const name = file.fileHeader.name;
            const extract = file.extract[1];
            console.log(name, extract);
        }

        cb(null, results);
        */

    /*
        new unrar(name).extract(extractTo, null, function(err, res) {
            if (err)
                return cb(err);
            console.log("UNRAR RESULTS", res);
            cb(null, res);
        });
        */
    /*
        console.log(`unrar-ing ${name} to ${extractTo}`);
        unrar.extract(name, {dest: extractTo}).then(({_name, files}) => {
            for (const filename of files)
                console.log(`  file: ${filename}`);
            cb(null, files);
        }).catch((err) => {
            cb(err);
        });
        */
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
