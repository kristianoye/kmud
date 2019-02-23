
const net = require('net');

var netServer = net.createServer({}, (socket) => {
	socket.fresh = true;
	socket.on('data',  c => console.log(c));
});

console.log('Listening');
netServer.listen(8000);
