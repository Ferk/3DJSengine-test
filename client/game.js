
// Librerías de O3D
o3djs.base.o3d = o3d;
o3djs.require('o3djs.webgl');
o3djs.require('o3djs.util');
o3djs.require('o3djs.math');
o3djs.require('o3djs.rendergraph');
o3djs.require('o3djs.primitives');
o3djs.require('o3djs.material');
o3djs.require('o3djs.particles');
o3djs.require('o3djs.io');
o3djs.require('o3djs.loader');

// Eventos de la página
// init() se ejecuta cuando la página termine de cargar
// unload() se ejecutará cuando la página se cierre
window.onload = init;
window.onunload = unload;

// variables globales
var g_o3dElement;
var g_o3d;
var g_math;
var g_client;
var g_viewInfo;
var g_pack;
var g_particleSystem;

var g_globalParams;
var g_o3dElement;
var timeMultiplier = 5;

var g_randSeed = 0;
var g_textures = {};


// Raiz principal para los objetos 3D de WebGL
// (Todos los objetos 3D son nodos hijos de está raiz)
var g_root;


var g_entities = [];

var gravity = 4;

var g_player = {};

var g_host = "ferk.dnsalias.com:9000";
var g_mapName;


/**
 * Función para cargar el mapa
 */
function loadMap() {

	g_player.coords = map.playerStart;

    createFloor();
    createSky(map.width, map.height);

	for(var i=0; i<map.terrain.length; i++)
		for(var j=0; j<map.terrain[0].length; j++) {
			var terrain= terrains[ map.terrain[i][j] ];
			if(terrain.getTransform) {
				transform = terrain.getTransform();
				transform.translate([ j, i, 0]);
			}
		}

	for(var i=0; i<map.items.length; i++) {
		transform = map.items[i].type.getTransform();
		transform.translate( map.items[i].x, map.items[i].y, map.items[i].z);
	}

}

/**
 * Crea el area del cliente
 */
function init() {

    // Comprueba que se haya cargo el mapa
    if(map === undefined) {
        alert("El mapa indicado a cargar (" + g_mapName
              + ") no existe o es incorrecto.");
        window.location = ".";
        return;
    }

    // inicializa la conexión por websocket
	Connection.init( "ws://"+g_host+"/3dworld/"+g_mapName );

    // Inicializa el minimapa
    MiniMap.init();

    // "Handler" a activar cuando el cliente esté listo
	o3djs.webgl.makeClients(onClientMade);

    // Asigna las teclas de control
	bindKeys();
}

/**
 * Inicializa O3D y carga texturas y entorno de juego
 * @param {Array} clientElements Array de elementos o3d clientes (sólo hay uno en realidad).
 */
function onClientMade(clientElements) {

    // Inicialia variables globales y librerías de o3d
    g_o3dElement = clientElements[0];
    g_o3d = g_o3dElement.o3d;
    g_math = o3djs.math;
    g_client = g_o3dElement.client;

    // Permite que el fondo del canvas sea transparente (el cielo es un background CSS)
    g_client.normalizeClearColorAlpha = false;

    // Crea un "pack" para añadir y gestionar las texturas
    g_pack = g_client.createPack();

    // Inicializa la raiz
    g_root = g_pack.createObject('Transform');

    // Crea una vista en el cliente con la raiz y el pack dados
    g_viewInfo = o3djs.rendergraph.createBasicView(
        g_pack,
        g_root,
        g_client.renderGraphRoot);

    g_viewInfo.drawContext.projection = g_math.matrix4.perspective(
        g_math.degToRad(45),               // campo de visión (aumentarlo a más de 45 grados deformará la vista).
        g_client.width / g_client.height,  // relación de aspecto
        0.1,                               // Plano cercano (no se mostrarán objetos demasiado cercanos)
        5000);                             // Plano lejano (no se mostrarán objetos demasiado alejados)

    g_viewInfo.clearBuffer.clearColor = [0, 0, 0, 0];  // Fondo negro transparente

    g_particleSystem = o3djs.particles.createParticleSystem(
        g_pack,
        g_viewInfo,
        null,
        g_math.pseudoRandom);

    var loader = o3djs.loader.createLoader(initStep3);

	// Cargar las texturas de los terrenos (bloques, suelo, etc)
    terrains.map(
        function(terrain) {
		    if(terrain && terrain.texture) {
			    loadTexture(loader, terrain.texture);
		    }
	    });

	// Cargar las texturas de los items
    items.map(
        function(item) {
    		if(item.texture) {
			    loadTexture(loader, item.texture);
		    }
        });

    // Cargar las texturas animadas de los jugadores
    Object.map(
        Player.animations,
        function(anim) {
            anim.map(
                function(texture) {
                    loadTexture(loader, texture);
                });
        });


    loadTexture(loader, map.floorTexture);
    loadTexture(loader, map.skyTexture);

    loader.finish();

    // Crear el jugador principal
	if (!g_player.nick) // Si no se eligió nick, tomar uno aleatorio
		g_player.nick = "Invitado"+Math.floor (Math.random () * 1001);

	g_player = new Player(null, g_player.nick, map.playerStart);

	// Enviar una primera actualización para indicar a los demás jugadores
    // de tu existencia (será una actualización completa, incluye nick)
	g_player.sendUpdate(true);
}

