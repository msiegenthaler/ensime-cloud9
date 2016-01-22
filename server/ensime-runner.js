var Controller = require("ensime-controller-js");

var stdout = {
  out: process.stderr,
  err: process.stderr
};

// keep the stdout clean since we need it for messages.
console.log = console.info = console.debug = console.warn = function(message) {
  if (message) process.stderr.write(message.toString());
};

if (process.argv.length < 4) {
  return console.error("Specify the .ensime file  and the location of sbt as command line argument.");
}
var dotEnsime = process.argv[2];
var sbt = process.argv[3];
var allowAttach = false;
if (process.argv.length > 4) allowAttach = process.argv[4] == "true";

var ec = new Controller(dotEnsime, "/tmp/ensime", {sbt: sbt});

ec.handleGeneral = function(msg) {
  process.stdout.write(JSON.stringify(msg));
};

function connect() {
  ec.connect(stdout, function(err, res) {
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
    if (err) return connect(); // start if we cannot attach
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