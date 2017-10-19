"use strict";

const text = window.displayText || "Foobar";
var MODEL_URL = window.modelUrl || "/.downloaded/cartDog.obj";

// HACK: goes away once webpack builds this file
const THREE = window.THREE || {};

let textGeo;
let textMesh1, textMesh2;

function loadFont() {
  const loader = new THREE.FontLoader();
  loader.load(
    "/fonts/" + fontName + "_" + fontWeight + ".typeface.json",
    function(response) {
      font = response;
      refreshText();
    }
  );
}

function refreshText() {
  textGroup.remove(textMesh1);
  if (mirror) textGroup.remove(textMesh2);
  if (!text) return;
  createText();
}

function createText() {
  textGeo = new THREE.TextBufferGeometry(text, {
    font: font,
    size: size,
    height: height,
    curveSegments: curveSegments,
    bevelThickness: bevelThickness,
    bevelSize: bevelSize,
    bevelEnabled: bevelEnabled,
    material: 0,
    extrudeMaterial: 1
  });

  textGeo.computeBoundingBox();
  textGeo.computeVertexNormals();

  // "fix" side normals by removing z-component of normals for side faces
  // (this doesn't work well for beveled geometry as then we lose nice curvature around z-axis)

  if (!bevelEnabled) {
    const triangleAreaHeuristics = 0.1 * (height * size);
    for (var i = 0; i < textGeo.faces.length; i++) {
      const face = textGeo.faces[i];
      if (face.materialIndex === 1) {
        for (var j = 0; j < face.vertexNormals.length; j++) {
          face.vertexNormals[j].z = 0;
          face.vertexNormals[j].normalize();
        }

        var va = textGeo.vertices[face.a];
        var vb = textGeo.vertices[face.b];
        var vc = textGeo.vertices[face.c];

        var s = THREE.GeometryUtils.triangleArea(va, vb, vc);

        if (s > triangleAreaHeuristics) {
          for (var k = 0; k < face.vertexNormals.length; k++)
            face.vertexNormals[k].copy(face.normal);
        }
      }
    }
  }

  const centerOffset =
    -0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x);

  textMesh1 = new THREE.Mesh(textGeo, materials);

  textMesh1.position.x = centerOffset;
  textMesh1.position.y = hover;
  textMesh1.position.z = 0;

  textMesh1.rotation.x = 0;
  textMesh1.rotation.y = Math.PI * 2;

  textMesh1.rotation.x = Math.random() * 0.3;
  textMesh1.rotation.z = Math.random() * 0.3;

  textGroup.add(textMesh1);

  if (mirror) {
    textMesh2 = new THREE.Mesh(textGeo, materials);
    textMesh2.position.set(centerOffset, -hover, height);
    textMesh2.rotation.x = Math.PI;
    textMesh2.rotation.y = Math.PI * 2;
    textGroup.add(textMesh2);
  }
}

const F = 4;
const w = 400 * F;
const h = 400 * F;

const scene = new THREE.Scene();
let camera;

const skyColor = new THREE.Color();
const groundColor = new THREE.Color();
skyColor.setHSL(Math.random(), 1 - Math.random() * 0.2, 0.5);
groundColor.setHSL(Math.random(), 1 - Math.random() * 0.2, 0.5);

const light = new THREE.HemisphereLight(skyColor, groundColor, 0.7);
scene.add(light);

const intensity = 0.3;
const directionalLight = new THREE.DirectionalLight(0xffffff, intensity);
directionalLight.position.set(3, 1, 3);
directionalLight.rotation.set(0.3, 0.4, 0);
scene.add(directionalLight);

var height = 20,
  size = 70,
  hover = 30,
  curveSegments = 4,
  bevelThickness = 2,
  bevelSize = 1.5,
  //bevelSegments = 3,
  bevelEnabled = true,
  font = undefined,
  fontName = "optimer", // helvetiker, optimer, gentilis, droid sans, droid serif
  fontWeight = "bold"; // normal bold

const materials = [
  new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true }), // front
  new THREE.MeshPhongMaterial({ color: 0xffffff }) // side
];

const textGroup = new THREE.Group();
textGroup.position.y = 0;
loadFont();

