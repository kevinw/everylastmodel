const downloadFolder = "downloaded";

const allowedFormats = [
  "fbx",
  "dae",
  "gltf",
  "glb",
  "blend",
  "3ds",
  "ase",
  "obj",
  "ifc",
  "xgl",
  "zgl",
  "ply",
  "dxf",
  "lwo",
  "lws",
  "lxo",
  "stl",
  "x",
  "ac",
  "ms3d",
  "cob",
  "scn",
  "ogex",
  "x3d",
  "3mf",
  "bvh",
  "csm",
  "xml",
  "irrmesh",
  "irr",
  "mdl",
  "md2",
  "md3",
  "pk3",
  "mdc",
  "md5",
  "smd",
  "vta",
  "ogex",
  "3d",
  "b3d",
  "q3d",
  "q3s",
  "nff",
  "nff",
  "off",
  "raw",
  "ter",
  "mdl",
  "hmp",
  "ndo"
];

function isModelFile(file) {
  const fileLower = file.toLowerCase();

  for (const ext of allowedFormats) if (fileLower.endsWith(ext)) return true;

  return false;
}

module.exports.allowedFormats = allowedFormats;
module.exports.isModelFile = isModelFile;
module.exports.downloadFolder = downloadFolder;
