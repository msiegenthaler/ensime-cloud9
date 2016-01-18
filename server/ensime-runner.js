var Controller = require("ensime-controller-js");

var stdout = {
  out: process.stderr,
  err: process.stderr
};

// keep the stdout clean since we need it for messages.
console.log = console.info = console.debug = console.warn = function(message) {
  if (message) process.stderr.write(message.toString());
};

if (process.argv.length < 3) {
  return console.error("Specify the .ensime file as the first command line argument.");
}
var dotEnsime = process.argv[2];

var ec = new Controller(dotEnsime, "/tmp/ensime");

ec.handleGeneral = function(msg) {
  process.stdout.write(JSON.stringify(msg));
};

ec.connect(stdout, function(err, res) {
  if (err) return console.error(err);
  ec.handleGeneral({
    type: "started",
    port: res.ports.http
  });
  console.info("========= Ensime is now running ============\n");
});