/**
 * Función para cargar texturas en el pack, usando un cargador
 */
function loadTexture(loader, filename) {
    // añadir con el cargador la textura dada (en el directorio img)
    // y con el handler "rememberTexture" a ejecutar justo antes de requerir el uso de
    // una textura de las añadidas.
    loader.loadTexture(g_pack,
                       o3djs.util.getAbsoluteURI('./img/' + filename),
                       rememberTexture);

    function rememberTexture(texture, exception) {
        if (exception) {
            alert(exception);
        } else {
            g_textures[filename] = texture;
        }
    }
}

function initStep3() {

    // Crear y asociar parámetros estándares para las texturas del pack
    // y ajustar el punto de iluminación para los shaders.
    g_globalParams = o3djs.material.createAndBindStandardParams(g_pack);
    g_globalParams.lightWorldPos.value = [11, 7, 5]; // posición de la luz
    g_globalParams.lightColor.value = [1, 1, 1, 1];  // color de la luz

    // cargar el mapa
    loadMap();

    // Asignar a la función "onRender" como callback a ejecutar en cada frame de renderizado
    g_client.setRenderCallback(onRender);
}

/**
 * Funcion llamada en cada frame de animación.
 * @param {!o3d.RenderEvent} renderEvent Información de renderizado.
 */
function onRender(renderEvent) {

  var timeDelta = renderEvent.elapsedTime * timeMultiplier;

	// actualizar todas y cada una de las entidades
	for(var i=0; i < g_entities.length; i++) {
		g_entities[i].cycle(timeDelta);
	}
    // actualizar el minimapa
    MiniMap.update();

	// Calcular el objetivo de la cámara (el punto hacia el que mira)
    // (se encontrará separado de la cámara en 1 unidad)
	var target = [
		g_player.coords[0] + Math.cos(g_player.angle),
		g_player.coords[1] + Math.sin(g_player.angle),
		g_player.coords[2]
	];

  g_viewInfo.drawContext.view = g_math.matrix4.lookAt(
      g_player.coords, target,
      [0, 0, 1]); // vector unitario indicando qué dirección es arriba
};

/**
 * Remove any callbacks so they don't get called after the page has unloaded.
 */
function unload() {
  if (g_client) {
    g_client.cleanup();
  }
}


////////
// asociar eventos de teclado a las funciones del juego (movimiento, etc)
function bindKeys() {

	document.onkeydown = function(e) {
		e = e || window.event;

		switch (e.keyCode) { // ¿qué tecla se presionó?

		case 38: // flecha arriba, mover al jugador hacia adelante, es decir, subir velocidad
			g_player.forward(1);
			break;

		case 40: // flecha abajo, mover al jugador hacia atrás, velocidad negativa
			g_player.forward(-1);
			break;

		case 37: // izquierda, girar al jugador a la izquierda
			g_player.rotate(1);
			break;

		case 39: // derecha, girar al jugador a la derecha
            g_player.rotate(-1);
			break;
		case 13: // enter, asignar el foco a la caja de texto
			$("msginput").focus();
			break;

		case 16: // shift
		case 33: // pageup, saltar
            g_player.jump(1);
		}
	};

	document.onkeyup = function(e) {
		e = e || window.event;

		switch (e.keyCode) {
		case 38:
		case 40: // anular la velocidad del jugador al soltar las teclas alante/atrás
			g_player.forward(0);
			break;
		case 37:
		case 39: // anular la rotación del jugador al soltar las teclas izda/dercha
			g_player.rotate(0);
			break;
		case 16:
		case 33: // anular salto
            g_player.jump(0);
		}
	};
}

