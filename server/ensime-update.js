var Controller = require("ensime-controller-js");
var fs = require("fs");
var path = require("path");

if (process.argv.length < 5) {
  return console.error("Specify the .ensime file, the location of sbt and the ensime version as a command line argument.");
}
var dotEnsime = process.argv[2];
var sbt = process.argv[3];
var ensimeVersion = process.argv[4];

var workspace = path.dirname(dotEnsime);
var logfile = path.relative(workspace, ".ensime_cache/ensime.log");
var log = fs.createWriteStream(logfile);
var output = {
  out: log,
  err: log
};

// keep the stdout clean since we need it for messages.
console.log = console.info = console.debug = console.warn = function(message) {
  if (message) output.out.write(message.toString() + "\n");
};

var ec = new Controller(dotEnsime, "/tmp/ensime", {
  sbt: sbt,
  ensimeVersion: ensimeVersion
});

ec.handleGeneral = function(msg) {
  process.stdout.write(JSON.stringify(msg));
};

ec.update(output, function(err, res) {
  if (err) return console.error(err);
  ec.handleGeneral({
    type: "updated",
  });
  console.info("========= ENSIME has been updated ============\n");
});
