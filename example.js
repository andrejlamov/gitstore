var http = require('http'),
    static = require('node-static'),
    cp = require('child_process'),
    gs = require('./gitstore.js')('store'),
    longjohn = require('longjohn');

var file = new static.Server('./public');

var server = http.createServer(function (request, response) {
               var url = request.url.split('/').filter(function(d){ return d });
               if(url[0] == 'show') {
                 var ref = url[1] || 'ROOT';
                 gs.show(ref, response);
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
                   gs.commit(message.state, message.parent, message.newref, response);
                 });
               } else {
                 file.serveFile('/index.html', 200, {}, request, response);
               }
             })

var initialState = JSON.stringify({text: "Hello ROOT"});
gs.init(initialState);
gs.on('init', function(){
  server.listen(1337);
})