// Array asociativo de jugadores
var players = {};

/**
 * "clase estática" Connection
 *
 * Objeto javascript que contiene todas las funciones y variables de la conexión
 * por websocket.
 *
 */
var Connection =  {

	init: function(addr) {
		try{
			this.socket = new WebSocket(addr);

			this.socket.onopen    =
				function(msg){
                    log(0,"Conectado en "+g_mapName);
                    g_player.sendUpdate(true);
                };

			this.socket.onmessage = this.received;

			this.socket.onclose   =
				function(msg){ log(0,"Conexión perdida"); };
		}
		catch(ex){ log(0,"Error de Websocket:"+ ex); }
	},

	send: function(msg) {
        if(this.socket.readyState != WebSocket.OPEN)
            return;
		try{
			msg = JSON.encode(msg);
			this.socket.send(msg);
			//log(1,'Envío: '+msg);
		} catch(ex){ log(0,"Error de envío: "+ex); }
	},

	received: function(msg){
		var data= JSON.decode(msg.data,true);

		// Mensaje de chat
		if(data["chat"]) {
			var pl = players[data["player"]];
			chatlog(pl.nick, data["chat"]);
		}

		// Mensajes de actualización
		else if(data["coords"]) {
			var pl = players[data["player"]];
			if(pl) {
				pl.setProp(data);
			}
			else {
				players[data["player"]] = new Player(data["player"],data["nick"],data["coords"]);
				g_entities.push( players[data["player"]] );
		        log(0,"El jugador \'"+data["nick"]+"\' entró en el mapa.");
			}
		}

        // Mensaje de desconexión (debe mantenerse como el último else-if)
        else if(data["player"]) {
			var pl = players[data["player"]];
            log(0,"El jugador \'"+pl.nick+"\' se desconectó.");
            pl.destroy();
        }
	},
};



function log(debug,msg) {
	//if(debug > debuglevel) return;
	var txt = $("log");
	txt.innerHTML+="<p class='logmsg'>"+msg+"</p>";
	txt.scrollTop= txt.scrollHeight;

}

function chatlog(nick, txt) {
	var chatbox = $("log");
    txt.replace("/</g","&lt;");
    txt.replace("/</g","&gt;");
	chatbox.innerHTML += "<p class='chatmsg'><span class='playername'>"+nick+"</span> "+txt+"<p>";
	chatbox.scrollTop= chatbox.scrollHeight;
}


function chatsend(){
  var input;
  input = $("msginput");
  if(input.value != "") {
	  var msg = {};
	  msg["chat"]= input.value;
	  Connection.send(msg);
	  chatlog(g_player.nick, input.value);
	  input.value="";
	  input.focus();
  }
}

/**
 * Devuelve las coordenadas de movimiento corregidas tras aplicar un sistema
 * de detección de colisiones.
 */
