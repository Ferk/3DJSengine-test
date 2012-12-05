


function createFloor() {
    
    //////
    /// Creación del suelo
    
    var material = o3djs.material.createCheckerMaterial(g_pack,
                                                        g_viewInfo);

  // Crear un plano 
  var shape = o3djs.primitives.createPlane(
	  g_pack, material, map.width, map.height, 10, 10,
	  g_math.matrix4.rotationX(g_math.degToRad(90)));

  // Poner en una transformada
  var transform = g_pack.createObject('Transform');
  transform.parent = g_root;
  transform.addShape(shape);
  transform.translate([ map.width/2, map.height/2, 0]);

    return transform;
}


// El cielo es la imagen de fondo del div bajo el canvas
function createSky() {
    $('o3d').setStyle('background-image','url("img/skytile.jpg")');
}

/////
//
var Transformable = new Class
({

     initialize: function(isWalkable) {
         this.isWalkable = isWalkable;
     },
     
     getShape: function() {
         return this.shape;
     },

     getTransform: function() {
	     var transform = g_pack.createObject('Transform');
	     transform.parent = g_root;
         transform.addShape(this.getShape());

	     return transform;
     }
 });


////
//
var Fire = new Class
({
     Extends: Transformable,

     initialize: function(size,height) {
         this.isWalkable =true;
         this.size = size;
         this.height = height;
     },

     getShape: function() {
         if(!this.shape) {

             // Fuego (emisor de partículas)
             var emitter = g_particleSystem.createParticleEmitter();
             emitter.setState(o3djs.particles.ParticleStateIds.ADD);
             emitter.setColorRamp(
                 [1, 1, 0, 1,
                  1, 0, 0, 1,
                  0, 0, 0, 1,
                  0, 0, 0, 0.5,
                  0, 0, 0, 0]);
             emitter.setParameters({
                                       numParticles: 20,
                                       lifeTime: this.size,
                                       timeRange: this.size,
                                       startSize: this.size*0.8,
                                       endSize: this.size*1.2,
                                       velocity:[0, 0, 2],
                                       velocityRange: [0.5, 0.5, 0.5],
                                       worldAcceleration: [0, 0, -1],
                                       spinSpeedRange: 4});

             // Bastón (cilindro)
             var stickMaterial = o3djs.material.createBasicMaterial(
                 g_pack,
                 g_viewInfo,
                 [0.5, 0.3, 0.2, 1]);
             var cylinderShape = o3djs.primitives.createCylinder(
                 g_pack, stickMaterial, this.size*0.05, this.height, 20, 3,
                 g_math.matrix4.rotateX(
                     g_math.matrix4.translation([0, 0, -(this.height*0.5
                                                         +this.size*0.2)]),
                     Math.PI/2));

             this.shape= [emitter.shape, cylinderShape];
         }
         return this.shape;
     },

     getTransform: function() {
	     var transform = g_pack.createObject('Transform');
	     transform.parent = g_root;
         this.shape = this.getShape();
         transform.addShape(this.shape[0]);
         transform.addShape(this.shape[1]);
         
	     return transform;
     }
 });


var Floor = new Class
({
	 texture: "",

	 initialize: function(texture, size) {
		 this.texture = texture;
		 this.size= size;
	 },

	 getShape: function() {
		 // Sólo crear la figura 3D si no está ya definida
		 if(! this.shape) {

			 var material = o3djs.material.createMaterialFromFile(
				 g_pack, './shaders/texture-only-glsl.shader',
				 g_viewInfo.zOrderedDrawList);

			 // Asignar la textura
			 var sampler = g_pack.createObject('Sampler');
			 sampler.texture = g_textures[ this.texture ];
			 sampler.addressModeU = g_o3d.Sampler.CLAMP;
			 sampler.addressModeV = g_o3d.Sampler.CLAMP;
			 material.getParam('texSampler0').value = sampler;

			 // Crear un plano XY
			 this.shape = o3djs.primitives.createPlane(
				 g_pack, material, this.size, this.size, 1, 1,
				 g_math.matrix4.rotationX(g_math.degToRad(90)));
         }
         return this.shape;
	 },

     getTransform: function() {
	     var transform = g_pack.createObject('Transform');
	     transform.parent = g_root;
         transform.addShape(this.getShape());

	     return transform;
     }
 });


