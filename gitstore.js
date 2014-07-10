var cp = require('child_process')
  , events = require('events');

var Gitstore = module.exports = function(git_dir) {
    if (!(this instanceof Gitstore)) return new Gitstore(git_dir);
    this.git_dir = git_dir;
}

Gitstore.prototype = new events.EventEmitter;

Gitstore.prototype.init = function(init_state) {
  var self = this;
  var init = cp.spawn('./gitstore.sh', ['-i', this.git_dir]);

  init.stderr.setEncoding('utf8');
  init.stderr.on('data', function(data){
    console.log('*** error when creating bare repo:\n' + data)
  })

  init.on('close', function(code) {
    if(code !== 0) {
      console.log('*** error code:\n' + code)
    } else {
      self.emit('init')
    }
  })

  init.stdin.on('error', function(err){
    console.log('*** pipe error, git repo is already created?');
  })

  init.stdin.write(JSON.stringify(init_state));
  init.stdin.end();
}

Gitstore.prototype.show = function(ref, callback) {
  cp.execFile('../gitstore.sh', ['--show', ref],{cwd: this.git_dir}, function(err, stdout, stderr) {
    var data = {ok: true, state: undefined};
    if(err) {
      data.ok = false;
    } else {
      data.state = JSON.parse(stdout);
    }
    callback(data);
  })
}

Gitstore.prototype.commit = function(content, parent, branch, callback) {
  var flags = ['--commit', '--parent', parent];
  if(branch) {
    flags.push('--branch');
    flags.push(branch)
  }

  var commit = cp.spawn('../gitstore.sh', flags, {cwd: this.git_dir})
  commit.stdout.setEncoding('utf8');
  commit.stdout.on('data', function(data){
    callback(JSON.parse(data));
  })

  commit.stderr.setEncoding('utf8');
  commit.stderr.on('data', function(data){
    console.log('*** commit error:\n' + data)
  })
  commit.on('err', function(data){
    console.log('*** commit error:\n' + data);
  })

  commit.stdin.write(JSON.stringify(content));
  commit.stdin.end();
}