function getMove(coords, newcoords, radius) {

	var ix= Math.round(newcoords[0]);
    var iy= Math.round(newcoords[1]);

	var blockTop = isBlocking([ix,iy-1]);
	var blockBottom = isBlocking([ix,iy+1]);
	var blockLeft = isBlocking([ix-1,iy]);
	var blockRight = isBlocking([ix+1,iy]);

    // No permitir acercarse a un bloque a distancia mayor del radio
    // en ninguna de las 4 direcciones adyaccentes
    // Se mantiene fija la componente de esa dirección, permitiendo movimiento en la otra

    // ·#·
    // ·@·
    // ···
	if (blockTop && (newcoords[1] - iy) < radius) {
		newcoords[1] = iy + radius;
	}
    // ···
    // ·@·
    // ·#·
	if (blockBottom && (iy+1 - newcoords[1]) < radius) {
		newcoords[1] = iy+1 - radius;
	}
	if (blockLeft && (newcoords[0] - ix) < radius) {
		newcoords[0] = ix + radius;
	}
	if (blockRight && (ix+1 - newcoords[0]) < radius) {
		newcoords[0] = ix+1 - radius;
	}

    // Comprobar también los contactos con esquinas
    // Evitar que se atraviese la pared en la esquina, fijando la componente más próxima

    // #··
    // ·@·
    // ···
	if (isBlocking([ix-1,iy-1]) != 0 && !(blockTop != 0 && blockLeft != 0)) {
		var dx = newcoords[0] - ix;
		var dy = newcoords[1] - iy;
		if (dx*dx+dy*dy < radius*radius) {
			if (dx*dx > dy*dy)
				newcoords[0] = ix + radius;
			else
				newcoords[1] = iy + radius;
		}
	}
    // ··#
    // ·@·
    // ···
	if (isBlocking([ix+1,iy-1]) != 0 && !(blockTop != 0 && blockRight != 0)) {
		var dx = newcoords[0] - (ix+1);
		var dy = newcoords[1] - iy;
		if (dx*dx+dy*dy < radius*radius) {
			if (dx*dx > dy*dy)
				newcoords[0] = ix + 1 - radius;
			else
				newcoords[1] = iy + radius;
		}
	}
    // ···
    // ·@·
    // #··
	if (isBlocking([ix-1,iy+1]) != 0 && !(blockBottom != 0 && blockBottom != 0)) {
		var dx = newcoords[0] - ix;
		var dy = newcoords[1] - (iy+1);
		if (dx*dx+dy*dy < radius*radius) {
			if (dx*dx > dy*dy)
				newcoords[0] = ix + radius;
			else
				newcoords[1] = iy + 1 - radius;
		}
	}
    // ···
    // ·@·
    // ··#
	if (isBlocking([ix+1,iy+1]) != 0 && !(blockBottom != 0 && blockRight != 0)) {
		var dx = newcoords[0] - (ix+1);
		var dy = newcoords[1] - (iy+1);
		if (dx*dx+dy*dy < radius*radius) {
			if (dx*dx > dy*dy)
				newcoords[0] = ix + 1 - radius;
			else
				newcoords[1] = iy + 1 - radius;
		}
	}

    return newcoords;
}

function isBlocking(coords) {

	// primero, asegurémonos que no nos salimos fuera del mapa
	if (coords[1] < 0 || coords[1] >= map.height ||
        coords[0] < 0 || coords[0] >= map.width)
		return true;


	var ix = Math.round(coords[0]);
	var iy = Math.round(coords[1]);

	// true si la posición del mapa no es atravesable
	if (! terrains[ map.terrain[iy][ix] ].isWalkable)
		return true;

//	if (map.[iy][ix] && spriteMap[iy][ix].block)
//		return true;

    // Se puede caminar por ahí
	return false;
}



/**
 * Clase Entidad.
 * Representa cada uno de los elementos del mapa capaces de desplazarse, crearse y destruirse dinámicamente.
 */
var Entity = new Class(
    /**
     * Constructor de la clase entidad
     */
	function( location, transform) {

		this.transform = transform;
        this.transform.translate(location);

		this.coords = location;
		this.angle = 0;

		// que tan lejos (en unidades del mapa, bloques) el jugador se mueve en cada paso
		this.linSpeed = 0.5;
		this.rotSpeed = 0.5;     // cuanto rotar en cada paso (en radianes)

		// Dirección actual del movimiento/rotación
        // Negativo significa dirección/rotación en sentido contrario
		this.linDir = [0, 0, 0];
		this.rotDir = 0;

        // Distancia en el eje Z del centro de la entidad
        this.height = 0.25;

        // Añadir a la lista de entidades
		g_entities.push(this);
	}
);

