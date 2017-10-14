function loadShader (gl, shaderSource, shaderType) {
  var shader = gl.createShader(shaderType)
  gl.shaderSource(shader, shaderSource)
  gl.compileShader(shader)

  // Check the compile status
  var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (!compiled) {
    // Something went wrong during compilation; get the error
    var lastError = gl.getShaderInfoLog(shader)
    console.log("*** Error compiling shader '" + shader + "':" + lastError)
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function createProgram (gl, shaders, optAttribs, optLocations) {
  var program = gl.createProgram()
  shaders.forEach(function (shader) {
    gl.attachShader(program, shader)
  })
  if (optAttribs) {
    optAttribs.forEach(function (attrib, ndx) {
      gl.bindAttribLocation(
        program,
        optLocations ? optLocations[ndx] : ndx,
        attrib)
    })
  }
  gl.linkProgram(program)

  // Check the link status
  var linked = gl.getProgramParameter(program, gl.LINK_STATUS)
  if (!linked) {
    // something went wrong with the link
    var lastError = gl.getProgramInfoLog(program)
    console.log('Error in program linking:' + lastError)

    gl.deleteProgram(program)
    return null
  }
  return program
}

function createProgramFromSources (gl, shaderSources, optAttribs, optLocations) {
  var defaultShaderType = [
    'VERTEX_SHADER',
    'FRAGMENT_SHADER'
  ]

  var shaders = []
  for (var ii = 0; ii < shaderSources.length; ++ii) {
    shaders.push(loadShader(gl, shaderSources[ii], gl[defaultShaderType[ii]]))
  }
  return createProgram(gl, shaders, optAttribs, optLocations)
}

function renderFrame (gl, callback) {
  // Create context

  var vertexSrc = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position,0,1);
  }
  `

  var fragmentSrc = `
  precision mediump float;
  const int max_iterations = 255;

  vec2 complex_square( vec2 v ) {
    return vec2(
      v.x * v.x - v.y * v.y,
      v.x * v.y * 2.0
    );
  }

  void main()
  {
    vec2 uv = gl_FragCoord.xy - vec2(512.0,512.0) * 0.5;
    uv *= 2.5 / min( 512.0, 512.0 );

#if 0 // Mandelbrot
    vec2 c = uv;
    vec2 v = vec2( 0.0 );
    float scale = 0.06;
#else // Julia
    vec2 c = vec2( 0.285, 0.01 );
    vec2 v = uv;
    float scale = 0.01;
#endif

    int count = max_iterations;

    for ( int i = 0 ; i < max_iterations; i++ ) {
      v = c + complex_square( v );
      if ( dot( v, v ) > 4.0 ) {
        count = i;
        break;
      }
    }

    gl_FragColor = vec4( float( count ) * scale );
  }
  `

  // setup a GLSL program
  var program = createProgramFromSources(gl, [vertexSrc, fragmentSrc])

  if (!program) {
    return;
  }
  gl.useProgram(program)

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(program, 'a_position')

  // Create a buffer and put a single clipspace rectangle in
  // it (2 triangles)
  var buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1.0, -1.0,
      1.0, -1.0,
      -1.0, 1.0,
      -1.0, 1.0,
      1.0, -1.0,
      1.0, 1.0]),
    gl.STATIC_DRAW)
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

  // draw
  gl.drawArrays(gl.TRIANGLES, 0, 6)

  callback(gl);
}

if (typeof module !== "undefined")
    module.exports = renderFrame;
