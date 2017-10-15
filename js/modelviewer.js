var THREE = window.THREE || {};

var textGeo;
var textMesh1, textMesh2;
var text = window.displayText || "Foobar";

function loadFont() {
    var loader = new THREE.FontLoader();
    loader.load( '/fonts/' + fontName + '_' + fontWeight + '.typeface.json', function(response) {
        font = response;
        refreshText();
    });
}

function refreshText() {
    textGroup.remove( textMesh1 );
    if ( mirror ) textGroup.remove( textMesh2 );
    if ( !text ) return;
    createText();
}


function createText() {
    textGeo = new THREE.TextBufferGeometry( text, {
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

    if ( ! bevelEnabled ) {

        var triangleAreaHeuristics = 0.1 * ( height * size );

        for ( var i = 0; i < textGeo.faces.length; i ++ ) {

            var face = textGeo.faces[ i ];

            if (face.materialIndex === 1) {

                for (var j = 0; j < face.vertexNormals.length; j++) {
                    face.vertexNormals[ j ].z = 0;
                    face.vertexNormals[ j ].normalize();
                }

                var va = textGeo.vertices[face.a];
                var vb = textGeo.vertices[face.b];
                var vc = textGeo.vertices[face.c];

                var s = THREE.GeometryUtils.triangleArea( va, vb, vc );

                if (s > triangleAreaHeuristics) {
                    for (var k = 0; k < face.vertexNormals.length; k++)
                        face.vertexNormals[ k ].copy( face.normal );
                }

            }

        }

    }

    var centerOffset = -0.5 * ( textGeo.boundingBox.max.x - textGeo.boundingBox.min.x );

    textMesh1 = new THREE.Mesh( textGeo, materials );

    textMesh1.position.x = centerOffset;
    textMesh1.position.y = hover;
    textMesh1.position.z = 0;

    textMesh1.rotation.x = 0;
    textMesh1.rotation.y = Math.PI * 2;

    textGroup.add( textMesh1 );

    if ( mirror ) {
        textMesh2 = new THREE.Mesh( textGeo, materials );
        textMesh2.position.set(centerOffset, -hover, height);
        textMesh2.rotation.x = Math.PI;
        textMesh2.rotation.y = Math.PI * 2;
        textGroup.add( textMesh2 );
    }

}

const F = 3;
const w = (400)*F;
const h = (400)*F;

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, w/h, 0.1, 1000);

var renderer = new THREE.WebGLRenderer({ });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);
var style = renderer.domElement.style;
style.width = Math.floor(w/F) + "px";
style.height = Math.floor(h/F) + "px";


var light = new THREE.HemisphereLight( 0xffffbb, 0x080820, .8 );
scene.add( light );

var intensity = 0.7;
var directionalLight = new THREE.DirectionalLight( 0xffffff, intensity );
directionalLight.position.set( 3, 1, 3 );
directionalLight.rotation.set(.3, .4, 0);
scene.add( directionalLight );

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

var materials = [
    new THREE.MeshPhongMaterial( { color: 0xffffff, flatShading: true } ), // front
    new THREE.MeshPhongMaterial( { color: 0xffffff } ) // side
];

var textGroup = new THREE.Group();
textGroup.position.y = 0;
scene.add(textGroup);
loadFont();

var mirror = false;

var fontMap = {
    "helvetiker": 0,
    "optimer": 1,
    "gentilis": 2,
    "droid/droid_sans": 3,
    "droid/droid_serif": 4
};

var weightMap = {
    "regular": 0,
    "bold": 1
};

var reverseFontMap = [];
var reverseWeightMap = [];

(function() {
    for ( var i in fontMap ) reverseFontMap[ fontMap[i] ] = i;
})();
{
    for ( var i in weightMap ) reverseWeightMap[ weightMap[i] ] = i;
}

function measureSize(obj) {
    return new THREE.Box3().setFromObject(obj).getSize();
}

function fitCameraToObj(camera, obj)
{
    // fit camera to object
    var size = measureSize(obj);
    var height = size.y;
    var dist = height / (2 * Math.tan(camera.fov * Math.PI / 360));
    var pos = obj.position;

    // fudge factor so the object doesn't take up the whole view
    camera.position.set(pos.x, pos.y, dist * 1.0); 
    camera.lookAt(pos);

    return size;
}

var loader;
if (window.modelUrl.toLowerCase().endsWith(".obj"))
    loader = new THREE.OBJLoader();
else
    loader = new THREE.AssimpJSONLoader();

function getCenterPoint(mesh) {
    var geometry = mesh.geometry;
    geometry.computeBoundingBox();   
    var center = geometry.boundingBox.getCenter();
    mesh.localToWorld( center );
    return center;
}

function getObject3DCenter(obj3d) {
    var center = new THREE.Vector3();
    var length = 0;
    obj3d.traverse(function(o) {
        if (o.geometry)
        {
            center.add(getCenterPoint(o));
            length++;
        }
    });
    center.divideScalar(length);
    return center;
}

function render() {
    requestAnimationFrame(render);
    renderer.clear();
    renderer.render(scene, camera);
}

loader.load(window.modelUrl, function(obj) {
    scene.add(obj);

    var textSize = measureSize(textGroup);
    var objCenter = getObject3DCenter(obj);
    obj.position.sub(objCenter);
    var objSize = measureSize(obj);

    var factor = textSize.x  / objSize.x;
    console.log(factor);
    textGroup.scale.set(1/factor, 1/factor, 1/factor);

    fitCameraToObj(camera, scene);

    var controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.addEventListener("change", render); // remove when using animation loop

    render();
});