Entity.implement
({

     /**
      * Función que se ejecutará cada ciclo de actualización
      * Gracias al parámetro "timeDelta" se puede ajustar a la velocidad de forma que sea independiente
      * del framerate del cliente (clientes más lentos, aunque vayan a saltos moveran a la misma velocidad).
      */
     cycle: function(timeDelta) {

	     // Aplicar rotación
	     if( this.rotDir != 0) {
             // El nuevo ángulo se vé incrementado en velocidad angular * tiempo
             // en la dirección rotDir
		     this.angle += this.rotDir * this.rotSpeed * timeDelta;
	     }

         var newcoords = Array.clone(this.coords);
         var moved= false;

	     // Aplicar movimiento avance/retroceso del eje x del jugador (coordenada 0 de dirección)
	     if(this.linDir[0] != 0) {
		     var module = this.linDir[0] * timeDelta * this.linSpeed;
             // El incremento en X desde el punto de vista del jugador se traslada
             // a las coordenadas X,Y desde el punto de vista del mapa en función del ángulo
		     newcoords[0] += module * Math.cos(this.angle);
		     newcoords[1] += module * Math.sin(this.angle);
             moved =true;
	     }

	     // Aplicar movimiento de strafing del eje y del jugador (coordenada 1 de dirección)
	     if(this.linDir[1] != 0) {
		     var module = this.linDir[1] * timeDelta * this.linSpeed;
             // El incremento en Y desde el punto de vista del jugador se traslada
             // a las coordenadas X,Y desde el punto de vista del mapa en función del ángulo
		     newcoords[0] += module * Math.cos(this.angle + Math.PI/2);
		     newcoords[1] += module * Math.sin(this.angle + Math.PI/2);
             moved =true;
	     }

	     // Aplicar movimiento en el eje z (coordenada 2 del vector de dirección)
         // sólo si está en contacto con el suelo!
	     if(this.linDir[2] != 0 &&  (this.coords[2] < 2*this.height)) {
	         newcoords[2] += this.linDir[2] * timeDelta * this.linSpeed;
             moved =true;
         }

	     // Aplicar la fuerza de la gravedad (restar fuerza*tiempo al eje z)
	     if(this.coords[2] > this.height) {
		     newcoords[2] -= map.gravity * timeDelta;
             // El suelo ejerce fuerza hacia arriba
             // (no se puede bajar más de la altura de la entidad)
	         if(this.coords[2] < this.height)
                 newcoords[2] = this.height;
             moved =true;
	     }

         // Hacer efectivas las nuevas coordenadas y activar animación de caminar
         if( moved && !isBlocking(newcoords) ) {
             this.setCoords( getMove(this.coords,newcoords,0.35) );
             this.animate("walk");
         }
     },

     /**
      * Actualizar la matriz de posición de la entidad
      * asignándole nuevas coordenadas
      */
     setCoords: function(newcoords) {
         this.transform.translate(
             [
                 newcoords[0] - this.coords[0],
                 newcoords[1] - this.coords[1],
                 newcoords[2] - this.coords[2]
             ]);
         this.coords= newcoords;
     },

     /**
      * Destruir la entidad y eliminarla de la lista de entidades
      */
     destroy: function() {
         g_root.children.erase(this.transform);
         g_entities.erase(this);
         delete this;
     }
 });



/**
 * Clase (Entidad) Player
 * Entidad que representa a cada uno de los jugadores.
 */