const mirror = false;

const fontMap = {
  helvetiker: 0,
  optimer: 1,
  gentilis: 2,
  "droid/droid_sans": 3,
  "droid/droid_serif": 4
};

const weightMap = {
  regular: 0,
  bold: 1
};

const reverseFontMap = [];
const reverseWeightMap = [];

for (const i in fontMap) reverseFontMap[fontMap[i]] = i;
for (const i in weightMap) reverseWeightMap[weightMap[i]] = i;

function measureSize(obj) {
  return new THREE.Box3().setFromObject(obj).getSize();
}

function getBoundingBox(obj) {
  if (!obj || !obj.geometry || !obj.geometry.computeBoundingBox)
    return;
  if (!obj.geometry.boundingBox)
    obj.geometry.computeBoundingBox();
  return obj.geometry.boundingBox;
}

function fitCameraToObj(camera, obj) {
  // fit camera to object
  const size = measureSize(obj);
  const height = Math.max(Math.max(size.y, size.x), size.z) * 0.9;
  const dist = height / (2 * Math.tan(camera.fov * Math.PI / 360));

  const objCenter = getObject3DCenter(obj);

  const newCenter = getObject3DCenter(obj);
  console.log("old", objCenter);
  console.log("new", newCenter);

  sortComponents(size);
  const camPos = getMajorAxis(size);
  camPos.multiplyScalar(dist*1.3);
  camera.position.copy(camPos);

  const extra = new THREE.Vector3().copy(objCenter).divideScalar(2);
  camera.position.add(extra);

  {
    obj.traverse((mesh) => {
      const box = getBoundingBox(mesh);
      if (!box) return;
      const size = box.getSize();
      const center = mesh.geometry.boundingBox.getCenter();
      mesh.localToWorld(center);
      const material = new THREE.MeshBasicMaterial( {color: Math.random() * 0xffffff, transparent: true, opacity: .4, side: THREE.DoubleSide} );
      {
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const cube = new THREE.Mesh(geometry, material);
        cube.position.copy(center);
        scene.add(cube);
      }
    });
  }

  camera.lookAt(objCenter);

  return size;
}

/*
function getCenterPoint(mesh) {
  const center = getBoundingBox(mesh).getCenter();
  mesh.localToWorld(center);
  return center;
}
*/

function getObject3DCenter(obj3d) {
  return new THREE.Box3().expandByObject(obj3d).getCenter();
}

/*
function getObject3DCenterOld(obj3d) {
  const center = new THREE.Vector3();
  let length = 0;
  obj3d.traverse(function(o) {
    if (o.geometry) {
      center.add(getCenterPoint(o));
      length++;
    }
  });
  center.divideScalar(length);
  return center;
}
*/

let renderer;

function loadAnyModel(path, cb) {
  var loader;
  if (path.toLowerCase().endsWith(".obj")) loader = new THREE.OBJLoader();
  else loader = new THREE.AssimpJSONLoader();

  function err(e) {
    console.log("Loader failed", e);
    console.dir(e);
  }

  loader.load(path, cb, null, err);
}

/*
function fitAll(root) {
  const geos = [];
  root.traverse((o) => {
    if (o.geometry)
      geos.push(o.geometry);
  });

  // Compute world AABB and radius (approx: better compute BB be in camera space)
  var aabbMin = new THREE.Vector3();
  var aabbMax = new THREE.Vector3();
  for (const geo of geos) {
    const box = getBoundingBox(geo);
    aabbMin.x = Math.min(aabbMin.x, box.min.x);
    aabbMin.y = Math.min(aabbMin.y, box.min.y);
    aabbMin.z = Math.min(aabbMin.z, box.min.z);
    aabbMax.x = Math.max(aabbMax.x, box.max.x);
    aabbMax.y = Math.max(aabbMax.y, box.max.y);
    aabbMax.z = Math.max(aabbMax.z, box.max.z);
  }

  // Compute world AABB center
  var aabbCenter = new THREE.Vector3();
  aabbCenter.x = (aabbMax.x + aabbMin.x) * 0.5;
  aabbCenter.y = (aabbMax.y + aabbMin.y) * 0.5;
  aabbCenter.z = (aabbMax.z + aabbMin.z) * 0.5;

  // Compute world AABB "radius" (approx: better if BB height)
  var diag = new THREE.Vector3();
  diag = diag.subVectors(aabbMax, aabbMin);
  const radius = diag.length() * 0.5;

  // Compute offset needed to move the camera back that much needed to center AABB (approx: better if from BB front face)
  const offset = radius / Math.tan(Math.PI / 180.0 * camera.fov * 0.5);

  // Compute new camera position
  const dir = new THREE.Vector3(
    camera.matrix.elements[8],
    camera.matrix.elements[9],
    camera.matrix.elements[10]);
  dir.multiplyScalar(offset);
  const newPos = new THREE.Vector3();
  newPos.addVectors(aabbCenter, dir);

  // Update camera (ugly hack to reset THREE.TrackballControls)
  camera.position.set(newPos.x, newPos.y, newPos.z);
  camera.lookAt(aabbCenter);

  return aabbCenter;
}
*/

