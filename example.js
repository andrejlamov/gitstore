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
                 gs.readAndCommit(request, response);
               } else {
                 file.serveFile('/index.html', 200, {}, request, response);
               }
             })

var initialState = JSON.stringify({text: "Hello ROOT"});
gs.init(initialState);
gs.on('init', function(){
  server.listen(1337);
})