var Player = new Class
({
	Extends: Entity,

     /**
      * Constructor para la clase Player
      */
	 initialize: function(id,nick, coords){
		 this.parent(coords, this.getTransform() );
		 this.nick = nick;
		 this.id = id;
         this.coords = coords;
         this.height = 0.25;
	 },


     getTransform: function() {
         if(! this.object3d) {
             // Crear un objeto en el mapa tipo BillBoard (textura 2D)
             // con tamaño doble de la altura al centro y usando la imagen del jugador parado.
//             this.object3d= new BillBoard(Player.animations["stand"],true, this.height*2 );
             this.object3d= new BillBoard("player.png",true,0.5);
         }

         return this.object3d.getTransform();
     },

     /**
      * Ajustar la textura en función del tiempo actual
      */
     animate: function(anim) {
         var aniCycleTime= 600; // milisegundos para los que se repetirá la animación
         var state = Math.floor(
             // El resto de la división de los milisegundos actuales por la duración de los ciclos de animación
             // dará el tiempo transcurrido desde que finalizó el último ciclo de animación.
             (new Date() % aniCycleTime)
             // Dividiendo por el tiempo que toma cada animación, tenemos en qué subdivisión de animación estamos
             // es decir, el estado (despreciamos decimales para usar el entero para la posición del array de animaciones)
                 / (aniCycleTime / Player.animations[anim].length));

         if(! this.object3d) {
             // Crear un objeto en el mapa tipo BillBoard (textura 2D)
             // con tamaño doble de la altura al centro y usando la imagen del jugador parado.
//             this.object3d= new BillBoard(Player.animations["stand"],true, this.height*2 );
             this.object3d= new BillBoard(Player.animations["stand"],true, 0.5 );
         }

         this.object3d.setTexture( Player.animations[anim][state] );
     },


     /**
      * Asigna al jugador las nuevas propiedades de estado (posición, ángulo, etc).
      *
      * Esto se emplea para actualizaciones de otros jugadores recibidas desde el servidor
      */
	 setProp: function(prop) {
         this.setCoords(prop["coords"]);
		 this.angle = prop["angle"];
		 this.linDir = prop["linDir"];
		 this.rotDir = prop["rotDir"];
         if(prop["nick"])
             this.nick = prop["nick"];
	 },

     /**
      * Obtiene las propiedades del estado actual del jugador.
      *
      * Esto se emplea para enviar actualizaciones del jugador actual al servidor.
      * @param full booleano que indica si se deben obtener
      *             completamente todos los valores (incluir nick).
      */
	 getProp: function(full) {
		 var prop = {};
		 prop["coords"] = this.coords;
		 prop["angle"] = this.angle;
		 prop["linDir"] = this.linDir;
		 prop["rotDir"] = this.rotDir;
         if(full)
             prop["nick"] = this.nick;
		 return prop;
	 },

     /**
      * Envía al servidor el estado actual del jugador.
      *
      * @param fullUpdate booleano que indica si se debe actualizar
      *                   completamente todos los valores (incluir nick).
      */
	 sendUpdate: function(fullUpdate) {
		 Connection.send(this.getProp(true));
	 },

     /**
      * Función ejecutada en cada ciclo de renderizado
      */
	 ai: function(timeDelta) {

         // Realizar movimiento
		 this.move(timeDelta);
	 },

     /**
      * Hace avanzar al jugador hacia adelante (parámetro +1) o atrás (parámetro -1)
      */
	 forward: function(dir) {
	     this.linDir[0] = dir;
	     this.sendUpdate();
	 },

     /**
      * Hace moverse al jugador hacia el lado derecho (parámetro +1) o izquierdo (parámetro -1)
      */
	strafe: function(dir) {
        if( this.linDir[1] != dir ) {
		    this.linDir[1] = dir;
		    this.sendUpdate();
        }
	},

     /**
      * Hace saltar al jugador hacia arriba (parámetro +1) o detiene el salto (parámetro 0)
      */
	jump: function(dir) {
        if( this.linDir[2] != dir ) {
		    this.linDir[2] = dir;
		    this.sendUpdate();
        }
	},

     /**
      * Hace girar al jugador hacia la izquierda (parámetro +1) o derecha (parámetro -1)
      */
	rotate: function(dir) {
        if( this.rotDir != dir ) {
		    this.rotDir = dir;
		    this.sendUpdate();
        }
	}

});

Player.animations= {
//         walk: ['player_walk1.png', 'player_walk2.png',
//                'player_walk3.png', 'player_walk4.png'],
    walk: [ "leg01.png", "leg02.png", "leg03.png"],
    stand: ['player.png']
};



var Enemy = new Class
({
	Extends: Entity,

	 initialize: function(id,nick, coords){

     },

});


/**
 * "Clase estática" MiniMap
 *
 * Objeto que contiene las funciones encargada de dibujar y actualizar los canvas que contienen el minimapa.
 *
 * Se emplean dos canvas distintos superpuestos:
 * - Uno para dibujar el terreno del mapa (la matriz de bloques) el cual sólo se dibuja en la inicialización.
 * - Otro que será sobre el que se dibujen las entidades en el mapa, que sí serán objetos móviles que
 *   habrá que actualizar en cada ciclo.
 */
