var Controller = require("ensime-controller-js");
var fs = require("fs");
var path = require("path");


if (process.argv.length < 4) {
  return console.error("Specify the .ensime file  and the location of sbt as command line argument.");
}
var dotEnsime = process.argv[2];
var sbt = process.argv[3];
var allowAttach = false;
if (process.argv.length > 4) allowAttach = process.argv[4] == "true";

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
  sbt: sbt
});

process.stdout.setEncoding("ascii");

ec.handleGeneral = function(msg) {
  var string = JSON.stringify(msg);
  var buffer = new Buffer(string, "binary");
  process.stdout.write(buffer.toString("base64") + "|");
};

function connect() {
  ec.connect(output, function(err, res) {
    if (err) return console.error(err);
    ec.handleGeneral({
      type: "started",
      port: res.ports.http
    });
    console.info("========= ENSIME is now running ============\n");
  });
}

if (allowAttach) {
  console.info("Checking for running instance...");
  ec.attach(function(err, res) {
    if (err) {
      console.info("Attach failed, starting new instance.");
      return connect(); // start if we cannot attach
    }
    console.info("Attach successful, gut a response: " + JSON.stringify(res));
    ec.handleGeneral({
      type: "started",
      port: res.ports.http
    });
    console.info("========= Attached to running ENSIME ============\n");
  });
}
else {
  connect();
}