function sortComponents(v) {
  const x = [v.x, 'x'];
  const y = [v.y, 'y'];
  const z = [v.z, 'z'];

  const els = [x, y, z];
  els.sort();
  els.reverse();
  return els;
}

function getMajorAxis(v) {
  const els = sortComponents(v);
  const axis = els[0][1];
  if (axis === 'x') return new THREE.Vector3(1, 0, 0);
  if (axis === 'y') return new THREE.Vector3(0, 1, 0);
  if (axis === 'z') return new THREE.Vector3(0, 0, 1);
  throw new Error(axis);
}

function getBiggest(x, y, z) {
  const v = new THREE.Vector3(x, y, z);
  const component = sortComponents(v)[0][1];
  return component;
}

console.assert(getBiggest(0, 0, 1) === 'z');
console.assert(sortComponents(new THREE.Vector3(0, 1, 0))[0][1]==='y');
console.assert(sortComponents(new THREE.Vector3(1, 0, 0))[0][1]==='x');

function start(givenRenderer, rtTexture, cb) {
  if (givenRenderer) renderer = givenRenderer;
  else {
    renderer = new THREE.WebGLRenderer({});
    renderer.setSize(w, h);
    document.body.appendChild(renderer.domElement);
    const style = renderer.domElement.style;
    style.width = Math.floor(w / F) + "px";
    style.height = Math.floor(h / F) + "px";
  }

  var aspect = 1;
  const fov = 75;
  camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 10000);

  renderer.setClearColor(new THREE.Color(1, 1, 1), 1);
  function render() {
    if (!window.isHeadless) requestAnimationFrame(render);
    renderer.clear();
    renderer.render(scene, camera, rtTexture, true);
    if (cb) {
      cb();
      cb = undefined;
    }
  }

  const loadAllResources = () =>
    new Promise((resolve, reject) => {
      THREE.DefaultLoadingManager.onLoad = resolve;
      THREE.DefaultLoadingManager.onError = reject;
    });

  loadAnyModel(MODEL_URL, function(obj) {
    scene.add(obj);
    scene.add(textGroup);

    const textSize = measureSize(textGroup);
    //const objCenter = getObject3DCenter(obj);
    //obj.position.sub(objCenter);
    const objSize = measureSize(obj);

    console.log(objSize);

    //const sign = Math.random() < 5 ? -1 : 1;
    //obj.rotation.y = sign * (Math.random() / 2 + 0.3);
    //obj.position.x += sign * objSize.x / 4;

    const factor = textSize.x / objSize.x;
    console.log(factor);
    textGroup.scale.set(1 / factor, 1 / factor, 1 / factor);
    textGroup.position.y = objSize.y / 10 * 2;

    fitCameraToObj(camera, obj);
    //const center = fitAll(obj);

    if (!window.isHeadless) {
      //const controls = new THREE.TrackballControls(camera, renderer.domElement);
      /*const controls = *///new THREE.OrbitControls(camera, renderer.domElement);
      //controls.addEventListener("change", render); // remove when using animation loop
      //controls.target = center;
    }

    loadAllResources().then(render);
  });
}

if (!window.isHeadless) start();
else module.exports.start = start;