var MiniMap = {

    /**
     * Inicialización del Minimapa
     */
    init: function() {
	    var miniMap = $("minimap");			// el canvas sobre el que se dibujará el terreno del mapa
	    var miniMapCtr = $("minimapcontainer");	// el elemento div que contiene el mapa
	    var miniMapObjects = $("minimapobjects");	// el canvas sobre el que se dibujan los objetos

        // Asignar una escala al minimapa relativa al tamaño del mapa real de tal forma
        // que el minimapa siempre ocupe 200 pixeles de ancho (se evita minimapas enormes en mapas grandes).
        this.scale= 200/map.width;

        // Ajustar el tamaño de los elementos relativos a la escala tomada
	    miniMap.width = map.width * this.scale; // en realidad el ancho sería siempre 200, pero así es más portable el código
	    miniMap.height = map.height * this.scale;
	    miniMapObjects.width = miniMap.width;
	    miniMapObjects.height = miniMap.height;
        // Ajustar también el CSS
	    var w = (map.width * this.scale) + "px";
	    var h = (map.height * this.scale) + "px";
	    miniMap.style.width = miniMapObjects.style.width = miniMapCtr.style.width = w;
	    miniMap.style.height = miniMapObjects.style.height = miniMapCtr.style.height = h;

        // Obtener el contexto 2D para realizar el dibujado inicial
	    var ctx = miniMap.getContext("2d");

        // Dibujar un rectángulo en blanco representando el mapa completo
	    ctx.fillStyle = "white";
	    ctx.fillRect(0,0,miniMap.width,miniMap.height);

	    // iterar sobre la matriz del mapa para rellenar los bloques con rectángulos de color gris
		ctx.fillStyle = "rgb(200,200,200)";
	    for (var iy=0; iy<map.terrain.length; iy++) {
		    for (var ix=0; ix<map.terrain[0].length; ix++) {

			    if ( map.terrain[iy][ix] > 0) { // si hay un bloque en la coordenada (x,y)
				    ctx.fillRect(		// dibujar el bloque en el minimapa
					    ix * this.scale,
					    iy * this.scale,
					    this.scale,this.scale
				    );
			    }
            }
        }
    },

    /**
     * Actualizar las entidades en el minimapa
     */
    update: function() {

	    var miniMap = $("minimap");
	    var miniMapObjects = $("minimapobjects");

        // Obtener el contexto 2D del canvas
	    var objectCtx = miniMapObjects.getContext("2d");
	    miniMapObjects.width = miniMapObjects.width;

        // Dibujar un punto rojo en la posición actual del jugador
	    objectCtx.fillStyle = "red";
	    objectCtx.fillRect(
		    g_player.coords[0] * this.scale - 2,
		    g_player.coords[1] * this.scale - 2,
		    4, 4
	    );

        // Dibujar también una linea en la dirección a la que el jugador está mirando (usando el angle)
	    objectCtx.strokeStyle = "red";
	    objectCtx.beginPath();
	    objectCtx.moveTo(g_player.coords[0] * this.scale,
                         g_player.coords[1] * this.scale);
	    objectCtx.lineTo(
		    (g_player.coords[0] + Math.cos(g_player.angle)) * this.scale,
		    (g_player.coords[1] + Math.sin(g_player.angle)) * this.scale
	    );
	    objectCtx.closePath();
	    objectCtx.stroke();

        // Para cada entidad del mapa distinta del jugador, dibujar un punto de color azul
        // y una linea indicando la dirección a la que está mirando.
        for (var i=0; i<g_entities.length; i++) {
            var entity = g_entities[i];
            if(entity != g_player) {
                objectCtx.fillStyle = "blue";
		        objectCtx.fillRect(
			        entity.coords[0] * this.scale - 2,
			        entity.coords[1] * this.scale - 2,
			        4, 4
		        );
	            objectCtx.strokeStyle = "blue";
	            objectCtx.beginPath();
	            objectCtx.moveTo(entity.coords[0] * this.scale,
                                 entity.coords[1] * this.scale);
	            objectCtx.lineTo(
		            (entity.coords[0] + Math.cos(entity.angle)) * this.scale,
		            (entity.coords[1] + Math.sin(entity.angle)) * this.scale
	            );
	            objectCtx.closePath();
	            objectCtx.stroke();
            }
     }

 }
};



/////
// Cargar parámetros de la url
var url = new URI(document.URL);
g_mapName = url.getData("m") || "map01";
g_player.nick = url.getData("n");
// Incluir mapa
document.writeln("<script src=\"" + g_mapName
                 + ".js\" type=\"text\/javascript\"><\/script>");