/**
 * clase BillBoard
 */
var BillBoard = new Class
({
	 texture: "",

	 initialize: function(texture, isWalkable, size) {
		 this.texture = texture;
		 this.isWalkable = isWalkable;
         this.size = size;
	 },

     setTexture: function(texture) {
         this.texture = texture;
         this.sampler.texture = g_textures[this.texture];
     },

	 getShape: function() {
		 // Sólo crear si no está ya definido
		 if(! this.shape) {

			 var material = o3djs.material.createMaterialFromFile(
				 g_pack, './shaders/billboard-glsl.shader',
				 g_viewInfo.zOrderedDrawList);

			 // Asignar la textura
			 this.sampler = g_pack.createObject('Sampler');
			 this.sampler.texture = g_textures[ this.texture ];
			 this.sampler.addressModeU = g_o3d.Sampler.CLAMP;
			 this.sampler.addressModeV = g_o3d.Sampler.CLAMP;
			 material.getParam('texSampler0').value = this.sampler;

			 // Crear un plano XY para el billboard.
			 this.shape = o3djs.primitives.createPlane(
				 g_pack, material, this.size, this.size, 1, 1,
				 g_math.matrix4.rotationX(g_math.degToRad(90)));
         }
         return this.shape;
	 },

     getTransform: function() {
	     var transform = g_pack.createObject('Transform');
	     transform.parent = g_root;
         transform.addShape(this.getShape());

	     return transform;
     }
 });



/**
 * Clase para los bloques
 */
var Block = new Class
({
     Extends: Transformable,

	 texture: "",

	 initialize: function(texture, isWalkable, size) {
		 this.texture = texture;
		 this.size = size;
		 this.isWalkable = isWalkable;
	 },

	 getShape: function() {
		 // Sólo crearlo si no está ya definida
		 if(! this.shape) {
			 var wallMaterial = o3djs.material.createMaterialFromFile(
				 g_pack, './shaders/texture-only-glsl.shader',
				 g_viewInfo.zOrderedDrawList);

			 // Asignar la textura
			 var sampler = g_pack.createObject('Sampler');
			 sampler.texture = g_textures[ this.texture ];
			 sampler.addressModeU = g_o3d.Sampler.CLAMP;
			 sampler.addressModeV = g_o3d.Sampler.CLAMP;
			 wallMaterial.getParam('texSampler0').value = sampler;

			 // Crear un cubo
	         this.shape = o3djs.primitives.createCube(
                 g_pack, wallMaterial, this.size,
	             g_math.matrix4.translation([0, 0, this.size/2]));
         }
         return this.shape;
	 }
 });





var map = {

    terrain: [
        //  00 01 02 00 00 05 06 07 08 09 10 11 12 10 10 15 16 17 18 19 20 21 22 20 20 25 26 27 28 29 00 01
	    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 	// 0
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 1
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 1
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 1
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 1
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 0
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 0
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 0
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 5
	    [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 0, 2, 2, 2, 1, 1, 1, 1, 1], 	// 6
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 7
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 	// 8
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 9
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 10
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 11
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 	// 10
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 10
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 10
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 15
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 16
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 17
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 18
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 19
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 00
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 01
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 00
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 00
	    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 	// 00
	    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]	// 00
    ],

    tileSize: 1,

    playerStart: [10.5, 6.5, 0.25],

    gravity: 0.35,

    floorTexture: "floor01.jpg",

    skyTexture: "nitesky.jpg"
};

map.height= map.terrain.length* map.tileSize;
map.width= map.terrain[0].length * map.tileSize;

var terrains = [];

//terrains[0] = new Floor('floor.jpg');

terrains[0] = { isWalkable: true };

// Muros
terrains[1] = new Block('wall01.jpg',       false, 1);
terrains[2] = new Block('wall02_blue.jpg',  false, 1);
terrains[3] = new Block('wall03.jpg',       false, 1);
terrains[4] = new Block('wall01_broken.jpg',false, 1);

var items = [];

items[0]= new BillBoard('hcorpse.png',true, 0.2);
items[1]= new Fire(0.5, 1);


map.items =
	[
		// Antorchas de fuego
		{type: items[1], x:5, y:7, z:0.8}
	];
