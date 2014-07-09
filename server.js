var http = require('http'),
    static = require('node-static'),
    cp = require('child_process'),
    gs = require('./gitstore.js').create('store'),
    longjohn = require('longjohn');

var file = new static.Server('./public');

var server = http.createServer(function (request, response) {
               var url = request.url.split('/').filter(function(d){ return d });
               if(url[0] == 'show') {
                 var ref = url[1] || 'ROOT';

                 gs.show(ref, function(data){
                   response.writeHead(200, {'Content-Type': 'application/json'});
                   if(data.ok) {
                     response.end(JSON.stringify(data.state));
                   } else {
                     gs.show('ROOT', function(data) {
                       response.writeHead(200, {'Content-Type': 'application/json'});
                       response.end(JSON.stringify(data.state));
                     })
                   }
                 })

               } else if(url[0] == 'commit') {
                 var buffer = "";
                 request.on('data', function(data) {
                   buffer += data;
                   if (buffer.length > 1e6) {
                     request.connection.destroy();
                   }
                 });
                 request.on('end', function() {
                   var message = JSON.parse(buffer);
                   gs.commit(message.state, message.parent, message.newref, function(data) {
                     response.writeHead(200, {'Content-Type': 'application/json'});
                     response.end(JSON.stringify(data));
                   })

                 });
               } else {
                 file.serveFile('/index.html', 200, {}, request, response);
               }
             })

var initialState = {text: "Hello ROOT"};
gs.init(initialState);
gs.on('init', function(){
  server.listen(1337);
})
