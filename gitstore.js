var cp = require('child_process')
  , events = require('events');

var Gitstore = module.exports = function(git_dir) {
    if (!(this instanceof Gitstore)) return new Gitstore(git_dir);
    this.git_dir = git_dir;
};

Gitstore.prototype = new events.EventEmitter;

Gitstore.prototype.init = function(init_state) {
  var self = this;
  var init = cp.spawn(__dirname + '/gitstore.sh', ['-i', this.git_dir]);

  init.stderr.setEncoding('utf8');
  init.stderr.on('data', function(data){
    console.log('*** error when creating bare repo:\n' + data);
  });

  init.on('close', function(code) {
    if(code !== 0) {
      console.log('*** error code:\n' + code);
    } else {
      self.emit('init');
    }
  })

  init.stdin.on('error', function(err){
    console.log('*** pipe error, git repo is already created?');
  })

  init.stdin.write(init_state);
  init.stdin.end();
}

Gitstore.prototype.isValidId = function(str) {
  var shaOrBranch = /^[a-zA-Z0-9_-]*$/;
  return shaOrBranch.test(str);
}

Gitstore.prototype.show = function(ref, response) {
  var self = this;
  ref = ref || 'ROOT';

  var def_resp = function() {
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify({"event": "new-ref", "ref": "ROOT"}));
  };

  if(!self.isValidId(ref)){
    def_resp();
    return;
  }

  if(self.isValidId(ref)){
    cp.execFile(__dirname + '/gitstore.sh'
               , ['--show', ref]
               , {cwd: this.git_dir}
               , function(err, stdout, stderr) {
                   if(err) {
                     def_resp();
                     return;
                   }
                   response.writeHead(200, {'Content-Type': 'application/json'});
                   response.end(stdout);
                 })
  } else {
    def_resp();
  }
}

Gitstore.prototype.readAndCommit = function(request, response) {
  var self = this;

  var buffer = "";
  request.on('data', function(data) {
    buffer += data;
    if (buffer.length > 1e6) {
      request.connection.destroy();
    }
  });
  request.on('end', function() {
    var message = JSON.parse(buffer);
    self.commit(JSON.stringify(message.state), message.parent, message.newref, response);
  });
}

Gitstore.prototype.commit = function(content, parent, branch, response) {
  var self = this;
  parent = parent || 'ROOT';

  if(!self.isValidId(parent) || !self.isValidId(branch)){
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify({"event": "new-ref", "ref": "ROOT"}));
    return;
  }

  var flags = ['--commit', '--parent', parent];
  if(branch) {
    flags.push('--branch');
    flags.push(branch);
  }

  var commit = cp.spawn(__dirname + '/gitstore.sh', flags, {cwd: this.git_dir});
  commit.stdout.setEncoding('utf8');
  commit.stdout.on('data', function(data){
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(data);
  })

  commit.stderr.setEncoding('utf8');
  commit.stderr.on('data', function(data){
    console.log('*** commit error:\n' + data)
  })
  commit.on('err', function(data){
    console.log('*** commit error:\n' + data);
  })

  commit.stdin.write(content);
  commit.stdin.end();
}
