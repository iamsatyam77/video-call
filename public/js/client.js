const socket = io();

socket.emit('init', 'hello');