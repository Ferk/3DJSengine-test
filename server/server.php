#!/usr/bin/env php
<?php 

include "websocket.class.php";


/**
 * Función que extiende el websocket básico para hacer funcionar
 * las comunicaciones del juego.
 */
class GameServer extends WebSocket {


  /**
   * Función ejecutada al conectarse un cliente
   */
  function onConnect($user) {
    $this->say("\n".$user->socket." ha conectado en: ".$user->resource);
    
    // Asignar datos iniciales por defecto
    $user->data["coords"] = Array(0,0,0);
    $user->data["nick"] = "desconocido";

    // Enviarle los datos de todos los demás jugadores del mismo mapa
    foreach ($this->users as $eachUser) {
      if( $eachUser != $user 
          && $eachUser->resource == $user->resource
           // No incluir jugadores aún no definidos
          ) {
        $msg = $eachUser->data;
        $msg["player"] = $eachUser->id;
        $this->send($user,$msg);
      }
    }
  }
  

    /**
     *
     */
	function process($user,$msg){
		$this->say($user->socket." -> ".$msg);
		
		$data= json_decode($msg, true);
		
        // Si son mensajes de actualizar posición, guardar y reenviar
		if(isset($data["coords"])) {
			$user->data= $data;
			$data["player"] = $user->id;
            $this->sendEveryoneElseIn($user,$data,$user->resource);
          }
          // Si es mensaje de chat, guardar nick y reenviar
          if(isset($data["chat"])) {
			$data["player"] = $user->id;
            $this->sendEveryoneElseIn($user,$data,$user->resource);
          }
	}
	
	// Función de callback llamada cuando un usuario desconecta
	function onDisconnect($user) {
      
      // Notificar a los demás usuarios de la desconexión
      $msg["player"]= $user->id;
      $this->sendEveryoneElseIn($user, $msg, $user->resource);

	}


  // Enviar $data al jugador $user
	function send($user, $data) {
		
	  $msg = json_encode($data);
	  $msg = $this->wrap($msg);
	  
	  socket_write($user->socket,$msg,strlen($msg));
	  $this->say($user->socket." <- ".$msg);
	}

	// Enviar $data a todo jugador dentro de $map salvo $user
	function sendEveryoneElseIn($user, $data, $map) {
		
	  $msg = json_encode($data);
	  $msg = $this->wrap($msg);
	  
	  foreach ($this->users as $eachUser) {
		  if( $eachUser != $user && $eachUser->resource == $map) {
			  socket_write($eachUser->socket,$msg,strlen($msg));
			  $this->say($eachUser->socket." <- ".$msg);
		  }
	  }
	}
	
	// Enviar $data a todos los jugadores
	function sendEveryone($data) {
	  
		$msg = json_encode($data);
		$msg = $this->wrap($msg);
		
		foreach ($this->users as $eachUser) {
			socket_write($eachUser->socket,$msg,strlen($msg));
			$this->say($eachUser->socket." <- ".$msg);
	  }
	}
	

	function gameCycle() {
		
	}
}


//$master = new GameServer("localhost",9000);
$master = new GameServer("192.168.50.101",9000);


?>

